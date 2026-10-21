/**
 * Brute-force protection for sign-in, keyed by email address.
 *
 * After MAX_FREE failures the account is locked for a period that doubles with each further
 * failure (1 min, 2, 4 … capped at 30 min). The same rules apply whether or not the email
 * exists, so lockout responses never reveal which accounts are registered.
 *
 * State is kept in process memory. Behind several API instances, move it to a shared store
 * (e.g. Redis) so all instances see the same counters.
 */
const MAX_FREE = 5;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_MS = 30 * 60 * 1000;
const FORGET_AFTER_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 50_000;

const attempts = new Map(); // email -> { failures, lockedUntil, lastAt }

function prune(now) {
  if (attempts.size < MAX_ENTRIES) return;
  for (const [k, v] of attempts) {
    if (now - v.lastAt > FORGET_AFTER_MS) attempts.delete(k);
  }
  // Still too big: drop the oldest entries (Map keeps insertion order).
  while (attempts.size >= MAX_ENTRIES) attempts.delete(attempts.keys().next().value);
}

/** Milliseconds remaining on a lock, or 0 if sign-in may be attempted. */
export function lockRemaining(email, now = Date.now()) {
  const entry = attempts.get(email);
  if (!entry) return 0;
  if (now - entry.lastAt > FORGET_AFTER_MS) {
    attempts.delete(email);
    return 0;
  }
  return Math.max(0, entry.lockedUntil - now);
}

export function recordFailure(email, now = Date.now()) {
  prune(now);
  const entry = attempts.get(email) || { failures: 0, lockedUntil: 0, lastAt: now };
  entry.failures += 1;
  entry.lastAt = now;
  if (entry.failures >= MAX_FREE) {
    const lockMs = Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** (entry.failures - MAX_FREE));
    entry.lockedUntil = now + lockMs;
  }
  attempts.set(email, entry);
  return entry;
}

export function recordSuccess(email) {
  attempts.delete(email);
}

export function resetLoginGuard() {
  attempts.clear();
}
