import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { extOf } from '../middleware/upload.js';
import { storage } from '../services/storage.js';
import { ApiError, asyncHandler } from '../utils/http.js';

const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
const DOC_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword',
  ppt: 'application/vnd.ms-powerpoint',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
};

const r = Router();

// Folders that hold user uploads served by URL. Resource files are NOT here: they go
// through /resources/:id/download so visibility rules apply.
const PUBLIC_FOLDERS = new Set(['avatars']);
const MEMBER_FOLDERS = new Set(['images', 'housing', 'attachments']);

async function serve(req, res) {
  const { folder, file } = req.params;
  const key = `${folder}/${file}`;
  const ext = extOf(file);
  const type = IMAGE_TYPES[ext] || (folder === 'attachments' ? DOC_TYPES[ext] : null);
  if (!type || !(await storage.exists(key).catch(() => false))) throw ApiError.notFound('File not found');
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', PUBLIC_FOLDERS.has(folder) ? 'public, max-age=86400' : 'private, max-age=3600');
  if (!IMAGE_TYPES[ext]) res.setHeader('Content-Disposition', 'attachment');
  storage.stream(key).on('error', () => res.destroy()).pipe(res);
}

r.get('/:folder/:file', (req, res, next) => {
  const { folder } = req.params;
  if (PUBLIC_FOLDERS.has(folder)) return asyncHandler(serve)(req, res, next);
  if (MEMBER_FOLDERS.has(folder)) return requireAuth(req, res, (err) => (err ? next(err) : asyncHandler(serve)(req, res, next)));
  next(ApiError.notFound('File not found'));
});

export default r;
