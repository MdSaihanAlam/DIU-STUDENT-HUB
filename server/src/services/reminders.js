import { Bookmark, CareerOpportunity, Event } from '../models/index.js';
import { notify } from './notify.js';

const HOUR = 60 * 60 * 1000;

/**
 * Create reminder notifications for saved events starting within 24h and saved
 * opportunities whose deadline is within 3 days. Dedupe keys make this idempotent.
 */
export async function runReminders(now = new Date()) {
  const soonEvents = await Event.find({ reviewStatus: 'approved', startsAt: { $gte: now, $lte: new Date(+now + 24 * HOUR) } })
    .select('title startsAt')
    .lean();
  const soonJobs = await CareerOpportunity.find({ reviewStatus: 'approved', deadline: { $gte: now, $lte: new Date(+now + 72 * HOUR) } })
    .select('title deadline')
    .lean();

  const work = [];
  if (soonEvents.length) {
    const saves = await Bookmark.find({ targetType: 'event', targetId: { $in: soonEvents.map((e) => e._id) } }).lean();
    const byId = new Map(soonEvents.map((e) => [String(e._id), e]));
    for (const s of saves) {
      const e = byId.get(String(s.targetId));
      work.push(
        notify({ user: s.user, type: 'event_reminder', message: `Starting soon: ${e.title}`, link: `/events/${e._id}`, dedupeKey: `event:${e._id}` })
      );
    }
  }
  if (soonJobs.length) {
    const saves = await Bookmark.find({ targetType: 'career', targetId: { $in: soonJobs.map((j) => j._id) } }).lean();
    const byId = new Map(soonJobs.map((j) => [String(j._id), j]));
    for (const s of saves) {
      const j = byId.get(String(s.targetId));
      work.push(
        notify({ user: s.user, type: 'career_deadline', message: `Deadline approaching: ${j.title}`, link: `/careers/${j._id}`, dedupeKey: `career:${j._id}` })
      );
    }
  }
  await Promise.all(work);
  return work.length;
}

export function startReminderJob() {
  const tick = () => runReminders().catch((err) => console.error('[reminders]', err.message));
  const first = setTimeout(tick, 10_000);
  const timer = setInterval(tick, HOUR);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
