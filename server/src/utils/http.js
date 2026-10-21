export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(msg = 'Bad request', details) {
    return new ApiError(400, msg, details);
  }
  static unauthorized(msg = 'Please sign in to continue') {
    return new ApiError(401, msg);
  }
  static forbidden(msg = 'You do not have permission to do that') {
    return new ApiError(403, msg);
  }
  static notFound(msg = 'Not found') {
    return new ApiError(404, msg);
  }
  static conflict(msg = 'Conflict') {
    return new ApiError(409, msg);
  }
}

/** Wrap an async route handler so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Escape user text before using it inside a RegExp. */
export const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive "contains" regex built safely from user input. */
export const containsRegex = (s) => new RegExp(escapeRegex(String(s).slice(0, 100)), 'i');

/** Parse ?page & ?limit with sane bounds. */
export function getPaging(query, { defaultLimit = 12, maxLimit = 50 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Run a paginated query on a model and return a consistent list payload. */
export async function paginate(model, filter, { page, limit, skip }, { sort = { createdAt: -1 }, populate, select, lean = true } = {}) {
  let q = model.find(filter).sort(sort).skip(skip).limit(limit);
  if (select) q = q.select(select);
  if (populate) [].concat(populate).forEach((p) => (q = q.populate(p)));
  if (lean) q = q.lean();
  const [items, total] = await Promise.all([q, model.countDocuments(filter)]);
  return { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), hasMore: skip + items.length < total };
}

export const ok = (res, data, status = 200) => res.status(status).json({ ok: true, data });

export function isObjectId(id) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

export function assertObjectId(id, label = 'id') {
  if (!isObjectId(id)) throw ApiError.badRequest(`Invalid ${label}`);
  return id;
}

export const splitList = (v) =>
  (Array.isArray(v) ? v : String(v || '').split(','))
    .map((s) => String(s).trim())
    .filter(Boolean);
