import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';

// Allowed file types, keyed by extension, with the MIME types browsers commonly send
// and a magic-byte signature check (where the format has one).
const TYPES = {
  jpg: { mimes: ['image/jpeg'], sig: [[0xff, 0xd8, 0xff]], kind: 'image' },
  jpeg: { mimes: ['image/jpeg'], sig: [[0xff, 0xd8, 0xff]], kind: 'image' },
  png: { mimes: ['image/png'], sig: [[0x89, 0x50, 0x4e, 0x47]], kind: 'image' },
  gif: { mimes: ['image/gif'], sig: [[0x47, 0x49, 0x46, 0x38]], kind: 'image' },
  webp: { mimes: ['image/webp'], sig: [[0x52, 0x49, 0x46, 0x46]], kind: 'image' },
  pdf: { mimes: ['application/pdf'], sig: [[0x25, 0x50, 0x44, 0x46]], kind: 'document' },
  docx: { mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], sig: [[0x50, 0x4b, 0x03, 0x04]], kind: 'document' },
  pptx: { mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], sig: [[0x50, 0x4b, 0x03, 0x04]], kind: 'document' },
  xlsx: { mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], sig: [[0x50, 0x4b, 0x03, 0x04]], kind: 'document' },
  doc: { mimes: ['application/msword'], sig: [[0xd0, 0xcf, 0x11, 0xe0]], kind: 'document' },
  ppt: { mimes: ['application/vnd.ms-powerpoint'], sig: [[0xd0, 0xcf, 0x11, 0xe0]], kind: 'document' },
  txt: { mimes: ['text/plain'], sig: null, kind: 'document' },
  md: { mimes: ['text/markdown', 'text/plain', 'application/octet-stream'], sig: null, kind: 'document' },
};

export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
export const DOCUMENT_EXTS = ['pdf', 'docx', 'pptx', 'xlsx', 'doc', 'ppt', 'txt', 'md'];

export const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

/** Verify a buffered upload's extension, declared MIME type and leading bytes agree. */
export function inspectFile(file, allowedExts) {
  const ext = extOf(file.originalname);
  const type = TYPES[ext];
  if (!type || !allowedExts.includes(ext)) {
    throw ApiError.badRequest(`Unsupported file type ".${ext || '?'}". Allowed: ${allowedExts.join(', ')}`);
  }
  if (!type.mimes.includes(file.mimetype) && file.mimetype !== 'application/octet-stream') {
    throw ApiError.badRequest('File type does not match its extension');
  }
  if (type.sig) {
    const matches = type.sig.some((sig) => sig.every((byte, i) => file.buffer[i] === byte));
    if (!matches) throw ApiError.badRequest('File content does not match its type');
  } else if (file.buffer.subarray(0, 4096).includes(0)) {
    throw ApiError.badRequest('Text file contains binary data');
  }
  return { ext, kind: type.kind, mime: type.mimes[0] };
}

const memory = multer.memoryStorage();

export const uploadSingle = (field, { maxBytes = env.maxUploadBytes } = {}) =>
  multer({ storage: memory, limits: { fileSize: maxBytes, files: 1 } }).single(field);

export const uploadMany = (field, max = 6, { maxBytes = 5 * 1024 * 1024 } = {}) =>
  multer({ storage: memory, limits: { fileSize: maxBytes, files: max } }).array(field, max);
