import { Router } from 'express';
import * as engagement from '../controllers/engagementController.js';
import * as resources from '../controllers/resourceController.js';
import * as housing from '../controllers/housingController.js';
import * as directory from '../controllers/directoryController.js';
import * as research from '../controllers/researchController.js';
import * as alumni from '../controllers/alumniController.js';
import * as ce from '../controllers/careerEventController.js';
import * as misc from '../controllers/miscController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMany, uploadSingle } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';
import { asyncHandler as h } from '../utils/http.js';
import * as v from '../validators/index.js';

const r = Router();
r.use(requireAuth);

// Saved items & reports
r.get('/bookmarks', h(engagement.listBookmarks));
r.post('/bookmarks/toggle', validate(v.bookmarkSchema), h(engagement.toggleBookmark));
r.post('/reports', writeLimiter, validate(v.reportSchema), h(engagement.createReport));

// Academic resources
r.get('/resources', h(resources.listResources));
r.get('/resources/facets', h(resources.resourceFacets));
r.post('/resources', writeLimiter, uploadSingle('file'), validate(v.resourceSchema), h(resources.createResource));
r.get('/resources/:id', h(resources.getResource));
r.get('/resources/:id/download', h(resources.downloadResource));
r.get('/resources/:id/preview', h(resources.previewResource));
r.post('/resources/:id/rate', validate(v.rateSchema), h(resources.rateResource));
r.delete('/resources/:id', h(resources.deleteResource));

// Housing
r.get('/housing', h(housing.listHousing));
r.post('/housing', writeLimiter, uploadMany('photos', 6), validate(v.housingSchema), h(housing.createHousing));
r.get('/housing/:id', h(housing.getHousing));
r.patch('/housing/:id', uploadMany('photos', 6), validate(v.housingUpdateSchema), h(housing.updateHousing));
r.post('/housing/:id/status', validate(v.housingStatusSchema), h(housing.setHousingStatus));
r.post('/housing/:id/contact', writeLimiter, validate(v.contactOwnerSchema), h(housing.contactOwner));
r.delete('/housing/:id', h(housing.deleteHousing));

// Departments & faculty
r.get('/departments', h(directory.listDepartments));
r.get('/departments/:slug', h(directory.getDepartment));
r.get('/faculty', h(directory.listFaculty));
r.get('/faculty/:id', h(directory.getFaculty));
r.patch('/faculty/:id', validate(v.facultySchema.partial()), h(directory.updateOwnFaculty));

// Research
r.get('/research', h(research.listResearch));
r.get('/research/domains', h(research.researchDomains));
r.post('/research', writeLimiter, validate(v.researchSchema), h(research.createResearch));
r.get('/research/:id', h(research.getResearch));
r.patch('/research/:id', validate(v.researchUpdateSchema), h(research.updateResearch));
r.delete('/research/:id', h(research.deleteResearch));
r.post('/research/:id/follow', h(research.toggleFollow));
r.post('/research/:id/updates', writeLimiter, validate(v.researchPostSchema), h(research.addUpdate));
r.post('/research/:id/files', uploadSingle('file'), h(research.uploadResearchFile));
r.post('/research/:id/collaborate', writeLimiter, validate(v.collaborateSchema), h(research.requestCollaboration));

// Alumni
r.get('/alumni', h(alumni.listAlumni));
r.get('/alumni/facets', h(alumni.alumniFacets));
r.get('/alumni/stories', h(alumni.successStories));
r.get('/alumni/me', h(alumni.myAlumniProfile));
r.put('/alumni/me', validate(v.alumniSchema), h(alumni.upsertAlumniProfile));
r.get('/alumni/:id', h(alumni.getAlumni));

// Careers
r.get('/careers', h(ce.listCareers));
r.post('/careers', writeLimiter, validate(v.careerSchema), h(ce.createCareer));
r.get('/careers/:id', h(ce.getCareer));
r.patch('/careers/:id', validate(v.careerSchema.partial()), h(ce.updateCareer));
r.delete('/careers/:id', h(ce.deleteCareer));

// Events
r.get('/events', h(ce.listEvents));
r.post('/events', writeLimiter, validate(v.eventSchema), h(ce.createEvent));
r.get('/events/:id', h(ce.getEvent));
r.get('/events/:id/ics', h(ce.eventIcs));
r.put('/events/:id', validate(v.eventSchema), h(ce.updateEvent));
r.delete('/events/:id', h(ce.deleteEvent));

// Notifications, search, verification
r.get('/notifications', h(misc.listNotifications));
r.get('/notifications/unread-count', h(misc.notificationCount));
r.post('/notifications/read-all', h(misc.markAllRead));
r.post('/notifications/:id/read', h(misc.markRead));
r.get('/search', h(misc.search));
r.get('/verification', h(misc.myVerification));
r.post('/verification', writeLimiter, validate(v.verificationSchema), h(misc.requestVerification));

export default r;
