import { AlumniProfile, PUBLIC_USER_FIELDS, User } from '../models/index.js';
import { ApiError, assertObjectId, containsRegex, getPaging, ok } from '../utils/http.js';
import { sameId } from '../utils/viewer.js';

const strip = (profile, viewer) => {
  const p = { ...profile };
  if (!p.shareContact && !sameId(p.user?._id, viewer._id)) delete p.contactEmail;
  return p;
};

export async function listAlumni(req, res) {
  const q = req.query;
  const { page, limit, skip } = getPaging(q, { defaultLimit: 12 });
  const activeUsers = User.find({ status: 'active', _id: { $nin: req.user.blocked } }).distinct('_id');
  const filter = { visibility: 'members', user: { $in: await activeUsers } };
  if (q.department) filter.department = assertObjectId(q.department, 'department');
  if (q.year) filter.graduationYear = Number(q.year) || undefined;
  if (q.industry) filter.industry = containsRegex(q.industry);
  if (q.employer) filter.employer = containsRegex(q.employer);
  if (q.role) filter.jobTitle = containsRegex(q.role);
  if (q.mentorship === '1') filter.mentorshipAvailable = true;
  if (q.q) {
    const r = containsRegex(q.q);
    filter.$or = [{ jobTitle: r }, { employer: r }, { industry: r }, { skills: r }];
  }
  if (filter.graduationYear === undefined) delete filter.graduationYear;
  const [items, total] = await Promise.all([
    AlumniProfile.find(filter)
      .sort({ mentorshipAvailable: -1, graduationYear: -1 })
      .skip(skip)
      .limit(limit)
      .select('-careerJourney -advice -successStory.body')
      .populate('user', PUBLIC_USER_FIELDS)
      .populate('department', 'name code')
      .lean(),
    AlumniProfile.countDocuments(filter),
  ]);
  ok(res, { items: items.map((i) => strip(i, req.user)), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), hasMore: skip + items.length < total });
}

export async function alumniFacets(req, res) {
  const [industries, years] = await Promise.all([
    AlumniProfile.distinct('industry', { visibility: 'members' }),
    AlumniProfile.distinct('graduationYear', { visibility: 'members' }),
  ]);
  ok(res, { industries: industries.filter(Boolean).sort(), years: years.filter(Boolean).sort((a, b) => b - a) });
}

export async function successStories(req, res) {
  const stories = await AlumniProfile.find({ visibility: 'members', 'successStory.body': { $exists: true, $ne: '' } })
    .sort({ 'successStory.featured': -1, updatedAt: -1 })
    .limit(Math.min(20, Number(req.query.limit) || 6))
    .select('user jobTitle employer graduationYear department successStory')
    .populate('user', 'name avatarUrl affiliationVerified')
    .populate('department', 'name code')
    .lean();
  ok(res, { items: stories });
}

export async function myAlumniProfile(req, res) {
  const profile = await AlumniProfile.findOne({ user: req.user._id }).lean();
  ok(res, { profile });
}

export async function upsertAlumniProfile(req, res) {
  if (req.user.affiliation !== 'alumni') throw ApiError.forbidden('Alumni profiles are for members whose affiliation is alumni. Request alumni verification first.');
  const { successStory, ...rest } = req.body;
  const update = { ...rest, department: rest.department || req.user.department };
  if (successStory) {
    update['successStory.title'] = successStory.title;
    update['successStory.body'] = successStory.body;
  }
  const profile = await AlumniProfile.findOneAndUpdate({ user: req.user._id }, { $set: update, $setOnInsert: { user: req.user._id } }, { new: true, upsert: true, runValidators: true }).lean();
  ok(res, { profile });
}

export async function getAlumni(req, res) {
  const profile = await AlumniProfile.findById(assertObjectId(req.params.id)).populate('user', PUBLIC_USER_FIELDS).populate('department', 'name code').lean();
  if (!profile || (profile.visibility === 'hidden' && !sameId(profile.user?._id, req.user._id))) throw ApiError.notFound('Profile not found');
  ok(res, { profile: strip(profile, req.user) });
}
