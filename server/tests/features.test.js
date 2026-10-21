import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDF, models, registerUser, setup, staffUser, teardown } from './helpers.js';

before(setup);
after(teardown);

describe('posts, comments and reactions', () => {
  it('creates a post, extracts hashtags and supports reactions, comments and bookmarks', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const created = await alice.post('/api/v1/posts').field('content', 'Hello #DIU and @[Bob](' + bob.user._id + ')').field('type', 'post');
    assert.equal(created.status, 201);
    const post = created.body.data.post;
    assert.deepEqual(post.hashtags, ['diu']);

    const react = await bob.post(`/api/v1/posts/${post._id}/react`).send({ type: 'insightful' });
    assert.equal(react.status, 200);
    assert.equal(react.body.data.reactionCount, 1);
    // Reacting twice does not double count
    const again = await bob.post(`/api/v1/posts/${post._id}/react`).send({ type: 'like' });
    assert.equal(again.body.data.reactionCount, 1);

    const comment = await bob.post(`/api/v1/posts/${post._id}/comments`).send({ content: 'Nice!' });
    assert.equal(comment.status, 201);
    const reply = await alice.post(`/api/v1/posts/${post._id}/comments`).send({ content: 'Thanks', parent: comment.body.data.comment._id });
    assert.equal(reply.status, 201);
    const comments = await alice.get(`/api/v1/posts/${post._id}/comments`);
    assert.equal(comments.body.data.items.length, 1);
    assert.equal(comments.body.data.items[0].replies.length, 1);

    const save = await bob.post('/api/v1/bookmarks/toggle').send({ targetType: 'post', targetId: post._id });
    assert.equal(save.body.data.saved, true);
    const saved = await bob.get('/api/v1/bookmarks?type=post');
    assert.equal(saved.body.data.items.length, 1);

    // Mentions and comments notify the author / mentioned member
    const notes = await bob.get('/api/v1/notifications');
    assert.ok(notes.body.data.items.some((n) => n.type === 'mention'));
    const aliceNotes = await alice.get('/api/v1/notifications');
    assert.ok(aliceNotes.body.data.items.some((n) => n.type === 'comment'));
  });

  it('only lets authors edit/delete their posts', async () => {
    const alice = await registerUser();
    const mallory = await registerUser();
    const { body } = await alice.post('/api/v1/posts').field('content', 'Mine');
    const id = body.data.post._id;
    assert.equal((await mallory.patch(`/api/v1/posts/${id}`).send({ content: 'hacked' })).status, 403);
    assert.equal((await mallory.del(`/api/v1/posts/${id}`)).status, 403);
    assert.equal((await alice.del(`/api/v1/posts/${id}`)).status, 200);
    assert.equal((await alice.get(`/api/v1/posts/${id}`)).status, 404);
  });

  it('enforces one vote per member on polls', async () => {
    const alice = await registerUser();
    const res = await alice.post('/api/v1/posts').field('content', 'Pick one').field('type', 'poll').field('pollOptions', JSON.stringify(['A', 'B']));
    const id = res.body.data.post._id;
    const v1 = await alice.post(`/api/v1/posts/${id}/vote`).send({ option: 1 });
    assert.equal(v1.status, 200);
    assert.equal(v1.body.data.post.poll.options[1].votes, 1);
    assert.equal((await alice.post(`/api/v1/posts/${id}/vote`).send({ option: 0 })).status, 409);
  });

  it('paginates the feed', async () => {
    const u = await registerUser();
    for (let i = 0; i < 5; i++) await u.post('/api/v1/posts').field('content', `Paged post ${i} #paging`);
    const p1 = await u.get('/api/v1/posts?hashtag=paging&limit=2&page=1');
    const p3 = await u.get('/api/v1/posts?hashtag=paging&limit=2&page=3');
    assert.equal(p1.body.data.items.length, 2);
    assert.equal(p1.body.data.total, 5);
    assert.equal(p1.body.data.hasMore, true);
    assert.equal(p3.body.data.items.length, 1);
    assert.equal(p3.body.data.hasMore, false);
  });
});

describe('academic resources', () => {
  it('accepts a valid PDF as pending, hides it until approved, then serves downloads', async () => {
    const student = await registerUser();
    const admin = await staffUser('admin');
    const up = await student
      .post('/api/v1/resources')
      .field('title', 'Algorithms notes')
      .field('courseCode', 'cse 221')
      .field('rightsConfirmed', 'true')
      .attach('file', PDF, { filename: 'notes.pdf', contentType: 'application/pdf' });
    assert.equal(up.status, 201, JSON.stringify(up.body));
    const id = up.body.data.resource._id;
    assert.equal(up.body.data.resource.status, 'pending');
    assert.equal(up.body.data.resource.courseCode, 'CSE 221');

    const other = await registerUser();
    assert.equal((await other.get(`/api/v1/resources/${id}`)).status, 404, 'pending resources are hidden');

    const approve = await admin.post(`/api/v1/admin/queue/resources/${id}`).send({ decision: 'approve' });
    assert.equal(approve.status, 200);

    const dl = await other.get(`/api/v1/resources/${id}/download`);
    assert.equal(dl.status, 200);
    assert.match(dl.headers['content-disposition'], /attachment/);
    const after = await other.get(`/api/v1/resources/${id}`);
    assert.equal(after.body.data.resource.downloads, 1);
    assert.equal(after.body.data.resource.file.key, undefined, 'storage keys are never exposed');
  });

  it('rejects files whose content does not match the extension', async () => {
    const student = await registerUser();
    const fake = Buffer.from('MZ\x90\x00 this is an executable', 'latin1');
    const res = await student
      .post('/api/v1/resources')
      .field('title', 'Totally a PDF')
      .field('rightsConfirmed', 'true')
      .attach('file', fake, { filename: 'notes.pdf', contentType: 'application/pdf' });
    assert.equal(res.status, 400);
    const exe = await student.post('/api/v1/resources').field('title', 'Program').field('rightsConfirmed', 'true').attach('file', fake, { filename: 'setup.exe', contentType: 'application/octet-stream' });
    assert.equal(exe.status, 400);
  });

  it('requires the rights confirmation', async () => {
    const student = await registerUser();
    const res = await student.post('/api/v1/resources').field('title', 'Notes').attach('file', PDF, { filename: 'n.pdf', contentType: 'application/pdf' });
    assert.equal(res.status, 400);
  });
});

describe('authorization & moderation', () => {
  it('blocks members from admin endpoints and lets moderators act on reports', async () => {
    const member = await registerUser();
    const author = await registerUser();
    const mod = await staffUser('moderator');
    assert.equal((await member.get('/api/v1/admin/stats')).status, 403);
    assert.equal((await mod.patch(`/api/v1/admin/users/${member.user._id}/role`).send({ role: 'admin' })).status, 403, 'role changes are admin-only');

    const { body } = await author.post('/api/v1/posts').field('content', 'spam spam spam');
    const postId = body.data.post._id;
    const rep = await member.post('/api/v1/reports').send({ targetType: 'post', targetId: postId, reason: 'spam' });
    assert.equal(rep.status, 201);
    const reports = await mod.get('/api/v1/admin/reports');
    const report = reports.body.data.items.find((r) => r.targetId === postId);
    assert.ok(report);
    const act = await mod.post(`/api/v1/admin/reports/${report._id}`).send({ action: 'remove_content', note: 'spam' });
    assert.equal(act.status, 200);
    assert.equal((await member.get(`/api/v1/posts/${postId}`)).status, 404);
    const post = await models.Post.findById(postId).lean();
    assert.equal(post.status, 'removed');

    const admin = await staffUser('admin');
    const log = await admin.get('/api/v1/admin/audit');
    assert.ok(log.body.data.items.some((a) => a.action === 'report.remove_content'));
  });

  it('verifies faculty only through the review workflow', async () => {
    const prof = await registerUser({ affiliation: 'faculty' });
    const admin = await staffUser('admin');
    const ev = await prof.post('/api/v1/events').send({ title: 'Seminar', description: 'A talk about things', startsAt: new Date(Date.now() + 86400000).toISOString(), organizer: 'Me', venue: 'Room 1' });
    assert.equal(ev.body.data.event.official, false, 'unverified faculty cannot publish official events');

    const req = await prof.post('/api/v1/verification').send({ requestedAffiliation: 'faculty', evidence: 'Lecturer, official email x@example.edu' });
    assert.equal(req.status, 201);
    const list = await admin.get('/api/v1/admin/verifications');
    const vr = list.body.data.items.find((r) => r.user._id === prof.user._id);
    await admin.post(`/api/v1/admin/verifications/${vr._id}`).send({ decision: 'approve' });

    const ev2 = await prof.post('/api/v1/events').send({ title: 'Seminar 2', description: 'Another talk', startsAt: new Date(Date.now() + 86400000).toISOString(), organizer: 'Me', venue: 'Room 1' });
    assert.equal(ev2.body.data.event.official, true);
    assert.equal(ev2.body.data.event.reviewStatus, 'approved');
  });
});

describe('privacy', () => {
  it('keeps housing contact details and private emails hidden', async () => {
    const owner = await registerUser();
    const visitor = await registerUser();
    const res = await owner
      .post('/api/v1/housing')
      .field('title', 'Mess seat near campus')
      .field('type', 'mess_seat')
      .field('rent', '4500')
      .field('area', 'Badda')
      .field('availableFrom', new Date().toISOString())
      .field('contactMethod', 'in_app');
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const id = res.body.data.listing._id;
    const view = await visitor.get(`/api/v1/housing/${id}`);
    assert.equal(view.body.data.listing.contact.value, undefined);

    const profile = await visitor.get(`/api/v1/users/${owner.user._id}`);
    assert.equal(profile.body.data.user.email, undefined, 'emails are private by default');

    const contact = await visitor.post(`/api/v1/housing/${id}/contact`).send({ message: 'Is it still available?' });
    assert.equal(contact.status, 201);
    const convos = await owner.get('/api/v1/conversations');
    assert.equal(convos.body.data.items[0].isRequest, true);
  });

  it('stops blocked members from messaging', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await a.post(`/api/v1/users/${b.user._id}/block`);
    const res = await b.post('/api/v1/conversations').send({ userId: a.user._id, message: 'hello there' });
    assert.equal(res.status, 403);
  });

  it('respects private community visibility', async () => {
    const owner = await registerUser();
    const outsider = await registerUser();
    const c = await owner.post('/api/v1/communities').send({ name: 'Secret study group', visibility: 'private' });
    const id = c.body.data.community._id;
    await owner.post('/api/v1/posts').field('content', 'members only').field('community', id);
    assert.equal((await outsider.get(`/api/v1/posts?community=${id}`)).status, 403);
    const feed = await outsider.get('/api/v1/posts');
    assert.ok(!feed.body.data.items.some((p) => p.content === 'members only'));
    const join = await outsider.post(`/api/v1/communities/${c.body.data.community.slug}/join`);
    assert.equal(join.body.data.membership.status, 'pending');
  });
});
