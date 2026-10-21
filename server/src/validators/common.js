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

// Frequently breached / guessable passwords (lower-cased). Extend with a larger list in production.
const COMMON_PASSWORDS = new Set(
  (
    'password password1 password12 password123 password1234 passw0rd 1234567890 12345678910 123456789a qwertyuiop qwerty1234 ' +
    'qwerty12345 1q2w3e4r5t 1qaz2wsx3edc iloveyou123 abcdefghij abc1234567 welcome123 letmein123 admin12345 administrator ' +
    'bangladesh bangladesh1 bangladesh123 dhaka12345 diu123456 diu1234567 student123 student1234 university1 football123 ' +
    'monkey12345 sunshine123 princess123 dragon12345 baseball123 trustno1234 changeme123 11111111111 0000000000 ' +
    'aaaaaaaaaa zaq12wsxcde asdfghjkl1 asdfghjkl123 mustang1234 shadow12345 master12345 superman123 batman12345'
  ).split(' ')
);

/** bcrypt only uses the first 72 bytes; longer inputs would silently be truncated. */
const utf8Bytes = (s) => new TextEncoder().encode(s).length;

export const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .refine((v) => utf8Bytes(v) <= 72, 'Password is too long (max 72 bytes)')
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), 'This password is too common. Choose something harder to guess')
  .refine((v) => !/^(.)\1+$/.test(v), 'Password cannot be a single repeated character');

/** Reject passwords that contain the user's name or email name (case-insensitive). */
export const notPersonal = (pw, { email = '', name = '' } = {}) => {
  const p = pw.toLowerCase();
  const parts = [email.split('@')[0], ...name.toLowerCase().split(/\s+/)].filter((x) => x && x.length >= 4);
  return !parts.some((x) => p.includes(x.toLowerCase()));
};

export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(120);
