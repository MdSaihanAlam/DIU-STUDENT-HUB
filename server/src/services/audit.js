import { AuditLog } from '../models/index.js';

/** Record a privileged action. Meta must not contain secrets or private personal data. */
export async function audit(actor, action, targetType, targetId, meta) {
  try {
    await AuditLog.create({ actor: actor._id || actor, action, targetType, targetId, meta });
  } catch (err) {
    console.error('[audit] failed:', err.message);
  }
}
