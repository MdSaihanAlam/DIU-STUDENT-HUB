import { CareerOpportunity, Event } from '../models/index.js';
import { canPublishOfficial, isStaff } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { ApiError, assertObjectId, containsRegex, getPaging, ok, paginate } from '../utils/http.js';
import { isOwner, withSaved } from '../utils/viewer.js';

// ---------- Careers ----------
export async function listCareers(req, res) {
  const q = req.query;
  const paging = getPaging(q, { defaultLimit: 12 });
  const filter = q.mine === '1' ? { postedBy: req.user._id } : { reviewStatus: 'approved' };
  if (q.type) filter.type = String(q.type);
  if (q.mode) filter.mode = String(q.mode);
  if (q.verified === '1') filter.verified = true;
  if (q.mine !== '1' && q.include !== 'expired') filter.$or = [{ deadline: { $gte: new Date() } }, { deadline: null }];
  if (q.q) {
    const r = containsRegex(q.q);
    filter.$and = [{ $or: [{ title: r }, { organization: r }, { description: r }, { tags: r }, { location: r }] }];
  }
  const sort = q.sort === 'newest' ? { createdAt: -1 } : { deadline: 1, createdAt: -1 };
  const data = await paginate(CareerOpportunity, filter, paging, { sort, select: '-description -eligibility', populate: { path: 'postedBy', select: 'name' } });
  data.items = await withSaved(data.items, req.user, 'career');
  ok(res, data);
}

export async function getCareer(req, res) {
  const item = await CareerOpportunity.findById(assertObjectId(req.params.id)).populate('postedBy', 'name avatarUrl affiliation affiliationVerified').lean();
  const mine = item && isOwner(req.user, item.postedBy?._id);
  if (!item || (item.reviewStatus !== 'approved' && !mine && !isStaff(req.user))) throw ApiError.notFound('Opportunity not found');
  const [withFlag] = await withSaved([item], req.user, 'career');
  ok(res, { opportunity: { ...withFlag, mine } });
}

export async function createCareer(req, res) {
  if (!req.user.affiliationVerified && !isStaff(req.user)) {
    throw ApiError.forbidden('Only verified members can submit opportunities. Request verification from your settings.');
  }
  const staff = isStaff(req.user);
  const item = await CareerOpportunity.create({ ...req.body, postedBy: req.user._id, reviewStatus: staff ? 'approved' : 'pending', verified: staff });
  ok(res, { opportunity: item, message: staff ? 'Published.' : 'Submitted. Moderators will review it shortly.' }, 201);
}

export async function updateCareer(req, res) {
  const item = await CareerOpportunity.findById(assertObjectId(req.params.id));
  if (!item) throw ApiError.notFound('Opportunity not found');
  const owner = isOwner(req.user, item.postedBy);
  if (!owner && !isStaff(req.user)) throw ApiError.forbidden();
  Object.assign(item, req.body);
  if (!isStaff(req.user)) {
    item.reviewStatus = 'pending'; // edits by submitters are re-reviewed
    item.verified = false;
  }
  await item.save();
  ok(res, { opportunity: item });
}

export async function deleteCareer(req, res) {
  const item = await CareerOpportunity.findById(assertObjectId(req.params.id));
  if (!item) throw ApiError.notFound('Opportunity not found');
  const owner = isOwner(req.user, item.postedBy);
  if (!owner && !isStaff(req.user)) throw ApiError.forbidden();
  await item.deleteOne();
  if (!owner) await audit(req.user, 'career.delete', 'career', item._id);
  ok(res, { removed: true });
}

// ---------- Events & announcements ----------
export async function listEvents(req, res) {
  const q = req.query;
  const paging = getPaging(q, { defaultLimit: 20, maxLimit: 100 });
  const filter = q.mine === '1' ? { postedBy: req.user._id } : { reviewStatus: 'approved' };
  if (q.category) filter.category = String(q.category);
  if (q.official === '1') filter.official = true;
  if (q.official === '0') filter.official = false;
  if (q.department) filter.department = assertObjectId(q.department, 'department');
  const from = q.from ? new Date(q.from) : null;
  const to = q.to ? new Date(q.to) : null;
  if (from && !Number.isNaN(+from)) (filter.startsAt ||= {}).$gte = from;
  if (to && !Number.isNaN(+to)) (filter.startsAt ||= {}).$lte = to;
  if (!from && !to && q.mine !== '1' && q.past !== '1') filter.startsAt = { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) };
  if (q.past === '1') filter.startsAt = { $lt: new Date() };
  if (q.q) {
    const r = containsRegex(q.q);
    filter.$or = [{ title: r }, { description: r }, { organizer: r }, { venue: r }];
  }
  const data = await paginate(Event, filter, paging, {
    sort: { startsAt: q.past === '1' ? -1 : 1 },
    select: '-description',
    populate: { path: 'department', select: 'name code' },
  });
  data.items = await withSaved(data.items, req.user, 'event');
  ok(res, data);
}

export async function getEvent(req, res) {
  const event = await Event.findById(assertObjectId(req.params.id)).populate('postedBy', 'name avatarUrl').populate('department', 'name code slug').lean();
  const mine = event && isOwner(req.user, event.postedBy?._id);
  if (!event || (event.reviewStatus !== 'approved' && !mine && !isStaff(req.user))) throw ApiError.notFound('Event not found');
  const [withFlag] = await withSaved([event], req.user, 'event');
  ok(res, { event: { ...withFlag, mine } });
}

export async function createEvent(req, res) {
  const official = canPublishOfficial(req.user);
  const event = await Event.create({ ...req.body, postedBy: req.user._id, official, reviewStatus: official ? 'approved' : 'pending' });
  ok(res, { event, message: official ? 'Event published.' : 'Submitted. It will appear as a community event once reviewed.' }, 201);
}

export async function updateEvent(req, res) {
  const event = await Event.findById(assertObjectId(req.params.id));
  if (!event) throw ApiError.notFound('Event not found');
  if (!isOwner(req.user, event.postedBy) && !isStaff(req.user)) throw ApiError.forbidden();
  Object.assign(event, req.body);
  if (!canPublishOfficial(req.user)) event.reviewStatus = 'pending';
  await event.save();
  ok(res, { event });
}

export async function deleteEvent(req, res) {
  const event = await Event.findById(assertObjectId(req.params.id));
  if (!event) throw ApiError.notFound('Event not found');
  const owner = isOwner(req.user, event.postedBy);
  if (!owner && !isStaff(req.user)) throw ApiError.forbidden();
  await event.deleteOne();
  if (!owner) await audit(req.user, 'event.delete', 'event', event._id);
  ok(res, { removed: true });
}

/** iCalendar export so students can add an event to Google/Apple/Outlook calendars. */
export async function eventIcs(req, res) {
  const event = await Event.findOne({ _id: assertObjectId(req.params.id), reviewStatus: 'approved' }).lean();
  if (!event) throw ApiError.notFound('Event not found');
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s = '') => String(s).replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DIU Student Hub//Events//EN',
    'BEGIN:VEVENT',
    `UID:${event._id}@diu-student-hub`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(event.startsAt)}`,
    `DTEND:${fmt(event.endsAt || new Date(+new Date(event.startsAt) + 2 * 3600 * 1000))}`,
    `SUMMARY:${esc(event.title)}`,
    `DESCRIPTION:${esc(event.description.slice(0, 1000))}`,
    `LOCATION:${esc(event.venue || event.meetingUrl || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="event.ics"');
  res.send(ics);
}
