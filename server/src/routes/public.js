import { Router } from 'express';
import * as c from '../controllers/miscController.js';
import { asyncHandler as h } from '../utils/http.js';

// Signed-out endpoints. They only return content that is already meant to be public.
const r = Router();

r.get('/highlights', h(c.publicHighlights));
r.get('/search', h(c.publicSearch));
r.get('/departments', h(c.publicDepartments));

export default r;
