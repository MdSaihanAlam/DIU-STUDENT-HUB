import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { runReminders } from '../services/reminders.js';
import { ApiError, asyncHandler } from '../utils/http.js';

/**
 * Scheduled jobs for serverless hosts without a long-running process.
 * Vercel Cron calls these with "Authorization: Bearer <CRON_SECRET>".
 * Disabled (404) unless CRON_SECRET is configured.
 */
const r = Router();

function requireCronSecret(req, res, next) {
  if (!env.cronSecret) return next(ApiError.notFound());
  const given = Buffer.from(req.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return next(ApiError.unauthorized('Invalid cron secret'));
  next();
}

r.get(
  '/reminders',
  requireCronSecret,
  asyncHandler(async (req, res) => {
    const created = await runReminders();
    res.json({ ok: true, data: { created } });
  })
);

export default r;
