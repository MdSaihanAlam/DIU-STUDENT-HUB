import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';

export const CSRF_COOKIE = env.isProd || env.cookieSameSite === 'none' ? '__Host-hub_csrf' : 'hub_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection. The client fetches a token from GET /auth/csrf
 * (also set as a cookie) and echoes it in the X-CSRF-Token header on every
 * state-changing request. A cross-site attacker can send the cookie but cannot read it.
 */
export function issueCsrf(req, res) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token || token.length !== 64) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: env.isProd || env.cookieSameSite === 'none',
      sameSite: env.cookieSameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  return token;
}

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get('x-csrf-token');
  if (!cookie || !header || cookie.length !== header.length) {
    return next(new ApiError(403, 'Security token missing or expired. Please refresh the page.'));
  }
  if (!crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
    return next(new ApiError(403, 'Security token mismatch. Please refresh the page.'));
  }
  next();
}

/** Remove keys that could be interpreted as MongoDB operators ($gt, a.b) from user input. */
function scrub(value, depth = 0) {
  if (depth > 10 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete value[key];
    } else {
      value[key] = scrub(value[key], depth + 1);
    }
  }
  return value;
}

export function sanitizeInput(req, res, next) {
  if (req.body) scrub(req.body);
  if (req.params) scrub(req.params);
  // Query values are always plain strings: repeated keys (?a=1&a=2) collapse to the first value,
  // which blocks HTTP parameter pollution and array/object smuggling into database filters.
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (k.startsWith('$') || k.includes('.') || k === '__proto__') delete req.query[k];
      else if (Array.isArray(v)) req.query[k] = String(v[0] ?? '');
      else if (v !== null && typeof v === 'object') delete req.query[k];
      else req.query[k] = String(v).slice(0, 500);
    }
  }
  next();
}

const limiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit: env.isTest ? 10_000 : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { ok: false, error: { message } },
  });

export const apiLimiter = limiter(15 * 60 * 1000, 1000, 'Too many requests. Please slow down.');
export const authLimiter = limiter(15 * 60 * 1000, 30, 'Too many sign-in attempts. Try again in a few minutes.');
export const writeLimiter = limiter(60 * 1000, 40, 'You are posting too quickly. Please wait a moment.');
