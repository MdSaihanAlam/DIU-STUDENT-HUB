import { Community, Department, Event, FacultyProfile, Post, ResearchProject, User } from '../models/index.js';
import { ApiError, assertObjectId, containsRegex, getPaging, ok, paginate } from '../utils/http.js';

export async function listDepartments(req, res) {
  const departments = await Department.find().sort({ name: 1 }).lean();
  const [faculty, students, research] = await Promise.all([
    FacultyProfile.aggregate([{ $group: { _id: '$department', n: { $sum: 1 } } }]),
    User.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$department', n: { $sum: 1 } } }]),
    ResearchProject.aggregate([{ $match: { reviewStatus: 'verified' } }, { $group: { _id: '$department', n: { $sum: 1 } } }]),
  ]);
  const count = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
  const [f, s, r] = [count(faculty), count(students), count(research)];
  ok(res, {
    items: departments.map((d) => ({
      ...d,
      counts: { faculty: f.get(String(d._id)) || 0, members: s.get(String(d._id)) || 0, research: r.get(String(d._id)) || 0 },
    })),
  });
}

export async function getDepartment(req, res) {
  const department = await Department.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
  if (!department) throw ApiError.notFound('Department not found');
  const now = new Date();
  const [faculty, communities, research, announcements, events] = await Promise.all([
    FacultyProfile.find({ department: department._id }).sort({ verified: -1, name: 1 }).select('name designation designationVerified photoUrl researchInterests verified isDemo').lean(),
    Community.find({ department: department._id, status: 'active' }).sort({ memberCount: -1 }).limit(8).select('name slug type memberCount visibility').lean(),
    ResearchProject.find({ department: department._id, reviewStatus: 'verified' }).sort({ featured: -1, createdAt: -1 }).limit(6).select('title domain status featured').lean(),
    Post.find({ department: department._id, type: 'announcement', status: 'active' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('content official createdAt author')
      .populate('author', 'name')
      .lean(),
    Event.find({ department: department._id, reviewStatus: 'approved', startsAt: { $gte: now } }).sort({ startsAt: 1 }).limit(5).select('title startsAt venue official').lean(),
  ]);
  ok(res, { department, faculty, communities, research, announcements, events });
}

export async function listFaculty(req, res) {
  const paging = getPaging(req.query, { defaultLimit: 18 });
  const filter = {};
  if (req.query.department) filter.department = assertObjectId(req.query.department, 'department');
  if (req.query.q) {
    const r = containsRegex(req.query.q);
    filter.$or = [{ name: r }, { researchInterests: r }, { designation: r }];
  }
  const data = await paginate(FacultyProfile, filter, paging, {
    sort: { verified: -1, name: 1 },
    select: 'name designation designationVerified department photoUrl researchInterests verified isDemo',
    populate: { path: 'department', select: 'name code slug' },
  });
  ok(res, data);
}

export async function getFaculty(req, res) {
  const profile = await FacultyProfile.findById(assertObjectId(req.params.id)).populate('department', 'name code slug').populate('user', 'name avatarUrl').lean();
  if (!profile) throw ApiError.notFound('Faculty profile not found');
  const supervised = await ResearchProject.find({ supervisor: profile._id, reviewStatus: 'verified' }).select('title domain status').limit(20).lean();
  ok(res, { profile: { ...profile, mine: profile.user && String(profile.user._id) === String(req.user._id) }, supervised });
}

/** A verified faculty member may maintain the directory entry linked to their account. */
export async function updateOwnFaculty(req, res) {
  const profile = await FacultyProfile.findById(assertObjectId(req.params.id));
  if (!profile) throw ApiError.notFound('Faculty profile not found');
  const linked = profile.user && String(profile.user) === String(req.user._id);
  if (!linked || req.user.affiliation !== 'faculty' || !req.user.affiliationVerified) throw ApiError.forbidden('Only the verified owner can edit this profile');
  // Owners cannot self-verify designation or change department; those stay admin-controlled.
  const { designationVerified, verified, department, user, isDemo, ...rest } = req.body; // eslint-disable-line no-unused-vars
  Object.assign(profile, rest);
  await profile.save();
  ok(res, { profile });
}
