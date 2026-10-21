// Test harness: in-memory MongoDB + an Express app instance + cookie-keeping agents.
process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads-test';

const { default: request } = await import('supertest');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { createApp } = await import('../src/app.js');
const models = await import('../src/models/index.js');

export { models };

let app;

export async function setup() {
  await connectDB(null, { memory: true });
  app = createApp();
  return app;
}

export async function teardown() {
  await disconnectDB();
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads-test');
  await fs.rm(dir, { recursive: true, force: true });
}

/** A supertest agent that keeps cookies and sends the CSRF header automatically. */
export async function client() {
  const agent = request.agent(app);
  const res = await agent.get('/api/v1/auth/csrf');
  const token = res.body.data.csrfToken;
  const wrap = (method) => (url) => agent[method](url).set('X-CSRF-Token', token);
  return { agent, token, get: (url) => agent.get(url), post: wrap('post'), patch: wrap('patch'), put: wrap('put'), del: wrap('delete') };
}

let counter = 0;
export async function registerUser(overrides = {}) {
  const c = await client();
  counter += 1;
  const body = { name: `Test User ${counter}`, email: `user${counter}-${Date.now()}@example.test`, password: 'Passw0rd!', affiliation: 'student', acceptTerms: true, ...overrides };
  const res = await c.post('/api/v1/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { ...c, user: res.body.data.user, credentials: body };
}

/** Create a staff account directly in the database, then sign in through the API. */
export async function staffUser(role = 'admin') {
  const u = await registerUser();
  await models.User.updateOne({ _id: u.user._id }, { role, affiliationVerified: true });
  const c = await client();
  const res = await c.post('/api/v1/auth/login').send({ email: u.credentials.email, password: u.credentials.password });
  if (res.status !== 200) throw new Error('staff login failed');
  return { ...c, user: res.body.data.user };
}

/** Minimal valid PDF bytes. */
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');
