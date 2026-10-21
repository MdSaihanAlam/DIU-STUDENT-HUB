import {
  AcademicResource,
  AlumniProfile,
  CareerOpportunity,
  Community,
  CommunityMembership,
  Department,
  Event,
  HousingListing,
  Notification,
  Post,
  PUBLIC_USER_FIELDS,
  ResearchProject,
  User,
  VerificationRequest,
} from '../models/index.js';
import { ApiError, assertObjectId, containsRegex, getPaging, ok, paginate } from '../utils/http.js';

// ---------- Notifications ----------
export async function listNotifications(req, res) {
  const paging = getPaging(req.query, { defaultLimit: 20 });
  const filter = { user: req.user._id, ...(req.query.unread === '1' ? { read: false } : {}) };
  const data = await paginate(Notification, filter, paging, { populate: { path: 'actor', select: 'name avatarUrl' } });
  ok(res, data);
}

export async function notificationCount(req, res) {
  ok(res, { count: await Notification.countDocuments({ user: req.user._id, read: false }) });
}

export async function markRead(req, res) {
  await Notification.updateOne({ _id: assertObjectId(req.params.id), user: req.user._id }, { read: true });
  ok(res, { read: true });
}

export async function markAllRead(req, res) {
  const r = await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  ok(res, { updated: r.modifiedCount });
}

// ---------- Global search ----------
const SEARCHERS = {
  posts: async (r, user, hidden) => ({
    model: Post,
    filter: { status: 'active', content: r, author: { $nin: user.blocked }, ...(hidden.length ? { community: { $nin: hidden } } : {}) },
    select: 'content type author createdAt reactionCount commentCount',
    populate: { path: 'author', select: 'name avatarUrl' },
  }),
  people: async (r, user) => ({
    model: User,
    filter: { status: 'active', 'privacy.profileVisibility': { $ne: 'private' }, _id: { $nin: user.blocked }, $or: [{ name: r }, { headline: r }, { skills: r }] },
    select: PUBLIC_USER_FIELDS,
    populate: { path: 'department', select: 'name code' },
    sort: { affiliationVerified: -1, name: 1 },
  }),
  resources: async (r) => ({
    model: AcademicResource,
    filter: { status: 'approved', $or: [{ title: r }, { courseCode: r }, { courseTitle: r }, { topic: r }] },
    select: 'title courseCode resourceType downloads ratingAvg createdAt',
  }),
  research: async (r) => ({
    model: ResearchProject,
    filter: { reviewStatus: 'verified', $or: [{ title: r }, { abstract: r }, { domain: r }, { technologies: r }] },
    select: 'title domain status featured',
  }),
  alumni: async (r) => ({
    model: AlumniProfile,
    filter: { visibility: 'members', $or: [{ jobTitle: r }, { employer: r }, { industry: r }, { skills: r }] },
    select: 'user jobTitle employer graduationYear industry',
    populate: { path: 'user', select: 'name avatarUrl status' },
  }),
  events: async (r) => ({
    model: Event,
    filter: { reviewStatus: 'approved', $or: [{ title: r }, { organizer: r }, { venue: r }] },
    select: 'title startsAt venue category official',
    sort: { startsAt: -1 },
  }),
  housing: async (r) => ({
    model: HousingListing,
    filter: { status: 'active', $or: [{ title: r }, { area: r }, { description: r }] },
    select: 'title rent area type',
  }),
  careers: async (r) => ({
    model: CareerOpportunity,
    filter: { reviewStatus: 'approved', $or: [{ title: r }, { organization: r }, { tags: r }] },
    select: 'title organization type deadline verified',
    sort: { deadline: 1 },
  }),
  communities: async (r) => ({
    model: Community,
    filter: { status: 'active', $or: [{ name: r }, { description: r }] },
    select: 'name slug type memberCount visibility',
    sort: { memberCount: -1 },
  }),
};

export async function search(req, res) {
  const term = String(req.query.q || '').trim();
  if (term.length < 2) throw ApiError.badRequest('Type at least 2 characters to search');
  const r = containsRegex(term);
  const type = req.query.type || 'all';
  const privateIds = await Community.find({ visibility: 'private' }).distinct('_id');
  const mine = await CommunityMembership.find({ user: req.user._id, status: 'active' }).distinct('community');
  const hidden = privateIds.filter((id) => !mine.some((m) => String(m) === String(id)));

  const run = async (key, paging) => {
    const cfg = await SEARCHERS[key](r, req.user, hidden);
    const data = await paginate(cfg.model, cfg.filter, paging, { select: cfg.select, populate: cfg.populate, sort: cfg.sort || { createdAt: -1 } });
    if (key === 'alumni') data.items = data.items.filter((a) => a.user?.status === 'active');
    return data;
  };

  if (type !== 'all') {
    if (!SEARCHERS[type]) throw ApiError.badRequest('Unknown search category');
    return ok(res, { type, results: await run(type, getPaging(req.query, { defaultLimit: 15 })) });
  }
  const entries = await Promise.all(Object.keys(SEARCHERS).map(async (k) => [k, await run(k, { page: 1, limit: 4, skip: 0 })]));
  ok(res, { type: 'all', groups: Object.fromEntries(entries.map(([k, v]) => [k, { items: v.items, total: v.total }])) });
}

// ---------- Verification requests ----------
export async function requestVerification(req, res) {
  if (await VerificationRequest.exists({ user: req.user._id, status: 'pending' })) throw ApiError.conflict('You already have a pending verification request');
  if (req.user.affiliationVerified && req.user.affiliation === req.body.requestedAffiliation) throw ApiError.badRequest('You are already verified for this affiliation');
  const request = await VerificationRequest.create({ user: req.user._id, ...req.body });
  ok(res, { request, message: 'Request submitted. A moderator will review it.' }, 201);
}

export async function myVerification(req, res) {
  const items = await VerificationRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5).lean();
  ok(res, { items });
}

// ---------- Public (signed-out) endpoints for the landing page ----------
export async function publicHighlights(req, res) {
  const now = new Date();
  const [counts, research, events, stories, announcements, topics] = await Promise.all([
    Promise.all([
      User.countDocuments({ status: 'active' }),
      AcademicResource.countDocuments({ status: 'approved' }),
      ResearchProject.countDocuments({ reviewStatus: 'verified' }),
      Community.countDocuments({ status: 'active' }),
      HousingListing.countDocuments({ status: 'active' }),
    ]),
    ResearchProject.find({ reviewStatus: 'verified', featured: true }).sort({ updatedAt: -1 }).limit(3).select('title domain status abstract isDemo').lean(),
    Event.find({ reviewStatus: 'approved', startsAt: { $gte: now } }).sort({ startsAt: 1 }).limit(4).select('title startsAt venue category official organizer isDemo').lean(),
    AlumniProfile.find({ visibility: 'members', 'successStory.featured': true })
      .limit(3)
      .select('user jobTitle employer graduationYear successStory isDemo')
      .populate('user', 'name avatarUrl')
      .lean(),
    // Only official announcements are shown publicly; member posts stay behind sign-in.
    Post.find({ status: 'active', official: true, community: null }).sort({ createdAt: -1 }).limit(3).select('content createdAt type isDemo').lean(),
    Post.aggregate([
      { $match: { status: 'active', community: null, createdAt: { $gte: new Date(+now - 30 * 864e5) } } },
      { $unwind: '$hashtags' },
      { $group: { _id: '$hashtags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);
  ok(res, {
    counts: { members: counts[0], resources: counts[1], research: counts[2], communities: counts[3], housing: counts[4] },
    research,
    events,
    stories: stories.map((s) => ({ ...s, successStory: { title: s.successStory?.title, excerpt: s.successStory?.body?.slice(0, 220) } })),
    announcements,
    topics: topics.map((t) => ({ tag: t._id, count: t.count })),
  });
}

export async function publicSearch(req, res) {
  const term = String(req.query.q || '').trim();
  if (term.length < 2) return ok(res, { resources: [], communities: [] });
  const r = containsRegex(term);
  const [resources, communities] = await Promise.all([
    AcademicResource.find({ status: 'approved', $or: [{ title: r }, { courseCode: r }, { courseTitle: r }] }).limit(6).select('title courseCode resourceType').lean(),
    Community.find({ status: 'active', visibility: 'public', $or: [{ name: r }, { description: r }] }).limit(6).select('name slug type memberCount').lean(),
  ]);
  ok(res, { resources, communities });
}

export async function publicDepartments(req, res) {
  ok(res, { items: await Department.find().sort({ name: 1 }).select('name code slug').lean() });
}
