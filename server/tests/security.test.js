import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { client, models, registerUser, setup, teardown } from './helpers.js';

before(setup);
after(teardown);

describe('password policy', () => {
  const attempt = async (password, extra = {}) => {
    const c = await client();
    return c.post('/api/v1/auth/register').send({ name: 'Nadia Islam', email: `p${Math.random()}@example.test`, password, acceptTerms: true, ...extra });
  };

  it('requires at least 10 characters', async () => {
    assert.equal((await attempt('Short1!')).status, 400);
  });
  it('rejects common passwords', async () => {
    const res = await attempt('Password123');
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /too common/);
  });
  it('rejects passwords containing the name or email', async () => {
    assert.equal((await attempt('nadia-is-great')).status, 400);
    assert.equal((await attempt('tasnim2025!!', { email: 'tasnim2025@example.test' })).status, 400);
  });
  it('rejects passwords over bcrypt’s 72-byte limit', async () => {
    assert.equal((await attempt('ঢাকা'.repeat(10))).status, 400); // 4 chars × 3 bytes × 10 = 120 bytes
  });
  it('accepts a long passphrase', async () => {
    assert.equal((await attempt('blue river under the moon')).status, 201);
  });
});

describe('brute-force protection', () => {
  it('locks sign-in after repeated failures, even with the right password', async () => {
    const u = await registerUser();
    const c = await client();
    for (let i = 0; i < 5; i++) {
      const r = await c.post('/api/v1/auth/login').send({ email: u.credentials.email, password: 'wrong-password-x' });
      assert.equal(r.status, 401);
    }
    const locked = await c.post('/api/v1/auth/login').send({ email: u.credentials.email, password: u.credentials.password });
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers['retry-after']) > 0);
  });

  it('applies the same lock to unknown emails (no account enumeration)', async () => {
    const c = await client();
    for (let i = 0; i < 5; i++) await c.post('/api/v1/auth/login').send({ email: 'ghost@example.test', password: 'whatever-123' });
    const r = await c.post('/api/v1/auth/login').send({ email: 'ghost@example.test', password: 'whatever-123' });
    assert.equal(r.status, 429);
  });
});

describe('session security', () => {
  it('rejects tokens with alg "none" or a wrong signature', async () => {
    const u = await registerUser();
    const forged = jwt.sign({ sub: u.user._id, v: 0 }, 'not-the-secret', { issuer: 'diu-student-hub', audience: 'diu-student-hub-web' });
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: u.user._id, v: 0 })).toString('base64url')}.`;
    for (const token of [forged, none]) {
      const c = await client();
      const res = await c.agent.get('/api/v1/auth/me').set('Cookie', `hub_token=${token}`);
      assert.equal(res.status, 401);
    }
  });

  it('signs out every device with logout-all', async () => {
    const u = await registerUser();
    const second = await client();
    await second.post('/api/v1/auth/login').send({ email: u.credentials.email, password: u.credentials.password });
    assert.equal((await second.get('/api/v1/auth/me')).status, 200);
    assert.equal((await u.post('/api/v1/auth/logout-all')).status, 200);
    assert.equal((await second.get('/api/v1/auth/me')).status, 401);
    assert.equal((await u.get('/api/v1/auth/me')).status, 401);
  });

  it('records the last sign-in time', async () => {
    const u = await registerUser();
    const c = await client();
    const res = await c.post('/api/v1/auth/login').send({ email: u.credentials.email, password: u.credentials.password });
    assert.ok(res.body.data.user.lastLoginAt);
  });

  it('requires the current password to delete the account', async () => {
    const u = await registerUser();
    assert.equal((await u.post('/api/v1/users/me/delete-request').send({ password: 'wrong-password-x' })).status, 400);
    const ok = await u.post('/api/v1/users/me/delete-request').send({ password: u.credentials.password });
    assert.equal(ok.status, 200);
    const user = await models.User.findById(u.user._id).lean();
    assert.equal(user.status, 'deletion_requested');
  });

  it('refuses to reuse the current password on change', async () => {
    const u = await registerUser();
    const res = await u.post('/api/v1/auth/change-password').send({ currentPassword: u.credentials.password, newPassword: u.credentials.password });
    assert.equal(res.status, 400);
  });
});

describe('input & header hardening', () => {
  it('flattens repeated query parameters instead of passing arrays to the database', async () => {
    const u = await registerUser();
    const res = await u.get('/api/v1/resources?resourceType=notes&resourceType=slides&q[$gt]=');
    assert.equal(res.status, 200);
  });

  it('sends strict security headers and no-store caching on API responses', async () => {
    const c = await client();
    const res = await c.get('/api/v1/health');
    assert.match(res.headers['content-security-policy'], /default-src 'none'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.match(res.headers['permissions-policy'], /camera=\(\)/);
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  it('never exposes password hashes or reset tokens', async () => {
    const u = await registerUser();
    const other = await registerUser();
    const me = await u.get('/api/v1/auth/me');
    const profile = await other.get(`/api/v1/users/${u.user._id}`);
    for (const body of [JSON.stringify(me.body), JSON.stringify(profile.body)]) {
      assert.ok(!body.includes('passwordHash'));
      assert.ok(!body.includes('tokenHash'));
      assert.ok(!body.includes('tokenVersion'));
    }
  });
});
