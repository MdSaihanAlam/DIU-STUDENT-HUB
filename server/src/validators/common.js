import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const optObjectId = z
  .union([objectId, z.literal(''), z.null()])
  .optional()
  .transform((v) => v || undefined);

export const text = (max, min = 1) => z.string().trim().min(min, 'This field is required').max(max, `Must be at most ${max} characters`);
export const optText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.null().transform(() => undefined));

/** Only http(s) links are accepted — blocks javascript: and data: URLs. */
export const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\/[^\s]+$/i.test(v), 'Must be a valid http(s) link');
export const optUrl = z
  .union([url, z.literal(''), z.null()])
  .optional()
  .transform((v) => v || undefined);

export const optDate = z
  .union([z.coerce.date(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v instanceof Date && !Number.isNaN(+v) ? v : undefined));

/** Accept arrays or comma-separated strings (multipart forms send strings). */
export const stringList = (maxItems = 20, maxLen = 60) =>
  z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const arr = Array.isArray(v) ? v : v.split(',');
      return arr.map((s) => s.trim()).filter(Boolean).slice(0, maxItems).map((s) => s.slice(0, maxLen));
    });

export const boolish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'on', 'off'])])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === true || v === 'true' || v === '1' || v === 'on'));

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must include letters and numbers');

export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(120);
