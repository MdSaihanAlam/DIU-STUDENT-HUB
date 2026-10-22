import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const jwtSecret = isProd
  ? required('JWT_SECRET')
  : process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production';

if (isProd && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

// Render sets RENDER_EXTERNAL_URL (e.g. https://diu-student-hub.onrender.com); use it as the
// default public URL so a single-service deploy needs no extra configuration.
// On Vercel, VERCEL_PROJECT_PRODUCTION_URL is the production domain (without https://).
const publicUrl =
  process.env.PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
const list = (v) =>
  String(v || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

export const env = {
  isProd,
  isTest,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/diu_student_hub',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: list(process.env.CLIENT_ORIGINS || publicUrl || 'http://localhost:5173'),
  clientUrl: process.env.CLIENT_URL || publicUrl || 'http://localhost:5173',
  // Serve the built React app (client/dist) from this server: one service, same origin.
  serveClient: process.env.SERVE_CLIENT === 'true',
  // Accounts with these emails become admins when they register or sign in (first-admin bootstrap).
  adminEmails: list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  bootstrapDepartments: process.env.BOOTSTRAP_DEPARTMENTS !== 'false',
  // Seeded demo accounts share a publicly documented password, so they can never sign in on
  // production. ALLOW_DEMO_ACCOUNTS overrides the default (only for staging/demo deployments).
  allowDemoAccounts: process.env.ALLOW_DEMO_ACCOUNTS ? process.env.ALLOW_DEMO_ACCOUNTS === 'true' : !isProd,
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  trustProxy: Number(process.env.TRUST_PROXY) || (process.env.RENDER || process.env.VERCEL ? 1 : 0),
  // Serverless platforms have no persistent disk, so default to storing uploads in MongoDB there.
  storageDriver: process.env.STORAGE_DRIVER || (process.env.VERCEL || process.env.RENDER ? 'gridfs' : 'local'),
  // Shared secret for the scheduled reminders endpoint (Vercel Cron sends it as a Bearer token).
  cronSecret: process.env.CRON_SECRET || '',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  // Vercel functions accept request bodies up to ~4.5 MB, so uploads default to 4 MB there.
  maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || (process.env.VERCEL ? 4 : 15)) * 1024 * 1024,
  resourcesRequireApproval: process.env.RESOURCES_REQUIRE_APPROVAL !== 'false',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'DIU Student Hub <no-reply@example.com>',
  },
};
