import {
  AcademicResource,
  AlumniProfile,
  Connection,
  Conversation,
  HousingListing,
  Post,
  PUBLIC_USER_FIELDS,
  ResearchProject,
  User,
} from '../models/index.js';
import { inspectFile, IMAGE_EXTS } from '../middleware/upload.js';
import { clearSession, isStaff } from '../middleware/auth.js';
import { storage, publicFileUrl } from '../services/storage.js';
import { notify } from '../services/notify.js';
import { loadSelf } from './authController.js';
import { ApiError, assertObjectId, containsRegex, getPaging, ok, paginate } from '../utils/http.js';
import { sameId } from '../utils/viewer.js';

export async function areConnected(a, b) {
  return !!(await Connection.exists({
    kind: 'connection',
    status: 'accepted',
    $or: [
      { requester: a, recipient: b },
      { requester: b, recipient: a },
    ],
  }));
}

export async function updateProfile(req, res) {
  const updates = { ...req.body };
  if (updates.links) {
    for (const [k, v] of Object.entries(updates.links)) updates[`links.${k}`] = v ?? '';
    delete updates.links;
  }
  await User.updateOne({ _id: req.user._id }, { $set: updates }, { runValidators: true });
  ok(res, { user: await loadSelf(req.user._id) });
}

export async function updateSettings(req, res) {
  const set = {};
  for (const group of ['privacy', 'notificationPrefs']) {
    for (const [k, v] of Object.entries(req.body[group] || {})) set[`${group}.${k}`] = v;
  }
  await User.updateOne({ _id: req.user._id }, { $set: set }, { runValidators: true });
  ok(res, { user: await loadSelf(req.user._id) });
}

export async function uploadAvatar(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload');
  const { ext } = inspectFile(req.file, IMAGE_EXTS);
  const key = await storage.save(req.file.buffer, { folder: 'avatars', ext });
  const old = req.user.avatarUrl;
  req.user.avatarUrl = publicFileUrl(key);
  await req.user.save();
  if (old?.startsWith('/api/v1/files/avatars/')) await storage.remove(old.replace('/api/v1/files/', ''));
  ok(res, { user: await loadSelf(req.user._id) });
}

export async function removeAvatar(req, res) {
  const old = req.user.avatarUrl;
  req.user.avatarUrl = undefined;
  await req.user.save();
  if (old?.startsWith('/api/v1/files/avatars/')) await storage.remove(old.replace('/api/v1/files/', ''));
  ok(res, { user: await loadSelf(req.user._id) });
}

/** People directory/search for signed-in members. Only shows public fields. */
export async function listUsers(req, res) {
  const paging = getPaging(req.query, { defaultLimit: 20 });
  const filter = { status: 'active', 'privacy.profileVisibility': { $ne: 'private' }, _id: { $nin: req.user.blocked } };
  if (req.query.q) filter.$or = [{ name: containsRegex(req.query.q) }, { headline: containsRegex(req.query.q) }, { skills: containsRegex(req.query.q) }];
  if (req.query.department) filter.department = assertObjectId(req.query.department, 'department');
  if (['student', 'faculty', 'alumni'].includes(req.query.affiliation)) filter.affiliation = req.query.affiliation;
  const data = await paginate(User, filter, paging, {
    select: PUBLIC_USER_FIELDS,
    populate: { path: 'department', select: 'name code slug' },
    sort: { affiliationVerified: -1, name: 1 },
  });
  ok(res, data);
}

export async function suggestedUsers(req, res) {
  const me = req.user;
  const existing = await Connection.find({ $or: [{ requester: me._id }, { recipient: me._id }] }).select('requester recipient').lean();
  const exclude = new Set([String(me._id), ...me.blocked.map(String)]);
  existing.forEach((c) => {
    exclude.add(String(c.requester));
    exclude.add(String(c.recipient));
  });
  const filter = { status: 'active', 'privacy.profileVisibility': 'members', _id: { $nin: [...exclude] } };
  if (me.department) filter.department = me.department;
  let users = await User.find(filter).select(PUBLIC_USER_FIELDS).populate('department', 'name code').limit(5).lean();
  if (users.length < 3) {
    delete filter.department;
    users = await User.find(filter).select(PUBLIC_USER_FIELDS).populate('department', 'name code').limit(5).lean();
  }
  ok(res, { items: users });
}

export async function getUser(req, res) {
  const id = assertObjectId(req.params.id, 'user id');
  const viewer = req.user;
  const user = await User.findOne({ _id: id, status: { $in: ['active', 'deletion_requested'] } })
    .select(`${PUBLIC_USER_FIELDS} email bio skills links privacy createdAt blocked`)
    .populate('department', 'name code slug')
    .lean();
  if (!user) throw ApiError.notFound('Member not found');

  const self = sameId(viewer._id, user._id);
  const blockedMe = user.blocked?.some((b) => sameId(b, viewer._id));
  if (blockedMe && !isStaff(viewer)) throw ApiError.notFound('Member not found');

  const connections = await Connection.find({
    $or: [
      { requester: viewer._id, recipient: user._id },
      { requester: user._id, recipient: viewer._id },
    ],
  }).lean();
  const connection = connections.find((c) => c.kind === 'connection');
  const connected = connection?.status === 'accepted';
  const vis = user.privacy?.profileVisibility || 'members';
  const canSeeFull = self || isStaff(viewer) || vis === 'members' || (vis === 'connections' && connected);

  const base = {
    _id: user._id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    affiliation: user.affiliation,
    affiliationVerified: user.affiliationVerified,
    role: user.role,
    department: user.department,
    headline: user.headline,
  };
  const relationship = {
    self,
    connection: connection
      ? { _id: connection._id, status: connection.status, outgoing: sameId(connection.requester, viewer._id) }
      : null,
    mentorship: connections.find((c) => c.kind === 'mentorship' && sameId(c.requester, viewer._id))?.status || null,
    blocked: viewer.blocked.some((b) => sameId(b, user._id)),
    canMessage: !self && user.privacy?.allowMessagesFrom !== 'nobody' && (user.privacy?.allowMessagesFrom !== 'connections' || connected),
  };

  if (!canSeeFull) return ok(res, { user: { ...base, limited: true }, relationship });

  const [alumni, stats] = await Promise.all([
    AlumniProfile.findOne({ user: user._id, ...(self ? {} : { visibility: 'members' }) })
      .populate('department', 'name code')
      .lean(),
    Promise.all([
      Post.countDocuments({ author: user._id, status: 'active' }),
      AcademicResource.countDocuments({ uploader: user._id, status: 'approved' }),
      ResearchProject.countDocuments({ lead: user._id, reviewStatus: 'verified' }),
      Connection.countDocuments({ kind: 'connection', status: 'accepted', $or: [{ requester: user._id }, { recipient: user._id }] }),
    ]),
  ]);
  if (alumni && !alumni.shareContact && !self) delete alumni.contactEmail;

  ok(res, {
    user: {
      ...base,
      program: user.program,
      batch: user.batch,
      bio: user.bio,
      skills: user.skills,
      links: user.links,
      createdAt: user.createdAt,
      email: self || user.privacy?.showEmail ? user.email : undefined,
      alumni,
      stats: { posts: stats[0], resources: stats[1], research: stats[2], connections: stats[3] },
    },
    relationship,
  });
}

export async function userContent(req, res) {
  const id = assertObjectId(req.params.id, 'user id');
  const self = sameId(id, req.user._id);
  const [resources, research, housing] = await Promise.all([
    AcademicResource.find({ uploader: id, ...(self ? { status: { $ne: 'removed' } } : { status: 'approved' }) })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('title courseCode resourceType status downloads createdAt')
      .lean(),
    ResearchProject.find({ lead: id, ...(self ? {} : { reviewStatus: 'verified' }) })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('title domain status reviewStatus createdAt')
      .lean(),
    self
      ? HousingListing.find({ owner: id, status: { $ne: 'removed' } }).sort({ createdAt: -1 }).limit(20).select('title rent area status expiresAt').lean()
      : [],
  ]);
  ok(res, { resources, research, housing });
}

// ---------- Blocking ----------
export async function blockUser(req, res) {
  const id = assertObjectId(req.params.id, 'user id');
  if (sameId(id, req.user._id)) throw ApiError.badRequest('You cannot block yourself');
  if (!(await User.exists({ _id: id }))) throw ApiError.notFound('Member not found');
  await User.updateOne({ _id: req.user._id }, { $addToSet: { blocked: id } });
  await Connection.deleteMany({ $or: [{ requester: req.user._id, recipient: id }, { requester: id, recipient: req.user._id }] });
  await Conversation.updateMany({ participants: { $all: [req.user._id, id] } }, { status: 'blocked' });
  ok(res, { blocked: true });
}

export async function unblockUser(req, res) {
  const id = assertObjectId(req.params.id, 'user id');
  await User.updateOne({ _id: req.user._id }, { $pull: { blocked: id } });
  // Re-open the conversation as a request unless the other side also blocked.
  const other = await User.findById(id).select('blocked').lean();
  if (!other?.blocked?.some((b) => sameId(b, req.user._id))) {
    await Conversation.updateMany({ participants: { $all: [req.user._id, id] }, status: 'blocked' }, { status: 'request' });
  }
  ok(res, { blocked: false });
}

export async function listBlocked(req, res) {
  const users = await User.find({ _id: { $in: req.user.blocked } }).select('name avatarUrl').lean();
  ok(res, { items: users });
}

// ---------- Connections & mentorship ----------
export async function requestConnection(req, res) {
  const id = assertObjectId(req.params.id, 'user id');
  if (sameId(id, req.user._id)) throw ApiError.badRequest('You cannot connect with yourself');
  const target = await User.findOne({ _id: id, status: 'active' }).select('name blocked').lean();
  if (!target || target.blocked?.some((b) => sameId(b, req.user._id))) throw ApiError.notFound('Member not found');
  if (req.user.blocked.some((b) => sameId(b, id))) throw ApiError.badRequest('Unblock this member first');

  const { kind, message } = req.body;
  if (kind === 'mentorship') {
    const alumni = await AlumniProfile.findOne({ user: id, mentorshipAvailable: true }).lean();
    if (!alumni) throw ApiError.badRequest('This member is not currently accepting mentorship requests');
  }
  // If the other person already asked us, accept instead of creating a duplicate.
  const reverse = await Connection.findOne({ requester: id, recipient: req.user._id, kind, status: 'pending' });
  if (reverse && kind === 'connection') {
    reverse.status = 'accepted';
    await reverse.save();
    await notify({ user: id, type: 'connection_accepted', actor: req.user._id, message: `${req.user.name} accepted your connection request`, link: `/u/${req.user._id}` });
    return ok(res, { connection: reverse });
  }
  const existing = await Connection.findOne({ requester: req.user._id, recipient: id, kind });
  if (existing && existing.status !== 'declined') throw ApiError.conflict('Request already sent');
  const connection = existing || new Connection({ requester: req.user._id, recipient: id, kind });
  connection.status = 'pending';
  connection.message = message;
  await connection.save();
  await notify({
    user: id,
    type: kind === 'mentorship' ? 'mentorship_request' : 'connection_request',
    actor: req.user._id,
    message: kind === 'mentorship' ? `${req.user.name} requested mentorship` : `${req.user.name} wants to connect`,
    link: '/network',
  });
  ok(res, { connection }, 201);
}

export async function listConnections(req, res) {
  const me = req.user._id;
  const all = await Connection.find({ $or: [{ requester: me }, { recipient: me }], status: { $ne: 'declined' } })
    .sort({ updatedAt: -1 })
    .populate('requester', PUBLIC_USER_FIELDS)
    .populate('recipient', PUBLIC_USER_FIELDS)
    .lean();
  const shape = (c) => ({
    _id: c._id,
    kind: c.kind,
    status: c.status,
    message: c.message,
    createdAt: c.createdAt,
    incoming: sameId(c.recipient?._id, me),
    user: sameId(c.requester?._id, me) ? c.recipient : c.requester,
  });
  const items = all.filter((c) => c.requester && c.recipient).map(shape);
  ok(res, {
    connections: items.filter((c) => c.status === 'accepted' && c.kind === 'connection'),
    incoming: items.filter((c) => c.status === 'pending' && c.incoming),
    outgoing: items.filter((c) => c.status === 'pending' && !c.incoming),
    mentorships: items.filter((c) => c.status === 'accepted' && c.kind === 'mentorship'),
  });
}

export async function respondConnection(req, res) {
  const id = assertObjectId(req.params.id);
  const connection = await Connection.findOne({ _id: id, recipient: req.user._id, status: 'pending' });
  if (!connection) throw ApiError.notFound('Request not found');
  connection.status = req.body.accept ? 'accepted' : 'declined';
  await connection.save();
  if (req.body.accept) {
    await notify({
      user: connection.requester,
      type: 'connection_accepted',
      actor: req.user._id,
      message: `${req.user.name} accepted your ${connection.kind === 'mentorship' ? 'mentorship' : 'connection'} request`,
      link: `/u/${req.user._id}`,
    });
  }
  ok(res, { connection });
}

export async function removeConnection(req, res) {
  const id = assertObjectId(req.params.id);
  const result = await Connection.deleteOne({ _id: id, $or: [{ requester: req.user._id }, { recipient: req.user._id }] });
  if (!result.deletedCount) throw ApiError.notFound('Connection not found');
  ok(res, { removed: true });
}

// ---------- Account deletion ----------
export async function requestDeletion(req, res) {
  // Re-authenticate: a stolen session (or someone at an unlocked laptop) must not be able to delete the account.
  const withHash = await User.findById(req.user._id).select('+passwordHash');
  if (!(await withHash.checkPassword(req.body.password))) throw ApiError.badRequest('Password is incorrect');
  req.user.status = 'deletion_requested';
  req.user.deletionRequestedAt = new Date();
  req.user.tokenVersion += 1;
  await req.user.save();
  clearSession(res);
  ok(res, { message: 'Your account is deactivated and scheduled for deletion. Sign in within 14 days to cancel.' });
}
