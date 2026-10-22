// Vercel serverless entry: runs the Express API as a single function.
// vercel.json rewrites every /api/* request here; Express sees the original URL.
import { createApp } from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';
import { env } from '../server/src/config/env.js';
import { ensureStarterDepartments } from '../server/src/services/bootstrap.js';

const app = createApp();

// Reuse one database connection across invocations of a warm function instance.
let ready = null;
function connectOnce() {
  if (!ready) {
    ready = connectDB(env.mongoUri)
      .then(() => ensureStarterDepartments())
      .catch((err) => {
        ready = null; // retry on the next request instead of caching the failure
        throw err;
      });
  }
  return ready;
}

export default async function handler(req, res) {
  try {
    await connectOnce();
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: { message: 'The database is unavailable right now. Please try again shortly.' } }));
    return;
  }
  return app(req, res);
}
