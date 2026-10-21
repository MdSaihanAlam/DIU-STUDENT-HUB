import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/http.js';

export const AUTH_COOKIE = 'hub_token';

export function cookieOptions(extra = {}) {
  return {
    httpOnly: true,
    secure: env.isProd || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    path: '/',
    ...extra,
  };
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), v: user.tokenVersion }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
  res.cookie(AUTH_COOKIE, token, cookieOptions({ maxAge: 7 * 24 * 60 * 60 * 1000 }));
}

export function clearSession(res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
}

async function resolveUser(req) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.v) return null;
  if (user.status === 'deleted' || user.status === 'suspended') return null;
  return user;
}

/** Attach req.user when a valid session exists; never fails. */
export async function optionalAuth(req, res, next) {
  try {
    req.user = await resolveUser(req);
    next();
  } catch (err) {
    next(err);
  }
}

/** Require a valid session. */
export async function requireAuth(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      if (req.cookies?.[AUTH_COOKIE]) clearSession(res);
      throw ApiError.unauthorized();
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Require a platform role: requireRole('admin') or requireRole('moderator', 'admin'). */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };

export const requireStaff = requireRole('moderator', 'admin');

export const isStaff = (user) => !!user && (user.role === 'admin' || user.role === 'moderator');

/** Verified faculty or staff may publish "official" content. */
export const canPublishOfficial = (user) =>
  isStaff(user) || (user?.affiliation === 'faculty' && user?.affiliationVerified);
