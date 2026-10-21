import {
  AcademicResource,
  Bookmark,
  CareerOpportunity,
  Comment,
  Community,
  Event,
  HousingListing,
  Message,
  Post,
  PUBLIC_USER_FIELDS,
  Report,
  ResearchProject,
  User,
} from '../models/index.js';
import { ApiError, getPaging, ok } from '../utils/http.js';

/** Model + "is visible" filter for each bookmarkable/reportable type. */
export const TARGETS = {
  post: { model: Post, visible: { status: 'active' } },
  comment: { model: Comment, visible: { status: 'active' } },
  resource: { model: AcademicResource, visible: { status: 'approved' } },
  housing: { model: HousingListing, visible: { status: { $in: ['active', 'rented'] } } },
  research: { model: ResearchProject, visible: { reviewStatus: { $ne: 'rejected' } } },
  career: { model: CareerOpportunity, visible: { reviewStatus: 'approved' } },
  event: { model: Event, visible: { reviewStatus: 'approved' } },
  user: { model: User, visible: { status: 'active' } },
  community: { model: Community, visible: { status: 'active' } },
  message: { model: Message, visible: {} },
};

export async function toggleBookmark(req, res) {
  const { targetType, targetId } = req.body;
  const t = TARGETS[targetType];
  if (!(await t.model.exists({ _id: targetId, ...t.visible }))) throw ApiError.notFound('That item is no longer available');
  const removed = await Bookmark.findOneAndDelete({ user: req.user._id, targetType, targetId });
  if (removed) return ok(res, { saved: false });
  try {
    await Bookmark.create({ user: req.user._id, targetType, targetId });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  ok(res, { saved: true });
}

const SAVED_SELECT = {
  post: { select: 'content type author createdAt', populate: { path: 'author', select: PUBLIC_USER_FIELDS } },
  resource: { select: 'title courseCode resourceType file.mime file.size downloads createdAt' },
  housing: { select: 'title rent area type status photos' },
  research: { select: 'title domain status reviewStatus' },
  career: { select: 'title organization type deadline verified' },
  event: { select: 'title startsAt venue category official' },
};

export async function listBookmarks(req, res) {
  const type = SAVED_SELECT[req.query.type] ? req.query.type : null;
  const { page, limit, skip } = getPaging(req.query, { defaultLimit: 20 });
  const filter = { user: req.user._id, ...(type ? { targetType: type } : {}) };
  const [marks, total] = await Promise.all([Bookmark.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Bookmark.countDocuments(filter)]);

  // One query per type (not per bookmark) to avoid N+1 lookups.
  const byType = {};
  marks.forEach((m) => (byType[m.targetType] ||= []).push(m.targetId));
  const found = new Map();
  await Promise.all(
    Object.entries(byType).map(async ([t, ids]) => {
      const cfg = SAVED_SELECT[t];
      if (!cfg) return;
      let q = TARGETS[t].model.find({ _id: { $in: ids }, ...TARGETS[t].visible }).select(cfg.select);
      if (cfg.populate) q = q.populate(cfg.populate);
      (await q.lean()).forEach((doc) => found.set(`${t}:${doc._id}`, doc));
    })
  );
  const items = marks.map((m) => ({ _id: m._id, targetType: m.targetType, savedAt: m.createdAt, item: found.get(`${m.targetType}:${m.targetId}`) || null }));
  ok(res, { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), hasMore: skip + marks.length < total });
}

export async function createReport(req, res) {
  const { targetType, targetId, reason, details, takedown } = req.body;
  const t = TARGETS[targetType];
  if (!(await t.model.exists({ _id: targetId }))) throw ApiError.notFound('That item no longer exists');
  const dup = await Report.exists({ reporter: req.user._id, targetType, targetId, status: 'open' });
  if (dup) return ok(res, { message: 'You already reported this. Our moderators will review it.' });
  await Report.create({ reporter: req.user._id, targetType, targetId, reason, details, takedown: reason === 'copyright' ? takedown : undefined });
  ok(res, { message: 'Thanks for reporting. Moderators will review it.' }, 201);
}
