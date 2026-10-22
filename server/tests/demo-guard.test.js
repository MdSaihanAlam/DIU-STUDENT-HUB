import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Simulate production behaviour for demo accounts (each test file runs in its own process).
process.env.ALLOW_DEMO_ACCOUNTS = 'false';
const { client, models, setup, teardown } = await import('./helpers.js');
const { isLocalDatabase, seed, DEMO_PASSWORD } = await import('../scripts/seed.js');

before(setup);
after(teardown);

async function createUser(fields) {
  const user = new models.User({ name: 'Demo Admin', role: 'admin', onboarded: true, ...fields });
  await user.setPassword(DEMO_PASSWORD);
  return user.save();
}

describe('demo accounts are unusable when ALLOW_DEMO_ACCOUNTS is off (production default)', () => {
  it('rejects sign-in for a seeded demo account with the published password', async () => {
    await createUser({ email: 'admin@demo.diuhub.test', isDemo: true });
    const c = await client();
    const res = await c.post('/api/v1/auth/login').send({ email: 'admin@demo.diuhub.test', password: DEMO_PASSWORD });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, 'Incorrect email or password', 'same response as a wrong password');
  });

  it('rejects the demo email domain even if the isDemo flag is missing', async () => {
    await createUser({ email: 'sneaky@demo.diuhub.test', isDemo: false });
    const c = await client();
    const res = await c.post('/api/v1/auth/login').send({ email: 'sneaky@demo.diuhub.test', password: DEMO_PASSWORD });
    assert.equal(res.status, 401);
  });

  it('ignores an existing session belonging to a demo account', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const user = await createUser({ email: 'session@demo.diuhub.test', isDemo: true });
    const token = jwt.sign({ sub: String(user._id), v: user.tokenVersion }, process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production', {
      algorithm: 'HS256',
      issuer: 'diu-student-hub',
      audience: 'diu-student-hub-web',
    });
    const c = await client();
    const res = await c.agent.get('/api/v1/auth/me').set('Cookie', `hub_token=${token}`);
    assert.equal(res.status, 401);
  });

  it('does not let anyone register with the reserved demo domain', async () => {
    const c = await client();
    const res = await c.post('/api/v1/auth/register').send({ name: 'Fake', email: 'new@demo.diuhub.test', password: 'a long secret phrase 42', acceptTerms: true });
    assert.equal(res.status, 400);
  });

  it('still lets normal members sign in', async () => {
    const c = await client();
    const reg = await c.post('/api/v1/auth/register').send({ name: 'Real Person', email: 'real@example.test', password: 'a long secret phrase 42', acceptTerms: true });
    assert.equal(reg.status, 201);
    const c2 = await client();
    const login = await c2.post('/api/v1/auth/login').send({ email: 'real@example.test', password: 'a long secret phrase 42' });
    assert.equal(login.status, 200);
  });
});

describe('seed script safety', () => {
  it('recognises only local databases as safe to seed', () => {
    assert.equal(isLocalDatabase('mongodb://127.0.0.1:27017/diu_student_hub'), true);
    assert.equal(isLocalDatabase('mongodb://localhost/diu'), true);
    assert.equal(isLocalDatabase('mongodb://user:pw@localhost:27017/diu'), true);
    assert.equal(isLocalDatabase('mongodb://[::1]:27017/diu'), true);
    assert.equal(isLocalDatabase('mongodb+srv://user:pw@cluster0.abcde.mongodb.net/diu'), false);
    assert.equal(isLocalDatabase('mongodb://db.example.com:27017/diu'), false);
    assert.equal(isLocalDatabase('mongodb://localhost:27017,db.example.com:27017/diu'), false);
    assert.equal(isLocalDatabase('mongodb://localhost.evil.com/diu'), false);
    assert.equal(isLocalDatabase(''), false);
  });

  it('refuses to seed a hosted (Atlas) database without an explicit flag', async () => {
    const before = await models.User.countDocuments();
    await assert.rejects(seed({ uri: 'mongodb+srv://user:pw@cluster0.abcde.mongodb.net/diu', quiet: true }), /Refusing to seed a non-local database/);
    assert.equal(await models.User.countDocuments(), before, 'nothing was deleted or created');
  });
});
