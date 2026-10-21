import { Router } from 'express';
import * as c from '../controllers/postController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMany } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';
import { asyncHandler as h } from '../utils/http.js';
import { commentSchema, postSchema, postUpdateSchema, reactSchema, shareSchema, voteSchema } from '../validators/index.js';

const r = Router();
r.use(requireAuth);

r.get('/', h(c.listPosts));
r.get('/trending', h(c.trending));
r.post('/', writeLimiter, uploadMany('files', 4, { maxBytes: 8 * 1024 * 1024 }), validate(postSchema), h(c.createPost));
r.get('/:id', h(c.getPost));
r.patch('/:id', validate(postUpdateSchema), h(c.updatePost));
r.delete('/:id', h(c.deletePost));
r.post('/:id/pin', h(c.togglePin));
r.post('/:id/react', validate(reactSchema), h(c.react));
r.delete('/:id/react', h(c.unreact));
r.post('/:id/vote', validate(voteSchema), h(c.vote));
r.post('/:id/share', writeLimiter, validate(shareSchema), h(c.sharePost));
r.get('/:id/comments', h(c.listComments));
r.post('/:id/comments', writeLimiter, validate(commentSchema), h(c.addComment));
r.delete('/:id/comments/:commentId', h(c.deleteComment));

export default r;
