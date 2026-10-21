import { Notification, User } from '../models/index.js';

const PREF_FOR_TYPE = {
  reaction: 'social',
  comment: 'social',
  reply: 'social',
  mention: 'social',
  connection_request: 'social',
  connection_accepted: 'social',
  mentorship_request: 'social',
  community: 'social',
  message: 'messages',
  housing_response: 'messages',
  research_collaboration: 'messages',
  resource_review: 'moderation',
  research_review: 'moderation',
  submission_review: 'moderation',
  verification: 'moderation',
  event_reminder: 'events',
  career_deadline: 'careers',
};

/**
 * Create an in-app notification, honouring the recipient's preferences and block list.
 * Never throws: a failed notification must not break the action that triggered it.
 */
export async function notify({ user, type, actor, message, link, dedupeKey }) {
  try {
    if (!user) return;
    const userId = user._id || user;
    const actorId = actor?._id || actor;
    if (actorId && String(actorId) === String(userId)) return;
    const recipient = await User.findById(userId).select('notificationPrefs blocked status').lean();
    if (!recipient || recipient.status !== 'active') return;
    const pref = PREF_FOR_TYPE[type];
    if (pref && recipient.notificationPrefs?.[pref] === false) return;
    if (actorId && recipient.blocked?.some((b) => String(b) === String(actorId))) return;
    await Notification.create({ user: userId, type, actor: actorId, message: message.slice(0, 300), link, dedupeKey });
  } catch (err) {
    if (err?.code !== 11000) console.error('[notify] failed:', err.message);
  }
}
