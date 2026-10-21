import { PUBLIC_USER_FIELDS, ResearchProject } from '../models/index.js';
import { isStaff } from '../middleware/auth.js';
import { IMAGE_EXTS, inspectFile } from '../middleware/upload.js';
import { storage, publicFileUrl } from '../services/storage.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { startOrContinueConversation } from './messageController.js';
import { ApiError, assertObjectId, containsRegex, getPaging, isObjectId, ok, paginate } from '../utils/http.js';
import { isOwner, sameId, withSaved } from '../utils/viewer.js';

/** Only the submitting user may be linked to an account; other contributors are listed by name. */
const sanitizeContributors = (contributors, user) =>
  contributors?.map((c) => ({ name: c.name, role: c.role, user: c.user && sameId(c.user, user._id) ? user._id : undefined }));

const canEdit = (user, project) =>
  isStaff(user) || isOwner(user, project.lead?._id || project.lead) || project.contributors?.some((c) => c.user && sameId(c.user._id || c.user, user._id));

export async function listResearch(req, res) {
  const q = req.query;
  const paging = getPaging(q, { defaultLimit: 12 });
  let filter;
  if (q.mine === '1') {
    filter = { $or: [{ lead: req.user._id }, { 'contributors.user': req.user._id }] };
  } else if (q.verified === '0') {
    // Include community submissions awaiting review, clearly labeled in the UI.
    filter = { reviewStatus: { $in: ['verified', 'pending'] } };
  } else {
    filter = { reviewStatus: 'verified' };
  }
  if (q.department) filter.department = assertObjectId(q.department, 'department');
  if (q.domain) filter.domain = containsRegex(q.domain);
  if (q.status) filter.status = String(q.status);
  if (q.featured === '1') filter.featured = true;
  if (q.collab === '1') filter.collaborationOpen = true;
  if (q.contributor && isObjectId(q.contributor)) filter.$and = [{ $or: [{ lead: q.contributor }, { 'contributors.user': q.contributor }] }];
  if (q.q) {
    const r = containsRegex(q.q);
    (filter.$and ||= []).push({ $or: [{ title: r }, { abstract: r }, { domain: r }, { technologies: r }, { 'contributors.name': r }] });
  }
  const data = await paginate(ResearchProject, filter, paging, {
    sort: { featured: -1, updatedAt: -1 },
    select: 'title abstract domain department status lead affiliation technologies reviewStatus featured collaborationOpen followers startDate isDemo',
    populate: [
      { path: 'lead', select: 'name avatarUrl' },
      { path: 'department', select: 'name code' },
    ],
  });
  data.items = (await withSaved(data.items, req.user, 'research')).map(({ followers, abstract, ...p }) => ({
    ...p,
    abstract: abstract?.slice(0, 260),
    followerCount: followers?.length || 0,
    following: followers?.some((f) => sameId(f, req.user._id)),
  }));
  ok(res, data);
}

export async function researchDomains(req, res) {
  const domains = await ResearchProject.distinct('domain', { reviewStatus: 'verified' });
  ok(res, { items: domains.sort() });
}

export async function getResearch(req, res) {
  const project = await ResearchProject.findById(assertObjectId(req.params.id))
    .populate('lead', PUBLIC_USER_FIELDS)
    .populate('contributors.user', 'name avatarUrl')
    .populate('supervisor', 'name designation')
    .populate('department', 'name code slug')
    .populate('updates.author', 'name avatarUrl')
    .lean();
  if (!project) throw ApiError.notFound('Project not found');
  const editable = canEdit(req.user, project);
  if (project.reviewStatus === 'rejected' && !editable) throw ApiError.notFound('Project not found');
  const { followers, ...rest } = project;
  const [withFlag] = await withSaved([rest], req.user, 'research');
  ok(res, {
    project: {
      ...withFlag,
      updates: [...(project.updates || [])].reverse(),
      followerCount: followers?.length || 0,
      following: followers?.some((f) => sameId(f, req.user._id)),
      editable,
      isLead: isOwner(req.user, project.lead?._id),
    },
  });
}

export async function createResearch(req, res) {
  const project = await ResearchProject.create({
    ...req.body,
    contributors: sanitizeContributors(req.body.contributors, req.user) || [{ user: req.user._id, name: req.user.name, role: 'Lead' }],
    lead: req.user._id,
    reviewStatus: isStaff(req.user) ? 'verified' : 'pending',
    featured: false,
  });
  ok(res, { project, message: project.reviewStatus === 'verified' ? 'Project published.' : 'Submitted for review. It is visible as an unverified submission until moderators verify it.' }, 201);
}

export async function updateResearch(req, res) {
  const project = await ResearchProject.findById(assertObjectId(req.params.id));
  if (!project) throw ApiError.notFound('Project not found');
  if (!canEdit(req.user, project)) throw ApiError.forbidden('Only the project team can edit this project');
  const { contributors, ...rest } = req.body;
  Object.assign(project, rest);
  if (contributors) {
    // Keep existing account links (e.g. the lead) for contributors whose name is unchanged.
    const linked = new Map(project.contributors.filter((c) => c.user).map((c) => [c.name, c.user]));
    project.contributors = sanitizeContributors(contributors, req.user).map((c) => ({ ...c, user: c.user || linked.get(c.name) }));
  }
  // Changing claims about results/publications sends a verified project back to review.
  if (!isStaff(req.user) && project.reviewStatus === 'verified' && (req.body.links || req.body.status === 'published')) {
    project.reviewStatus = 'pending';
  }
  await project.save();
  ok(res, { project });
}

export async function deleteResearch(req, res) {
  const project = await ResearchProject.findById(assertObjectId(req.params.id));
  if (!project) throw ApiError.notFound('Project not found');
  const lead = isOwner(req.user, project.lead);
  if (!lead && !isStaff(req.user)) throw ApiError.forbidden();
  await Promise.all((project.files || []).map((f) => storage.remove(f.url.replace('/api/v1/files/', ''))));
  await project.deleteOne();
  if (!lead) await audit(req.user, 'research.delete', 'research', project._id);
  ok(res, { removed: true });
}

export async function toggleFollow(req, res) {
  const project = await ResearchProject.findOne({ _id: assertObjectId(req.params.id), reviewStatus: { $ne: 'rejected' } }).select('followers');
  if (!project) throw ApiError.notFound('Project not found');
  const following = project.followers.some((f) => sameId(f, req.user._id));
  await ResearchProject.updateOne({ _id: project._id }, following ? { $pull: { followers: req.user._id } } : { $addToSet: { followers: req.user._id } });
  ok(res, { following: !following, followerCount: project.followers.length + (following ? -1 : 1) });
}

export async function addUpdate(req, res) {
  const project = await ResearchProject.findById(assertObjectId(req.params.id));
  if (!project) throw ApiError.notFound('Project not found');
  if (!canEdit(req.user, project)) throw ApiError.forbidden('Only the project team can post updates');
  project.updates.push({ author: req.user._id, content: req.body.content });
  await project.save();
  await Promise.all(
    project.followers.map((f) => notify({ user: f, type: 'research_collaboration', actor: req.user._id, message: `New update on "${project.title}"`, link: `/research/${project._id}` }))
  );
  ok(res, { update: project.updates.at(-1) }, 201);
}

export async function uploadResearchFile(req, res) {
  const project = await ResearchProject.findById(assertObjectId(req.params.id));
  if (!project) throw ApiError.notFound('Project not found');
  if (!canEdit(req.user, project)) throw ApiError.forbidden();
  if (!req.file) throw ApiError.badRequest('Choose a file');
  if ((project.files || []).length >= 5) throw ApiError.badRequest('A project can have up to 5 files');
  const { ext, kind } = inspectFile(req.file, ['pdf', 'pptx', 'docx', ...IMAGE_EXTS]);
  const key = await storage.save(req.file.buffer, { folder: kind === 'image' ? 'images' : 'attachments', ext });
  project.files.push({ url: publicFileUrl(key), name: req.file.originalname.slice(0, 120), mime: req.file.mimetype, size: req.file.size });
  await project.save();
  ok(res, { files: project.files }, 201);
}

export async function requestCollaboration(req, res) {
  const project = await ResearchProject.findOne({ _id: assertObjectId(req.params.id), reviewStatus: { $ne: 'rejected' } });
  if (!project) throw ApiError.notFound('Project not found');
  if (!project.collaborationOpen) throw ApiError.badRequest('This project is not looking for collaborators right now');
  if (isOwner(req.user, project.lead)) throw ApiError.badRequest('You lead this project');
  const conversation = await startOrContinueConversation({
    from: req.user,
    toId: project.lead,
    body: req.body.message,
    context: `Research: ${project.title}`.slice(0, 140),
    bypassConnectionsRule: true,
  });
  await notify({ user: project.lead, type: 'research_collaboration', actor: req.user._id, message: `${req.user.name} wants to collaborate on "${project.title}"`, link: `/messages/${conversation._id}` });
  ok(res, { conversationId: conversation._id }, 201);
}
