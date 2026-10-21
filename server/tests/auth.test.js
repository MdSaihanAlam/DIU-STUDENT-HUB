import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { client, models, registerUser, setup, teardown } from './helpers.js';

before(setup);
after(teardown);

describe('authentication', () => {
  it('reports health', async () => {
    const c = await client();
    const res = await c.get('/api/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.db, 'up');
  });

  it('registers, keeps the session in an HttpOnly cookie and returns /me', async () => {
    const c = await client();
    const res = await c.post('/api/v1/auth/register').send({ name: 'Ayesha', email: 'AYESHA@Example.test', password: 'Secure-Pass-9', acceptTerms: true });
    assert.equal(res.status, 201);
    const cookie = res.headers['set-cookie'].find((h) => h.startsWith('hub_token='));
    assert.match(cookie, /HttpOnly/i);
    assert.equal(res.body.data.user.email, 'ayesha@example.test');
    assert.equal(res.body.data.user.passwordHash, undefined);

    const me = await c.get('/api/v1/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.name, 'Ayesha');
  });

  it('rejects weak passwords and duplicate emails', async () => {
    const c = await client();
    const weak = await c.post('/api/v1/auth/register').send({ name: 'Weak', email: 'weak@example.test', password: 'password', acceptTerms: true });
    assert.equal(weak.status, 400);
    await c.post('/api/v1/auth/register').send({ name: 'Dup', email: 'dup@example.test', password: 'Secure-Pass-9', acceptTerms: true });
    const c2 = await client();
    const dup = await c2.post('/api/v1/auth/register').send({ name: 'Dup', email: 'dup@example.test', password: 'Secure-Pass-9', acceptTerms: true });
    assert.equal(dup.status, 409);
  });

  it('ignores user-supplied role and verification fields', async () => {
    const c = await client();
    const res = await c.post('/api/v1/auth/register').send({ name: 'Mallory', email: 'mallory@example.test', password: 'Secure-Pass-9', acceptTerms: true, role: 'admin', affiliation: 'faculty', affiliationVerified: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'member');
    assert.equal(res.body.data.user.affiliationVerified, false);
    const patch = await c.patch('/api/v1/users/me').send({ role: 'admin', affiliationVerified: true, headline: 'hi' });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.data.user.role, 'member');
    assert.equal(patch.body.data.user.affiliationVerified, false);
  });

  it('rejects wrong passwords with a generic message', async () => {
    const u = await registerUser();
    const c = await client();
    const res = await c.post('/api/v1/auth/login').send({ email: u.credentials.email, password: 'WrongPass1' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, 'Incorrect email or password');
  });

  it('blocks NoSQL operator injection on login', async () => {
    const c = await client();
    const res = await c.post('/api/v1/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    assert.equal(res.status, 400);
  });

  it('requires a CSRF token for state-changing requests', async () => {
    const u = await registerUser();
    const res = await u.agent.post('/api/v1/posts').send({ content: 'no token' });
    assert.equal(res.status, 403);
  });

  it('requires authentication for member endpoints', async () => {
    const c = await client();
    const res = await c.get('/api/v1/posts');
    assert.equal(res.status, 401);
  });

  it('resets a password with a single-use token and revokes old sessions', async () => {
    const u = await registerUser();
    const crypto = await import('node:crypto');
    const token = crypto.randomBytes(32).toString('hex');
    await models.User.updateOne(
      { _id: u.user._id },
      { passwordReset: { tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60000) } }
    );
    const c = await client();
    const res = await c.post('/api/v1/auth/reset-password').send({ token, password: 'NewSecure456' });
    assert.equal(res.status, 200);
    const reuse = await c.post('/api/v1/auth/reset-password').send({ token, password: 'Another789' });
    assert.equal(reuse.status, 400);
    const old = await u.get('/api/v1/auth/me');
    assert.equal(old.status, 401, 'old session must be revoked');
    const login = await c.post('/api/v1/auth/login').send({ email: u.credentials.email, password: 'NewSecure456' });
    assert.equal(login.status, 200);
  });

  it('prevents suspended members from signing in', async () => {
    const u = await registerUser();
    await models.User.updateOne({ _id: u.user._id }, { status: 'suspended', $inc: { tokenVersion: 1 } });
    const c = await client();
    const res = await c.post('/api/v1/auth/login').send({ email: u.credentials.email, password: u.credentials.password });
    assert.equal(res.status, 403);
    const me = await u.get('/api/v1/auth/me');
    assert.equal(me.status, 401);
  });
});
