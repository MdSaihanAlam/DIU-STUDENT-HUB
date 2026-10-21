import { Router } from 'express';
import * as c from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/http.js';
import { changePasswordSchema, forgotSchema, loginSchema, registerSchema, resetSchema, tokenSchema } from '../validators/index.js';

const r = Router();

r.get('/csrf', c.csrf);
r.post('/register', authLimiter, validate(registerSchema), h(c.register));
r.post('/login', authLimiter, validate(loginSchema), h(c.login));
r.post('/logout', c.logout);
r.get('/me', requireAuth, h(c.me));
r.post('/forgot-password', authLimiter, validate(forgotSchema), h(c.forgotPassword));
r.post('/reset-password', authLimiter, validate(resetSchema), h(c.resetPassword));
r.post('/verify-email', authLimiter, validate(tokenSchema), h(c.verifyEmail));
r.post('/resend-verification', authLimiter, requireAuth, h(c.resendVerification));
r.post('/change-password', authLimiter, requireAuth, validate(changePasswordSchema), h(c.changePassword));

export default r;
