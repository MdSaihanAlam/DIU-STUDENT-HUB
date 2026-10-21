import {
  AcademicResource,
  AlumniProfile,
  AuditLog,
  CareerOpportunity,
  Comment,
  Community,
  Department,
  Event,
  FacultyProfile,
  HousingListing,
  Message,
  Post,
  Report,
  ResearchProject,
  User,
  VerificationRequest,
} from '../models/index.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notify.js';
import { storage } from '../services/storage.js';
import { ApiError, assertObjectId, containsRegex, getPaging, ok, paginate } from '../utils/http.js';
import { sameId } from '../utils/viewer.js';

export async function stats(req, res) {
  const [users, pendingVerifications, openReports, queue, deletionRequests] = await Promise.all([
    User.countDocuments({ status: { $ne: 'deleted' } }),
    VerificationRequest.countDocuments({ status: 'pending' }),
    Report.countDocuments({ status: 'open' }),
    Promise.all([
      AcademicResource.countDocuments({ status: 'pending' }),
      ResearchProject.countDocuments({ reviewStatus: 'pending' }),
      CareerOpportunity.countDocuments({ reviewStatus: 'pending' }),
      Event.countDocuments({ reviewStatus: 'pending' }),
    ]),
    User.countDocuments({ status: 'deletion_requested' }),
  ]);
  ok(res, {
    users,
    pendingVerifications,
    openReports,
    deletionRequests,
    queue: { resources: queue[0], research: queue[1], careers: queue[2], events: queue[3] },
  });
}

// ---------- Users ----------
export async function listUsers(req, res) {
  const paging = getPaging(req.query, { defaultLimit: 25 });
  const filter = {};
  if (req.query.q) filter.$or = [{ name: containsRegex(req.query.q) }, { email: containsRegex(req.query.q) }];
  if (req.query.role) filter.role = String(req.query.role);
  if (req.query.status) filter.status = String(req.query.status);
  const data = await paginate(User, filter, paging, {
    select: 'name email role affiliation affiliationVerified status createdAt department suspendedReason deletionRequestedAt',
    populate: { path: 'department', select: 'code' },
  });
  ok(res, data);
}

export async function setRole(req, res) {
  const user = await User.findById(assertObjectId(req.params.id));
  if (!user) throw ApiError.notFound('User not found');
  if (sameId(user._id, req.user._id)) throw ApiError.badRequest('You cannot change your own role');
  const before = user.role;
  user.role = req.body.role;
  await user.save();
  await audit(req.user, 'user.role', 'user', user._id, { from: before, to: user.role });
  ok(res, { user: { _id: user._id, role: user.role } });
}

export async function suspendUser(req, res) {
  const user = await User.findById(assertObjectId(req.params.id));
  if (!user) throw ApiError.notFound('User not found');
  if (sameId(user._id, req.user._id)) throw ApiError.badRequest('You cannot suspend yourself');
  if (user.role === 'admin' || (user.role === 'moderator' && req.user.role !== 'admin')) throw ApiError.forbidden('You cannot suspend this account');
  user.status = 'suspended';
  user.suspendedReason = req.body.reason;
  user.tokenVersion += 1; // ends active sessions
  await user.save();
  await audit(req.user, 'user.suspend', 'user', user._id, { reason: req.body.reason });
  ok(res, { status: user.status });
}

export async function restoreUser(req, res) {
  const user = await User.findById(assertObjectId(req.params.id));
  if (!user || user.status === 'deleted') throw ApiError.notFound('User not found');
  user.status = 'active';
  user.suspendedReason = undefined;
  await user.save();
  await audit(req.user, 'user.restore', 'user', user._id);
  ok(res, { status: user.status });
}

/**
 * Permanently anonymise an account that asked to be deleted. Personal data is erased;
 * the author's posts and listings are removed; private messages are deleted.
 * Moderation records keep only the opaque user id for accountability.
 */
export async function processDeletion(req, res) {
  const user = await User.findById(assertObjectId(req.params.id));
  if (!user || user.status !== 'deletion_requested') throw ApiError.badRequest('This account has not requested deletion');
  const id = user._id;
  const resources = await AcademicResource.find({ uploader: id }).select('file.key').lean();
  await Promise.all([
    Post.updateMany({ author: id }, { status: 'removed' }),
    Comment.updateMany({ author: id }, { status: 'removed' }),
    HousingListing.updateMany({ owner: id }, { status: 'removed' }),
    AcademicResource.updateMany({ uploader: id }, { status: 'removed' }),
    AlumniProfile.deleteOne({ user: id }),
    Message.deleteMany({ sender: id }),
    FacultyProfile.updateMany({ user: id }, { $unset: { user: 1 } }),
  ]);
  await Promise.all(resources.map((r) => storage.remove(r.file.key)));
  if (user.avatarUrl?.startsWith('/api/v1/files/')) await storage.remove(user.avatarUrl.replace('/api/v1/files/', ''));
  Object.assign(user, {
    name: 'Deleted member',
    email: `deleted-${id}@deleted.invalid`,
    status: 'deleted',
    bio: undefined,
    headline: undefined,
    avatarUrl: undefined,
    skills: [],
    links: {},
    blocked: [],
  });
  user.tokenVersion += 1;
  await user.save();
  await audit(req.user, 'user.delete', 'user', id);
  ok(res, { deleted: true });
}

// ---------- Verification ----------
export async function listVerifications(req, res) {
  const paging = getPaging(req.query, { defaultLimit: 20 });
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const data = await paginate(VerificationRequest, { status }, paging, {
    sort: { createdAt: status === 'pending' ? 1 : -1 },
    populate: [
      { path: 'user', select: 'name email affiliation affiliationVerified department batch program', populate: { path: 'department', select: 'code' } },
      { path: 'reviewer', select: 'name' },
    ],
  });
  ok(res, data);
}

export async function decideVerification(req, res) {
  const request = await VerificationRequest.findOne({ _id: assertObjectId(req.params.id), status: 'pending' });
  if (!request) throw ApiError.notFound('Request not found or already reviewed');
  const approve = req.body.decision === 'approve';
  request.status = approve ? 'approved' : 'rejected';
  request.reviewer = req.user._id;
  request.reviewNote = req.body.note;
  request.reviewedAt = new Date();
  await request.save();
  if (approve) await User.updateOne({ _id: request.user }, { affiliation: request.requestedAffiliation, affiliationVerified: true });
  await notify({
    user: request.user,
    type: 'verification',
    message: approve ? `You are now verified as ${request.requestedAffiliation}.` : `Your verification request was not approved${req.body.note ? `: ${req.body.note}` : '.'}`,
    link: '/settings?tab=verification',
  });
  await audit(req.user, `verification.${request.status}`, 'user', request.user, { affiliation: request.requestedAffiliation });
  ok(res, { request });
}

// ---------- Reports ----------
const CONTENT = {
  post: { model: Post, remove: { status: 'removed' }, owner: 'author' },
  comment: { model: Comment, remove: { status: 'removed' }, owner: 'author' },
  resource: { model: AcademicResource, remove: { status: 'removed' }, owner: 'uploader' },
  housing: { model: HousingListing, remove: { status: 'removed' }, owner: 'owner' },
  research: { model: ResearchProject, remove: { reviewStatus: 'rejected', featured: false }, owner: 'lead' },
  career: { model: CareerOpportunity, remove: { reviewStatus: 'rejected' }, owner: 'postedBy' },
  event: { model: Event, remove: { reviewStatus: 'rejected' }, owner: 'postedBy' },
  community: { model: Community, remove: { status: 'removed' }, owner: 'createdBy' },
  message: { model: Message, remove: null, owner: 'sender' },
  user: { model: User, remove: null, owner: '_id' },
};

const PREVIEW_FIELDS = { post: 'content', comment: 'content', resource: 'title', housing: 'title', research: 'title', career: 'title', event: 'title', community: 'name', message: 'body', user: 'name' };

export async function listReports(req, res) {
  const paging = getPaging(req.query, { defaultLimit: 20 });
  const status = ['open', 'actioned', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const filter = { status, ...(req.query.reason ? { reason: String(req.query.reason) } : {}) };
  const data = await paginate(Report, filter, paging, {
    sort: { createdAt: status === 'open' ? 1 : -1 },
    populate: [
      { path: 'reporter', select: 'name' },
      { path: 'resolvedBy', select: 'name' },
    ],
  });
  // Attach a short preview of each reported item (one query per type).
  const byType = {};
  data.items.forEach((r) => (byType[r.targetType] ||= []).push(r.targetId));
  const previews = new Map();
  await Promise.all(
    Object.entries(byType).map(async ([t, ids]) => {
      const c = CONTENT[t];
      const docs = await c.model.find({ _id: { $in: ids } }).select(`${PREVIEW_FIELDS[t]} ${c.owner} status reviewStatus`).lean();
      docs.forEach((d) => previews.set(`${t}:${d._id}`, { text: String(d[PREVIEW_FIELDS[t]] || '').slice(0, 200), owner: d[c.owner], state: d.status || d.reviewStatus }));
    })
  );
  data.items = data.items.map((r) => ({ ...r, preview: previews.get(`${r.targetType}:${r.targetId}`) || null }));
  ok(res, data);
}

export async function actOnReport(req, res) {
  const report = await Report.findOne({ _id: assertObjectId(req.params.id), status: 'open' });
  if (!report) throw ApiError.notFound('Report not found or already handled');
  const c = CONTENT[report.targetType];
  const target = await c.model.findById(report.targetId);
  const { action, note } = req.body;

  if (action === 'remove_content') {
    if (!target) throw ApiError.badRequest('The reported item no longer exists; dismiss the report instead');
    if (!c.remove) throw ApiError.badRequest('This item cannot be removed; suspend the user instead');
    await c.model.updateOne({ _id: target._id }, c.remove);
    if (report.targetType === 'resource') await storage.remove(target.file.key);
  }
  if (action === 'suspend_user') {
    const ownerId = target?.[c.owner];
    const owner = ownerId && (await User.findById(ownerId));
    if (!owner) throw ApiError.badRequest('Could not find the account behind this item');
    if (owner.role === 'admin' || (owner.role === 'moderator' && req.user.role !== 'admin')) throw ApiError.forbidden('You cannot suspend this account');
    owner.status = 'suspended';
    owner.suspendedReason = note || `Reported for ${report.reason}`;
    owner.tokenVersion += 1;
    await owner.save();
    if (c.remove && target) await c.model.updateOne({ _id: target._id }, c.remove);
  }
  // Resolve every open report about the same item at once.
  await Report.updateMany(
    { targetType: report.targetType, targetId: report.targetId, status: 'open' },
    { status: action === 'dismiss' ? 'dismissed' : 'actioned', resolvedBy: req.user._id, resolutionNote: note, resolvedAt: new Date() }
  );
  if (action !== 'dismiss' && target?.[c.owner]) {
    await notify({ user: target[c.owner], type: 'system', message: `Content you posted was removed for violating community guidelines (${report.reason}).`, link: '/guidelines' });
  }
  await audit(req.user, `report.${action}`, report.targetType, report.targetId, { reason: report.reason });
  ok(res, { done: true });
}

// ---------- Review queues ----------
const QUEUES = {
  resources: { model: AcademicResource, pending: { status: 'pending' }, owner: 'uploader', label: 'title', link: (d) => `/resources/${d._id}` },
  research: { model: ResearchProject, pending: { reviewStatus: 'pending' }, owner: 'lead', label: 'title', link: (d) => `/research/${d._id}` },
  careers: { model: CareerOpportunity, pending: { reviewStatus: 'pending' }, owner: 'postedBy', label: 'title', link: (d) => `/careers/${d._id}` },
  events: { model: Event, pending: { reviewStatus: 'pending' }, owner: 'postedBy', label: 'title', link: (d) => `/events/${d._id}` },
};

export async function listQueue(req, res) {
  const q = QUEUES[req.params.type];
  if (!q) throw ApiError.notFound('Unknown queue');
  const paging = getPaging(req.query, { defaultLimit: 20 });
  const data = await paginate(q.model, q.pending, paging, { sort: { createdAt: 1 }, populate: { path: q.owner, select: 'name email affiliation affiliationVerified' } });
  ok(res, data);
}

export async function decideQueue(req, res) {
  const q = QUEUES[req.params.type];
  if (!q) throw ApiError.notFound('Unknown queue');
  const doc = await q.model.findOne({ _id: assertObjectId(req.params.id), ...q.pending });
  if (!doc) throw ApiError.notFound('Item not found or already reviewed');
  const approve = req.body.decision === 'approve';
  if (req.params.type === 'resources') doc.status = approve ? 'approved' : 'rejected';
  else if (req.params.type === 'research') doc.reviewStatus = approve ? 'verified' : 'rejected';
  else doc.reviewStatus = approve ? 'approved' : 'rejected';
  if (req.params.type === 'careers' && approve) doc.verified = req.body.verified ?? true;
  doc.reviewNote = req.body.note;
  await doc.save();
  if (req.params.type === 'resources' && !approve) await storage.remove(doc.file.key);
  await notify({
    user: doc[q.owner],
    type: req.params.type === 'resources' ? 'resource_review' : req.params.type === 'research' ? 'research_review' : 'submission_review',
    message: `"${doc[q.label]}" was ${approve ? 'approved' : 'not approved'}${req.body.note ? `: ${req.body.note}` : ''}`,
    link: approve ? q.link(doc) : undefined,
  });
  await audit(req.user, `${req.params.type}.${approve ? 'approve' : 'reject'}`, req.params.type, doc._id);
  ok(res, { done: true });
}

export async function toggleFeature(req, res) {
  const id = assertObjectId(req.params.id);
  if (req.params.type === 'research') {
    const p = await ResearchProject.findOne({ _id: id, reviewStatus: 'verified' });
    if (!p) throw ApiError.badRequest('Only verified projects can be featured');
    p.featured = !p.featured;
    await p.save();
    await audit(req.user, 'research.feature', 'research', id, { featured: p.featured });
    return ok(res, { featured: p.featured });
  }
  if (req.params.type === 'story') {
    const a = await AlumniProfile.findById(id);
    if (!a?.successStory?.body) throw ApiError.badRequest('This profile has no success story');
    a.successStory.featured = !a.successStory.featured;
    await a.save();
    await audit(req.user, 'story.feature', 'alumni', id, { featured: a.successStory.featured });
    return ok(res, { featured: a.successStory.featured });
  }
  throw ApiError.badRequest('Unsupported type');
}

export async function featuredOverview(req, res) {
  const [research, stories] = await Promise.all([
    ResearchProject.find({ reviewStatus: 'verified' }).sort({ featured: -1, updatedAt: -1 }).limit(30).select('title domain featured').lean(),
    AlumniProfile.find({ 'successStory.body': { $exists: true, $ne: '' } }).limit(30).select('successStory.title successStory.featured user').populate('user', 'name').lean(),
  ]);
  ok(res, { research, stories });
}

export async function auditLog(req, res) {
  const paging = getPaging(req.query, { defaultLimit: 30 });
  const data = await paginate(AuditLog, {}, paging, { populate: { path: 'actor', select: 'name role' } });
  ok(res, data);
}

// ---------- Directory management ----------
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export async function createDepartment(req, res) {
  const dept = await Department.create({ ...req.body, slug: slugify(req.body.code) });
  await audit(req.user, 'department.create', 'department', dept._id);
  ok(res, { department: dept }, 201);
}

export async function updateDepartment(req, res) {
  const dept = await Department.findById(assertObjectId(req.params.id));
  if (!dept) throw ApiError.notFound('Department not found');
  Object.assign(dept, req.body, { slug: slugify(req.body.code) });
  await dept.save();
  await audit(req.user, 'department.update', 'department', dept._id);
  ok(res, { department: dept });
}

export async function deleteDepartment(req, res) {
  const id = assertObjectId(req.params.id);
  const inUse = await Promise.all([User.exists({ department: id }), FacultyProfile.exists({ department: id })]);
  if (inUse.some(Boolean)) throw ApiError.conflict('Department is referenced by members or faculty and cannot be deleted');
  await Department.deleteOne({ _id: id });
  await audit(req.user, 'department.delete', 'department', id);
  ok(res, { removed: true });
}

export async function createFaculty(req, res) {
  const profile = await FacultyProfile.create(req.body);
  await audit(req.user, 'faculty.create', 'faculty', profile._id);
  ok(res, { profile }, 201);
}

export async function updateFaculty(req, res) {
  const profile = await FacultyProfile.findById(assertObjectId(req.params.id));
  if (!profile) throw ApiError.notFound('Faculty profile not found');
  Object.assign(profile, req.body);
  await profile.save();
  await audit(req.user, 'faculty.update', 'faculty', profile._id, { verified: profile.verified });
  ok(res, { profile });
}

export async function deleteFaculty(req, res) {
  const id = assertObjectId(req.params.id);
  await FacultyProfile.deleteOne({ _id: id });
  await audit(req.user, 'faculty.delete', 'faculty', id);
  ok(res, { removed: true });
}
