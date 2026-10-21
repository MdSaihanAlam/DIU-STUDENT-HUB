import { Router } from 'express';
import * as c from '../controllers/communityController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';
import { asyncHandler as h } from '../utils/http.js';
import { communitySchema, communityUpdateSchema, memberActionSchema } from '../validators/index.js';

const r = Router();
r.use(requireAuth);

r.get('/', h(c.listCommunities));
r.post('/', writeLimiter, validate(communitySchema), h(c.createCommunity));
r.get('/:slug', h(c.getCommunity));
r.patch('/:slug', validate(communityUpdateSchema), h(c.updateCommunity));
r.post('/:slug/join', h(c.joinCommunity));
r.post('/:slug/leave', h(c.leaveCommunity));
r.get('/:slug/members', h(c.listMembers));
r.post('/:slug/members/:userId', validate(memberActionSchema), h(c.manageMember));

export default r;
