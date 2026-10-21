import { Router } from 'express';
import * as c from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';
import { asyncHandler as h } from '../utils/http.js';
import { connectSchema, profileSchema, respondSchema, settingsSchema } from '../validators/index.js';

const r = Router();
r.use(requireAuth);

r.get('/', h(c.listUsers));
r.get('/suggested', h(c.suggestedUsers));
r.patch('/me', validate(profileSchema), h(c.updateProfile));
r.patch('/me/settings', validate(settingsSchema), h(c.updateSettings));
r.post('/me/avatar', uploadSingle('avatar', { maxBytes: 3 * 1024 * 1024 }), h(c.uploadAvatar));
r.delete('/me/avatar', h(c.removeAvatar));
r.get('/me/blocked', h(c.listBlocked));
r.post('/me/delete-request', h(c.requestDeletion));

r.get('/me/connections', h(c.listConnections));
r.post('/connections/:id/respond', validate(respondSchema), h(c.respondConnection));
r.delete('/connections/:id', h(c.removeConnection));

r.get('/:id', h(c.getUser));
r.get('/:id/content', h(c.userContent));
r.post('/:id/connect', writeLimiter, validate(connectSchema), h(c.requestConnection));
r.post('/:id/block', h(c.blockUser));
r.delete('/:id/block', h(c.unblockUser));

export default r;
