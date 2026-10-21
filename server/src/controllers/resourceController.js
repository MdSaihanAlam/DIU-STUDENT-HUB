import { AcademicResource, PUBLIC_USER_FIELDS } from '../models/index.js';
import { env } from '../config/env.js';
import { isStaff } from '../middleware/auth.js';
import { DOCUMENT_EXTS, IMAGE_EXTS, extOf, inspectFile } from '../middleware/upload.js';
import { storage } from '../services/storage.js';
import { audit } from '../services/audit.js';
import { ApiError, assertObjectId, containsRegex, getPaging, ok, paginate } from '../utils/http.js';
import { isOwner, withSaved } from '../utils/viewer.js';

const RESOURCE_EXTS = [...DOCUMENT_EXTS, ...IMAGE_EXTS];
const PREVIEWABLE = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md']);

const sanitizeName = (name) =>
  name
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 120) || 'download';

export async function listResources(req, res) {
  const paging = getPaging(req.query, { defaultLimit: 12 });
  const q = req.query;
  const filter = {};
  if (q.mine === '1') {
    filter.uploader = req.user._id;
    filter.status = { $ne: 'removed' };
  } else {
    filter.status = 'approved';
  }
  if (q.department) filter.department = assertObjectId(q.department, 'department');
  if (q.resourceType) filter.resourceType = String(q.resourceType);
  if (q.semester) filter.semester = String(q.semester);
  if (q.courseCode) filter.courseCode = String(q.courseCode).toUpperCase().slice(0, 20);
  if (q.q) {
    const r = containsRegex(q.q);
    filter.$or = [{ title: r }, { courseCode: r }, { courseTitle: r }, { topic: r }, { description: r }];
  }
  const sort = { popular: { downloads: -1 }, rating: { ratingAvg: -1, ratingCount: -1 }, newest: { createdAt: -1 } }[q.sort] || { createdAt: -1 };
  const data = await paginate(AcademicResource, filter, paging, {
    sort,
    select: '-ratings -file.key',
    populate: [
      { path: 'uploader', select: 'name avatarUrl' },
      { path: 'department', select: 'name code' },
    ],
  });
  data.items = await withSaved(data.items, req.user, 'resource');
  ok(res, data);
}

export async function resourceFacets(req, res) {
  const [courseCodes, semesters] = await Promise.all([
    AcademicResource.distinct('courseCode', { status: 'approved' }),
    AcademicResource.distinct('semester', { status: 'approved' }),
  ]);
  ok(res, { courseCodes: courseCodes.filter(Boolean).sort(), semesters: semesters.filter(Boolean).sort() });
}

export async function createResource(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose a file to upload');
  const { ext, mime } = inspectFile(req.file, RESOURCE_EXTS);
  const key = await storage.save(req.file.buffer, { folder: 'resources', ext });
  const { rightsConfirmed, ...fields } = req.body; // eslint-disable-line no-unused-vars
  const autoApprove = !env.resourcesRequireApproval || isStaff(req.user);
  const resource = await AcademicResource.create({
    ...fields,
    file: { key, originalName: sanitizeName(req.file.originalname), mime, size: req.file.size },
    uploader: req.user._id,
    status: autoApprove ? 'approved' : 'pending',
  });
  ok(res, { resource, message: autoApprove ? 'Resource published.' : 'Thanks! Your upload will appear once a moderator reviews it.' }, 201);
}

async function loadVisible(req) {
  const resource = await AcademicResource.findById(assertObjectId(req.params.id))
    .populate('uploader', PUBLIC_USER_FIELDS)
    .populate('department', 'name code slug')
    .populate('ratings.user', 'name avatarUrl');
  if (!resource || resource.status === 'removed') throw ApiError.notFound('Resource not found');
  if (resource.status !== 'approved' && !isOwner(req.user, resource.uploader?._id) && !isStaff(req.user)) {
    throw ApiError.notFound('Resource not found');
  }
  return resource;
}

export async function getResource(req, res) {
  const resource = await loadVisible(req);
  const obj = resource.toObject();
  const [withFlag] = await withSaved([obj], req.user, 'resource');
  const myRating = obj.ratings.find((r) => r.user && String(r.user._id) === String(req.user._id));
  ok(res, {
    resource: {
      ...withFlag,
      file: { originalName: obj.file.originalName, mime: obj.file.mime, size: obj.file.size, ext: extOf(obj.file.originalName) },
      previewable: PREVIEWABLE.has(extOf(obj.file.originalName)),
      ratings: obj.ratings.slice(-20).reverse(),
      myRating: myRating ? { value: myRating.value, comment: myRating.comment } : null,
      mine: isOwner(req.user, obj.uploader?._id),
    },
  });
}

async function streamFile(req, res, disposition) {
  const resource = await loadVisible(req);
  if (!(await storage.exists(resource.file.key))) throw ApiError.notFound('The file is missing from storage');
  const ext = extOf(resource.file.originalName);
  if (disposition === 'inline' && !PREVIEWABLE.has(ext)) throw ApiError.badRequest('Preview is not available for this file type');
  if (disposition === 'attachment' && resource.status === 'approved') {
    await AcademicResource.updateOne({ _id: resource._id }, { $inc: { downloads: 1 } });
  }
  const type = ext === 'md' || ext === 'txt' ? 'text/plain; charset=utf-8' : resource.file.mime;
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(resource.file.originalName)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Previewed files may be framed by the SPA but never run scripts in our origin.
  // (Chrome refuses to render PDFs inside a CSP sandbox, so PDFs rely on the browser's isolated viewer.)
  const ancestors = `frame-ancestors 'self' ${env.clientOrigins.join(' ')}`;
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    ext === 'pdf' ? `default-src 'none'; object-src 'self'; ${ancestors}` : `sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; ${ancestors}`
  );
  res.setHeader('Cache-Control', 'private, max-age=300');
  storage.stream(resource.file.key).on('error', () => res.destroy()).pipe(res);
}

export const downloadResource = (req, res) => streamFile(req, res, 'attachment');
export const previewResource = (req, res) => streamFile(req, res, 'inline');

export async function rateResource(req, res) {
  const resource = await AcademicResource.findOne({ _id: assertObjectId(req.params.id), status: 'approved' });
  if (!resource) throw ApiError.notFound('Resource not found');
  if (isOwner(req.user, resource.uploader)) throw ApiError.badRequest('You cannot rate your own upload');
  const existing = resource.ratings.find((r) => String(r.user) === String(req.user._id));
  if (existing) {
    existing.value = req.body.value;
    existing.comment = req.body.comment;
    existing.createdAt = new Date();
  } else {
    resource.ratings.push({ user: req.user._id, value: req.body.value, comment: req.body.comment });
  }
  resource.ratingCount = resource.ratings.length;
  resource.ratingAvg = Math.round((resource.ratings.reduce((s, r) => s + r.value, 0) / resource.ratingCount) * 10) / 10;
  await resource.save();
  ok(res, { ratingAvg: resource.ratingAvg, ratingCount: resource.ratingCount });
}

export async function deleteResource(req, res) {
  const resource = await AcademicResource.findById(assertObjectId(req.params.id));
  if (!resource || resource.status === 'removed') throw ApiError.notFound('Resource not found');
  const owner = isOwner(req.user, resource.uploader);
  if (!owner && !isStaff(req.user)) throw ApiError.forbidden();
  resource.status = 'removed';
  await resource.save();
  await storage.remove(resource.file.key);
  if (!owner) await audit(req.user, 'resource.remove', 'resource', resource._id);
  ok(res, { removed: true });
}
