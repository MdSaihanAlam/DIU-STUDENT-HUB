import { Router } from 'express';
import * as c from '../controllers/messageController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';
import { asyncHandler as h } from '../utils/http.js';
import { messageSchema, startConversationSchema } from '../validators/index.js';

const r = Router();
r.use(requireAuth);

r.get('/', h(c.listConversations));
r.get('/unread-count', h(c.unreadCount));
r.post('/', writeLimiter, validate(startConversationSchema), h(c.startConversation));
r.get('/:id/messages', h(c.getMessages));
r.post('/:id/messages', writeLimiter, validate(messageSchema), h(c.sendMessage));
r.post('/:id/accept', h(c.acceptConversation));
r.post('/:id/decline', h(c.declineConversation));

export default r;
