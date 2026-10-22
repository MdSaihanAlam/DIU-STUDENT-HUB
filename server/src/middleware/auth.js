import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/http.js';

export const SECURE_COOKIES = env.isProd || env.cookieSameSite === 'none';
// "__Host-" cookies must be Secure, path=/ and host-only, so subdomains cannot overwrite them.
export const AUTH_COOKIE = SECURE_COOKIES ? '__Host-hub_token' : 'hub_token';

const JWT_OPTS = { algorithm: 'HS256', issuer: 'diu-student-hub', audience: 'diu-student-hub-web' };

export function cookieOptions(extra = {}) {
  return {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: env.cookieSameSite,
    path: '/',
    ...extra,
  };
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), v: user.tokenVersion }, env.jwtSecret, {
    ...JWT_OPTS,
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
    // Pin the algorithm so tokens signed with "none" or an asymmetric key are rejected.
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: JWT_OPTS.issuer, audience: JWT_OPTS.audience });
  } catch {
    return null;
  }
  if (typeof payload?.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) return null;
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.v) return null;
  if (user.status === 'deleted' || user.status === 'suspended') return null;
  if (!env.allowDemoAccounts && user.isDemoAccount()) return null; // no demo sessions on production
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
