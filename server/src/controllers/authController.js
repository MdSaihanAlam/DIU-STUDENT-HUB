import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User, VerificationRequest } from '../models/index.js';
import { clearSession, issueSession } from '../middleware/auth.js';
import { issueCsrf } from '../middleware/security.js';
import { sendMail, mailConfigured } from '../services/mail.js';
import { lockRemaining, recordFailure, recordSuccess } from '../services/loginGuard.js';
import { ApiError, ok } from '../utils/http.js';

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');

// A real hash so login timing is the same whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 12);

export async function loadSelf(userId) {
  const user = await User.findById(userId).populate('department', 'name code slug');
  if (!user) return null;
  const self = user.toSelf();
  const pending = await VerificationRequest.findOne({ user: user._id, status: 'pending' }).select('requestedAffiliation createdAt').lean();
  return { ...self, pendingVerification: pending || null };
}

async function sendVerificationEmail(user) {
  const token = newToken();
  user.emailVerifyTokenHash = hashToken(token);
  await user.save();
  await sendMail({
    to: user.email,
    subject: 'Verify your DIU Student Hub email',
    text: `Hi ${user.name},\n\nConfirm your email address by opening this link:\n${env.clientUrl}/verify-email?token=${token}\n\nIf you did not create an account, ignore this email.`,
  });
}

/** Fire-and-forget security notice; failures are logged, never shown to the user. */
function notifyPasswordChanged(user) {
  sendMail({
    to: user.email,
    subject: 'Your DIU Student Hub password was changed',
    text: `Hi ${user.name},

The password for your account was just changed and all other sessions were signed out.

If this wasn't you, reset your password immediately at ${env.clientUrl}/forgot-password and contact the moderators.`,
  }).catch((err) => console.error('[mail] password notice failed:', err.message));
}

export function csrf(req, res) {
  ok(res, { csrfToken: issueCsrf(req, res) });
}

export async function register(req, res) {
  const { name, email, password, affiliation } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');

  const user = new User({ name, email, affiliation, affiliationVerified: false, role: 'member' });
  await user.setPassword(password);
  await user.save();
  await sendVerificationEmail(user);

  issueSession(res, user);
  ok(res, { user: await loadSelf(user._id), emailDelivery: mailConfigured() ? 'sent' : 'console' }, 201);
}

export async function login(req, res) {
  const { email, password } = req.body;
  const locked = lockRemaining(email);
  if (locked) {
    res.setHeader('Retry-After', Math.ceil(locked / 1000));
    throw new ApiError(429, `Too many failed sign-in attempts. Try again in ${Math.ceil(locked / 60000)} minute(s), or reset your password.`);
  }
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user ? await user.checkPassword(password) : await bcrypt.compare(password, DUMMY_HASH);
  if (!user || !valid || user.status === 'deleted') {
    recordFailure(email);
    throw ApiError.unauthorized('Incorrect email or password');
  }
  recordSuccess(email);
  if (user.status === 'suspended') throw ApiError.forbidden('This account is suspended. Contact the moderators if you think this is a mistake.');
  user.lastLoginAt = new Date();

  if (user.status === 'deletion_requested') {
    // Signing in during the grace period cancels the deletion request.
    user.status = 'active';
    user.deletionRequestedAt = undefined;
    await user.save();
  }
  await user.save();
  issueSession(res, user);
  ok(res, { user: await loadSelf(user._id) });
}

/** Sign out of every device by invalidating all existing session tokens. */
export async function logoutAll(req, res) {
  req.user.tokenVersion += 1;
  await req.user.save();
  clearSession(res);
  ok(res, { loggedOut: true });
}

export function logout(req, res) {
  clearSession(res);
  ok(res, { loggedOut: true });
}

export async function me(req, res) {
  ok(res, { user: await loadSelf(req.user._id) });
}

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email, status: { $in: ['active', 'deletion_requested'] } });
  if (user) {
    const token = newToken();
    user.passwordReset = { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
    await user.save();
    await sendMail({
      to: user.email,
      subject: 'Reset your DIU Student Hub password',
      text: `Hi ${user.name},\n\nReset your password with this link (valid for 30 minutes):\n${env.clientUrl}/reset-password?token=${token}\n\nIf you did not request this, you can ignore this email.`,
    });
  }
  // Same response whether or not the email exists, to avoid account enumeration.
  ok(res, { message: 'If an account exists for that email, a reset link has been sent.' });
}

export async function resetPassword(req, res) {
  const user = await User.findOne({ 'passwordReset.tokenHash': hashToken(req.body.token) }).select('+passwordReset.tokenHash +passwordReset.expiresAt');
  if (!user || !user.passwordReset?.expiresAt || user.passwordReset.expiresAt < new Date()) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Request a new one.');
  }
  await user.setPassword(req.body.password);
  user.passwordReset = undefined;
  recordSuccess(user.email); // a successful reset lifts any sign-in lock
  user.tokenVersion += 1; // sign out every other session
  await user.save();
  notifyPasswordChanged(user);
  ok(res, { message: 'Password updated. You can now sign in.' });
}

export async function verifyEmail(req, res) {
  const user = await User.findOne({ emailVerifyTokenHash: hashToken(req.body.token) });
  if (!user) throw ApiError.badRequest('This verification link is invalid or was already used.');
  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  await user.save();
  ok(res, { message: 'Email verified. Thank you!' });
}

export async function resendVerification(req, res) {
  if (req.user.emailVerified) return ok(res, { message: 'Your email is already verified.' });
  await sendVerificationEmail(req.user);
  ok(res, { message: mailConfigured() ? 'Verification email sent.' : 'Email is not configured on this server; the link was printed to the server console.' });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.checkPassword(req.body.currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  if (await user.checkPassword(req.body.newPassword)) throw ApiError.badRequest('Choose a password different from your current one');
  await user.setPassword(req.body.newPassword);
  user.tokenVersion += 1;
  await user.save();
  notifyPasswordChanged(user);
  issueSession(res, user); // keep this session, revoke others
  ok(res, { message: 'Password changed. Other sessions were signed out.' });
}
