import { env } from '../config/env.js';
import { Department } from '../models/index.js';

/**
 * Starter departments for a fresh production database, so new members can complete onboarding.
 * Only names and codes are created (no invented descriptions); admins can edit or add more
 * from Admin → Directory. Runs only when the departments collection is empty.
 */
const STARTER_DEPARTMENTS = [
  ['CSE', 'Computer Science & Engineering', 'Faculty of Science & Engineering'],
  ['EEE', 'Electrical & Electronic Engineering', 'Faculty of Science & Engineering'],
  ['CE', 'Civil Engineering', 'Faculty of Science & Engineering'],
  ['PHR', 'Pharmacy', 'Faculty of Science & Engineering'],
  ['BBA', 'Business Administration', 'Faculty of Business Studies'],
  ['ENG', 'English', 'Faculty of Arts & Humanities'],
  ['LAW', 'Law', 'Faculty of Law'],
  ['ECO', 'Economics', 'Faculty of Social Science'],
  ['SOC', 'Sociology', 'Faculty of Social Science'],
  ['POL', 'Political Science', 'Faculty of Social Science'],
];

export async function ensureStarterDepartments() {
  if (!env.bootstrapDepartments) return 0;
  if (await Department.estimatedDocumentCount()) return 0;
  await Department.insertMany(
    STARTER_DEPARTMENTS.map(([code, name, faculty]) => ({ code, name, faculty, slug: code.toLowerCase(), programs: [], researchAreas: [] }))
  );
  console.log(`[bootstrap] created ${STARTER_DEPARTMENTS.length} starter departments — review them in Admin → Directory`);
  return STARTER_DEPARTMENTS.length;
}

/** Promote a member to admin if their email is listed in ADMIN_EMAILS. Returns true if changed. */
export async function applyAdminBootstrap(user) {
  if (!env.adminEmails.includes(user.email) || user.role === 'admin') return false;
  user.role = 'admin';
  await user.save();
  console.log('[bootstrap] promoted an ADMIN_EMAILS account to admin');
  return true;
}
