import { Bookmark } from '../models/index.js';

/** Add `saved: boolean` to each item based on the viewer's bookmarks. */
export async function withSaved(items, user, targetType) {
  if (!user || !items.length) return items.map((i) => ({ ...i, saved: false }));
  const marks = await Bookmark.find({ user: user._id, targetType, targetId: { $in: items.map((i) => i._id) } })
    .select('targetId')
    .lean();
  const set = new Set(marks.map((m) => String(m.targetId)));
  return items.map((i) => ({ ...i, saved: set.has(String(i._id)) }));
}

export const sameId = (a, b) => a != null && b != null && String(a._id || a) === String(b._id || b);

export const isOwner = (user, ownerId) => !!user && sameId(user._id, ownerId);
