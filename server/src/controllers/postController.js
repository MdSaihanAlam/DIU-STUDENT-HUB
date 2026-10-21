import mongoose from 'mongoose';
import { Bookmark, Comment, Community, CommunityMembership, Connection, Post, PUBLIC_USER_FIELDS, Reaction, User } from '../models/index.js';
import { canPublishOfficial, isStaff } from '../middleware/auth.js';
import { DOCUMENT_EXTS, IMAGE_EXTS, inspectFile } from '../middleware/upload.js';
import { storage, publicFileUrl } from '../services/storage.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { ApiError, assertObjectId, escapeRegex, getPaging, isObjectId, ok } from '../utils/http.js';
import { isOwner, sameId } from '../utils/viewer.js';

const HASHTAG_RE = /#([\p{L}\p{N}_]{2,40})/gu;
const MENTION_RE = /@\[([^\]]{1,80})\]\(([a-f\d]{24})\)/gi;

export const extractHashtags = (text = '') => [...new Set([...text.matchAll(HASHTAG_RE)].map((m) => m[1].toLowerCase()))].slice(0, 15);
export const extractMentions = (text = '') => [...new Set([...text.matchAll(MENTION_RE)].map((m) => m[2]))].slice(0, 10);

const authorPopulate = { path: 'author', select: PUBLIC_USER_FIELDS, populate: { path: 'department', select: 'name code' } };

/** Private communities the viewer does not belong to — their posts must stay hidden. */
async function hiddenCommunityIds(user) {
  const privateIds = await Community.find({ visibility: 'private' }).distinct('_id');
  if (!privateIds.length) return [];
  const mine = await CommunityMembership.find({ user: user._id, status: 'active', community: { $in: privateIds } }).distinct('community');
  const mineSet = new Set(mine.map(String));
  return privateIds.filter((id) => !mineSet.has(String(id)));
}

/** Attach the viewer's reaction, bookmark and poll vote; strip voter lists. */
async function decorate(posts, user) {
  if (!posts.length) return [];
  const ids = posts.map((p) => p._id);
  const [reactions, marks] = await Promise.all([
    Reaction.find({ user: user._id, post: { $in: ids } }).select('post type').lean(),
    Bookmark.find({ user: user._id, targetType: 'post', targetId: { $in: ids } }).select('targetId').lean(),
  ]);
  const reacted = new Map(reactions.map((r) => [String(r.post), r.type]));
  const saved = new Set(marks.map((m) => String(m.targetId)));
  return posts.map((p) => {
    const out = { ...p, myReaction: reacted.get(String(p._id)) || null, saved: saved.has(String(p._id)), mine: sameId(p.author?._id, user._id) };
    if (p.poll?.options?.length) {
      let myVote = null;
      out.poll = {
        closesAt: p.poll.closesAt,
        options: p.poll.options.map((o, i) => {
          if (o.voters?.some((v) => sameId(v, user._id))) myVote = i;
          return { text: o.text, votes: o.voters?.length || 0 };
        }),
      };
      out.poll.myVote = myVote;
      out.poll.total = out.poll.options.reduce((s, o) => s + o.votes, 0);
    } else {
      delete out.poll;
    }
    if (p.sharedFrom && p.sharedFrom.status === 'removed') out.sharedFrom = { removed: true };
    return out;
  });
}

const sharedPopulate = { path: 'sharedFrom', select: 'author content type attachments createdAt status', populate: authorPopulate };

export async function listPosts(req, res) {
  const user = req.user;
  const { page, limit, skip } = getPaging(req.query, { defaultLimit: 10, maxLimit: 30 });
  const filter = { status: 'active', author: { $nin: user.blocked } };
  const hidden = await hiddenCommunityIds(user);

  if (req.query.community) {
    const communityId = new mongoose.Types.ObjectId(assertObjectId(req.query.community, 'community'));
    if (hidden.some((h) => sameId(h, communityId))) throw ApiError.forbidden('Join this community to see its posts');
    filter.community = communityId;
  } else if (hidden.length) {
    filter.community = { $nin: hidden };
  }

  const view = req.query.filter || 'latest';
  if (view === 'department') {
    if (!user.department) return ok(res, { items: [], page, limit, total: 0, pages: 1, hasMore: false, hint: 'Set your department in your profile to see department posts.' });
    filter.department = user.department;
  } else if (view === 'communities') {
    const mine = await CommunityMembership.find({ user: user._id, status: 'active' }).distinct('community');
    filter.community = { $in: mine };
  } else if (view === 'following') {
    // posts by accepted connections
    const conns = await Connection.find({ kind: 'connection', status: 'accepted', $or: [{ requester: user._id }, { recipient: user._id }] }).lean();
    const ids = conns.map((c) => (sameId(c.requester, user._id) ? c.recipient : c.requester));
    filter.author = { $in: ids, $nin: user.blocked };
  }

  if (req.query.author && isObjectId(req.query.author)) filter.author = new mongoose.Types.ObjectId(req.query.author);
  if (req.query.type && ['post', 'question', 'announcement', 'research_update', 'poll'].includes(req.query.type)) filter.type = req.query.type;
  if (req.query.hashtag) filter.hashtags = String(req.query.hashtag).replace(/^#/, '').toLowerCase().slice(0, 40);
  if (req.query.q) filter.content = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');

  let posts;
  let total;
  if (view === 'relevant') {
    // Engagement-weighted with time decay; computed in the database to keep paging correct.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const match = { ...filter, createdAt: { $gte: since } };
    const pipeline = [
      { $match: match },
      {
        $addFields: {
          score: {
            $divide: [
              { $add: [1, '$reactionCount', { $multiply: ['$commentCount', 2] }, { $multiply: ['$shareCount', 3] }, { $cond: ['$official', 5, 0] }] },
              { $pow: [{ $add: [2, { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 3600000] }] }, 0.8] },
            ],
          },
        },
      },
      { $sort: { pinned: -1, score: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];
    const [rows, count] = await Promise.all([Post.aggregate(pipeline), Post.countDocuments(match)]);
    posts = await Post.populate(rows, [authorPopulate, sharedPopulate, { path: 'community', select: 'name slug' }]);
    total = count;
  } else {
    [posts, total] = await Promise.all([
      Post.find(filter)
        .sort(req.query.community ? { pinned: -1, createdAt: -1 } : { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(authorPopulate)
        .populate(sharedPopulate)
        .populate('community', 'name slug')
        .lean(),
      Post.countDocuments(filter),
    ]);
  }
  ok(res, { items: await decorate(posts, user), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), hasMore: skip + posts.length < total });
}

export async function getPost(req, res) {
  const id = assertObjectId(req.params.id, 'post id');
  const post = await Post.findOne({ _id: id, status: 'active' }).populate(authorPopulate).populate(sharedPopulate).populate('community', 'name slug visibility').lean();
  if (!post) throw ApiError.notFound('This post is unavailable or was removed');
  if (post.community?.visibility === 'private' && !isStaff(req.user)) {
    const member = await CommunityMembership.exists({ community: post.community._id, user: req.user._id, status: 'active' });
    if (!member) throw ApiError.forbidden('Join this community to see this post');
  }
  const [decorated] = await decorate([post], req.user);
  ok(res, { post: decorated });
}

async function storeAttachments(files = []) {
  const out = [];
  for (const file of files.slice(0, 4)) {
    const { ext, kind } = inspectFile(file, [...IMAGE_EXTS, ...DOCUMENT_EXTS]);
    const key = await storage.save(file.buffer, { folder: kind === 'image' ? 'images' : 'attachments', ext });
    out.push({ url: publicFileUrl(key), name: file.originalname.slice(0, 120), mime: file.mimetype, size: file.size, kind });
  }
  return out;
}

export async function createPost(req, res) {
  const user = req.user;
  const { type, content, community, pollOptions } = req.body;
  if (!content && !req.files?.length) throw ApiError.badRequest('Write something or attach a file');
  if (type === 'poll' && (!pollOptions || pollOptions.length < 2)) throw ApiError.badRequest('A poll needs at least two options');

  if (community) {
    const membership = await CommunityMembership.exists({ community, user: user._id, status: 'active' });
    if (!membership) throw ApiError.forbidden('Join this community before posting in it');
  }

  const mentionIds = extractMentions(content);
  const validMentions = mentionIds.length ? await User.find({ _id: { $in: mentionIds }, status: 'active' }).distinct('_id') : [];
  const post = await Post.create({
    author: user._id,
    type,
    content,
    community,
    department: req.body.department || user.department,
    hashtags: extractHashtags(content),
    mentions: validMentions,
    attachments: await storeAttachments(req.files),
    official: type === 'announcement' && canPublishOfficial(user),
    poll: type === 'poll' ? { options: pollOptions.map((text) => ({ text, voters: [] })) } : undefined,
  });

  await Promise.all(
    validMentions.map((m) => notify({ user: m, type: 'mention', actor: user._id, message: `${user.name} mentioned you in a post`, link: `/posts/${post._id}` }))
  );

  const full = await Post.findById(post._id).populate(authorPopulate).populate('community', 'name slug').lean();
  ok(res, { post: (await decorate([full], user))[0] }, 201);
}

export async function updatePost(req, res) {
  const post = await Post.findOne({ _id: assertObjectId(req.params.id), status: 'active' });
  if (!post) throw ApiError.notFound('Post not found');
  if (!isOwner(req.user, post.author)) throw ApiError.forbidden('You can only edit your own posts');
  post.content = req.body.content;
  post.hashtags = extractHashtags(req.body.content);
  post.editedAt = new Date();
  await post.save();
  const full = await Post.findById(post._id).populate(authorPopulate).populate(sharedPopulate).populate('community', 'name slug').lean();
  ok(res, { post: (await decorate([full], req.user))[0] });
}

export async function deletePost(req, res) {
  const post = await Post.findOne({ _id: assertObjectId(req.params.id), status: 'active' });
  if (!post) throw ApiError.notFound('Post not found');
  const owner = isOwner(req.user, post.author);
  if (!owner && !isStaff(req.user)) throw ApiError.forbidden('You can only delete your own posts');
  post.status = 'removed';
  await post.save();
  if (!owner) await audit(req.user, 'post.remove', 'post', post._id);
  ok(res, { removed: true });
}

export async function togglePin(req, res) {
  const post = await Post.findOne({ _id: assertObjectId(req.params.id), status: 'active' });
  if (!post?.community) throw ApiError.notFound('Community post not found');
  const membership = await CommunityMembership.findOne({ community: post.community, user: req.user._id, role: { $in: ['owner', 'moderator'] } });
  if (!membership && !isStaff(req.user)) throw ApiError.forbidden('Only community moderators can pin posts');
  post.pinned = !post.pinned;
  await post.save();
  ok(res, { pinned: post.pinned });
}

export async function react(req, res) {
  const post = await Post.findOne({ _id: assertObjectId(req.params.id), status: 'active' }).select('author');
  if (!post) throw ApiError.notFound('Post not found');
  const existing = await Reaction.findOne({ post: post._id, user: req.user._id });
  if (existing) {
    existing.type = req.body.type;
    await existing.save();
  } else {
    try {
      await Reaction.create({ post: post._id, user: req.user._id, type: req.body.type });
      await Post.updateOne({ _id: post._id }, { $inc: { reactionCount: 1 } });
      await notify({ user: post.author, type: 'reaction', actor: req.user._id, message: `${req.user.name} reacted to your post`, link: `/posts/${post._id}`, dedupeKey: `react:${post._id}:${req.user._id}` });
    } catch (err) {
      if (err.code !== 11000) throw err; // double-click race: already reacted
    }
  }
  const { reactionCount } = await Post.findById(post._id).select('reactionCount').lean();
  ok(res, { myReaction: req.body.type, reactionCount });
}

export async function unreact(req, res) {
  const id = assertObjectId(req.params.id);
  const removed = await Reaction.findOneAndDelete({ post: id, user: req.user._id });
  if (removed) await Post.updateOne({ _id: id, reactionCount: { $gt: 0 } }, { $inc: { reactionCount: -1 } });
  const post = await Post.findById(id).select('reactionCount').lean();
  ok(res, { myReaction: null, reactionCount: post?.reactionCount ?? 0 });
}

export async function vote(req, res) {
  const id = assertObjectId(req.params.id);
  const post = await Post.findOne({ _id: id, status: 'active', type: 'poll' });
  if (!post) throw ApiError.notFound('Poll not found');
  if (post.poll.closesAt && post.poll.closesAt < new Date()) throw ApiError.badRequest('This poll is closed');
  const { option } = req.body;
  if (option >= post.poll.options.length) throw ApiError.badRequest('Invalid option');
  if (post.poll.options.some((o) => o.voters.some((v) => sameId(v, req.user._id)))) throw ApiError.conflict('You already voted');
  // Atomic: only adds the vote if the user is not already in any option's voter list.
  const result = await Post.updateOne(
    { _id: id, 'poll.options.voters': { $ne: req.user._id } },
    { $addToSet: { [`poll.options.${option}.voters`]: req.user._id } }
  );
  if (!result.modifiedCount) throw ApiError.conflict('You already voted');
  const full = await Post.findById(id).populate(authorPopulate).lean();
  ok(res, { post: (await decorate([full], req.user))[0] });
}

export async function sharePost(req, res) {
  const original = await Post.findOne({ _id: assertObjectId(req.params.id), status: 'active' }).populate('community', 'visibility');
  if (!original) throw ApiError.notFound('Post not found');
  if (original.community?.visibility === 'private') throw ApiError.badRequest('Posts from private communities cannot be shared');
  const rootId = original.sharedFrom || original._id;
  const post = await Post.create({
    author: req.user._id,
    type: 'post',
    content: req.body.content,
    hashtags: extractHashtags(req.body.content),
    sharedFrom: rootId,
    department: req.user.department,
  });
  await Post.updateOne({ _id: rootId }, { $inc: { shareCount: 1 } });
  const full = await Post.findById(post._id).populate(authorPopulate).populate(sharedPopulate).lean();
  ok(res, { post: (await decorate([full], req.user))[0] }, 201);
}

// ---------- Comments ----------
const commentAuthor = { path: 'author', select: PUBLIC_USER_FIELDS };

export async function listComments(req, res) {
  const postId = assertObjectId(req.params.id);
  const { page, limit, skip } = getPaging(req.query, { defaultLimit: 20 });
  const filter = { post: postId, parent: null, author: { $nin: req.user.blocked } };
  const [top, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).populate(commentAuthor).lean(),
    Comment.countDocuments(filter),
  ]);
  const replies = top.length
    ? await Comment.find({ parent: { $in: top.map((c) => c._id) }, author: { $nin: req.user.blocked } })
        .sort({ createdAt: 1 })
        .populate(commentAuthor)
        .lean()
    : [];
  const shape = (c) => ({
    ...c,
    content: c.status === 'removed' ? '' : c.content,
    removed: c.status === 'removed',
    mine: sameId(c.author?._id, req.user._id),
  });
  const items = top.map((c) => ({ ...shape(c), replies: replies.filter((r) => sameId(r.parent, c._id)).map(shape) }));
  ok(res, { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), hasMore: skip + top.length < total });
}

export async function addComment(req, res) {
  const post = await Post.findOne({ _id: assertObjectId(req.params.id), status: 'active' }).select('author community');
  if (!post) throw ApiError.notFound('Post not found');
  if (post.community) {
    const c = await Community.findById(post.community).select('visibility').lean();
    if (c?.visibility === 'private' && !(await CommunityMembership.exists({ community: post.community, user: req.user._id, status: 'active' }))) {
      throw ApiError.forbidden('Join this community to comment');
    }
  }
  let parent = null;
  if (req.body.parent) {
    parent = await Comment.findOne({ _id: req.body.parent, post: post._id });
    if (!parent) throw ApiError.badRequest('The comment you are replying to no longer exists');
    if (parent.parent) parent = await Comment.findById(parent.parent); // keep threads one level deep
  }
  const comment = await Comment.create({ post: post._id, author: req.user._id, parent: parent?._id || null, content: req.body.content });
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });

  const link = `/posts/${post._id}`;
  const notified = new Set([String(req.user._id)]);
  if (parent && !notified.has(String(parent.author))) {
    notified.add(String(parent.author));
    await notify({ user: parent.author, type: 'reply', actor: req.user._id, message: `${req.user.name} replied to your comment`, link });
  }
  if (!notified.has(String(post.author))) {
    notified.add(String(post.author));
    await notify({ user: post.author, type: 'comment', actor: req.user._id, message: `${req.user.name} commented on your post`, link });
  }
  for (const m of extractMentions(req.body.content)) {
    if (!notified.has(m)) {
      notified.add(m);
      await notify({ user: m, type: 'mention', actor: req.user._id, message: `${req.user.name} mentioned you in a comment`, link });
    }
  }
  const full = await Comment.findById(comment._id).populate(commentAuthor).lean();
  ok(res, { comment: { ...full, mine: true, replies: [] } }, 201);
}

export async function deleteComment(req, res) {
  const comment = await Comment.findOne({ _id: assertObjectId(req.params.commentId), status: 'active' });
  if (!comment) throw ApiError.notFound('Comment not found');
  const post = await Post.findById(comment.post).select('author');
  const owner = isOwner(req.user, comment.author);
  if (!owner && !isOwner(req.user, post?.author) && !isStaff(req.user)) throw ApiError.forbidden();
  comment.status = 'removed';
  await comment.save();
  await Post.updateOne({ _id: comment.post, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
  if (!owner && isStaff(req.user)) await audit(req.user, 'comment.remove', 'comment', comment._id);
  ok(res, { removed: true });
}

// ---------- Trending ----------
export async function trending(req, res) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const hidden = await hiddenCommunityIds(req.user);
  const match = { status: 'active', createdAt: { $gte: since }, ...(hidden.length ? { community: { $nin: hidden } } : {}) };
  const [hashtags, discussions] = await Promise.all([
    Post.aggregate([
      { $match: match },
      { $unwind: '$hashtags' },
      { $group: { _id: '$hashtags', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 8 },
    ]),
    Post.find(match)
      .sort({ commentCount: -1, reactionCount: -1 })
      .limit(5)
      .select('content type commentCount reactionCount author createdAt')
      .populate('author', 'name')
      .lean(),
  ]);
  ok(res, {
    hashtags: hashtags.map((h) => ({ tag: h._id, count: h.count })),
    discussions: discussions.map((d) => ({ ...d, content: d.content.replace(MENTION_RE, '@$1').slice(0, 140) })),
  });
}
