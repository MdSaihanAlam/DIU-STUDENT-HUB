import { Router } from 'express';
import * as c from '../controllers/adminController.js';
import { requireAuth, requireRole, requireStaff } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/http.js';
import { departmentSchema, facultySchema, reportActionSchema, reviewDecisionSchema, roleSchema, suspendSchema } from '../validators/index.js';

// Every route here is enforced server-side; hiding UI is never the only protection.
const r = Router();
r.use(requireAuth, requireStaff);
const adminOnly = requireRole('admin');

r.get('/stats', h(c.stats));

r.get('/users', h(c.listUsers));
r.patch('/users/:id/role', adminOnly, validate(roleSchema), h(c.setRole));
r.post('/users/:id/suspend', validate(suspendSchema), h(c.suspendUser));
r.post('/users/:id/restore', h(c.restoreUser));
r.post('/users/:id/process-deletion', adminOnly, h(c.processDeletion));

r.get('/verifications', h(c.listVerifications));
r.post('/verifications/:id', validate(reviewDecisionSchema), h(c.decideVerification));

r.get('/reports', h(c.listReports));
r.post('/reports/:id', validate(reportActionSchema), h(c.actOnReport));

r.get('/queue/:type', h(c.listQueue));
r.post('/queue/:type/:id', validate(reviewDecisionSchema), h(c.decideQueue));

r.get('/featured', h(c.featuredOverview));
r.post('/feature/:type/:id', h(c.toggleFeature));

r.get('/audit', adminOnly, h(c.auditLog));

r.post('/departments', adminOnly, validate(departmentSchema), h(c.createDepartment));
r.put('/departments/:id', adminOnly, validate(departmentSchema), h(c.updateDepartment));
r.delete('/departments/:id', adminOnly, h(c.deleteDepartment));
r.post('/faculty', validate(facultySchema), h(c.createFaculty));
r.put('/faculty/:id', validate(facultySchema), h(c.updateFaculty));
r.delete('/faculty/:id', adminOnly, h(c.deleteFaculty));

export default r;
