import { z } from 'zod';
import {
  boolish,
  email,
  objectId,
  optDate,
  optObjectId,
  optText,
  optUrl,
  password,
  stringList,
  text,
} from './common.js';
import {
  BOOKMARK_TYPES,
  COMMUNITY_TYPES,
  EVENT_CATEGORIES,
  HOUSING_TYPES,
  OPPORTUNITY_TYPES,
  POST_TYPES,
  REACTION_TYPES,
  REPORT_REASONS,
  REPORT_TARGETS,
  RESEARCH_STATUS,
  RESOURCE_TYPES,
} from '../models/index.js';

// ---------- Auth ----------
export const registerSchema = z.object({
  name: text(80, 2),
  email,
  password,
  affiliation: z.enum(['student', 'faculty', 'alumni']).default('student'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms and community guidelines' }) }),
});
export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(128) });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password });
export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });

// ---------- Profile ----------
export const profileSchema = z.object({
  name: text(80, 2).optional(),
  department: optObjectId,
  program: optText(80),
  batch: optText(30),
  headline: optText(140),
  bio: optText(1000),
  skills: stringList(20, 40),
  links: z.object({ linkedin: optUrl, website: optUrl, github: optUrl, orcid: optText(40) }).partial().optional(),
  onboarded: z.boolean().optional(),
});
export const settingsSchema = z.object({
  privacy: z
    .object({
      profileVisibility: z.enum(['members', 'connections', 'private']),
      showEmail: z.boolean(),
      allowMessagesFrom: z.enum(['everyone', 'connections', 'nobody']),
    })
    .partial()
    .optional(),
  notificationPrefs: z
    .object({ social: z.boolean(), messages: z.boolean(), moderation: z.boolean(), events: z.boolean(), careers: z.boolean() })
    .partial()
    .optional(),
});
export const connectSchema = z.object({ kind: z.enum(['connection', 'mentorship']).default('connection'), message: optText(500) });
export const respondSchema = z.object({ accept: z.boolean() });

// ---------- Posts ----------
export const postSchema = z.object({
  type: z.enum(POST_TYPES).default('post'),
  content: z.string().trim().max(5000).default(''),
  community: optObjectId,
  department: optObjectId,
  pollOptions: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      let arr = v;
      if (typeof v === 'string') {
        try {
          arr = JSON.parse(v);
        } catch {
          arr = v.split('\n');
        }
      }
      return (Array.isArray(arr) ? arr : []).map((s) => String(s).trim().slice(0, 120)).filter(Boolean).slice(0, 6);
    }),
});
export const postUpdateSchema = z.object({ content: z.string().trim().max(5000) });
export const reactSchema = z.object({ type: z.enum(REACTION_TYPES).default('like') });
export const voteSchema = z.object({ option: z.coerce.number().int().min(0).max(5) });
export const shareSchema = z.object({ content: z.string().trim().max(2000).default('') });
export const commentSchema = z.object({ content: text(2000), parent: optObjectId });

// ---------- Bookmarks & reports ----------
export const bookmarkSchema = z.object({ targetType: z.enum(BOOKMARK_TYPES), targetId: objectId });
export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: objectId,
  reason: z.enum(REPORT_REASONS),
  details: optText(2000),
  takedown: z.object({ claimantName: optText(120), originalWork: optText(300), goodFaith: z.boolean().optional() }).optional(),
});

// ---------- Resources ----------
export const resourceSchema = z.object({
  title: text(160, 3),
  description: optText(2000),
  courseCode: optText(20),
  courseTitle: optText(120),
  department: optObjectId,
  semester: optText(30),
  topic: optText(80),
  resourceType: z.enum(RESOURCE_TYPES).default('notes'),
  attribution: optText(300),
  rightsConfirmed: boolish.refine((v) => v === true, 'Please confirm you have the right to share this file'),
});
export const rateSchema = z.object({ value: z.coerce.number().int().min(1).max(5), comment: optText(500) });

// ---------- Housing ----------
const housingBase = {
  title: text(140, 5),
  description: optText(3000),
  type: z.enum(HOUSING_TYPES),
  rent: z.coerce.number().min(0).max(1000000),
  area: text(80, 2),
  locationNote: optText(200),
  availableFrom: z.coerce.date(),
  facilities: stringList(20, 40),
  rules: optText(1000),
  genderPreference: z.enum(['any', 'female', 'male']).default('any'),
  contactMethod: z.enum(['in_app', 'phone', 'email']).default('in_app'),
  contactValue: optText(120),
  durationDays: z.coerce.number().int().min(7).max(90).default(30),
};
export const housingSchema = z.object(housingBase).superRefine((v, ctx) => {
  if (v.contactMethod !== 'in_app' && !v.contactValue) {
    ctx.addIssue({ code: 'custom', path: ['contactValue'], message: 'Add the phone number or email you want to share' });
  }
});
export const housingUpdateSchema = z.object(housingBase).partial();
export const housingStatusSchema = z.object({ status: z.enum(['active', 'rented']) });
export const contactOwnerSchema = z.object({ message: text(2000, 2) });

// ---------- Research ----------
export const researchSchema = z.object({
  title: text(200, 5),
  abstract: text(3000, 20),
  domain: text(80, 2),
  department: optObjectId,
  status: z.enum(RESEARCH_STATUS).default('ongoing'),
  affiliation: z.enum(['student', 'faculty', 'joint']).default('student'),
  contributors: z
    .array(z.object({ name: text(100), role: optText(60), user: optObjectId }))
    .max(20)
    .optional(),
  supervisor: optObjectId,
  supervisorName: optText(100),
  startDate: optDate,
  endDate: optDate,
  methodology: optText(3000),
  technologies: stringList(20, 40),
  progress: optText(3000),
  links: z.object({ repo: optUrl, dataset: optUrl, paper: optUrl, doi: optText(120), preprint: optUrl }).partial().optional(),
  collaborationOpen: z.boolean().optional(),
  collaborationNote: optText(600),
});
export const researchUpdateSchema = researchSchema.partial();
export const researchPostSchema = z.object({ content: text(2000, 2) });
export const collaborateSchema = z.object({ message: text(1500, 10) });

// ---------- Alumni ----------
export const alumniSchema = z.object({
  graduationYear: z.coerce.number().int().min(1995).max(2100).optional(),
  department: optObjectId,
  jobTitle: optText(100),
  employer: optText(100),
  industry: optText(60),
  location: optText(80),
  skills: stringList(20, 40),
  interests: stringList(20, 40),
  careerJourney: optText(4000),
  achievements: stringList(10, 200),
  advice: optText(2000),
  mentorshipAvailable: z.boolean().optional(),
  referralsNote: optText(600),
  linkedin: optUrl,
  website: optUrl,
  contactEmail: z.union([email, z.literal('')]).optional(),
  shareContact: z.boolean().optional(),
  visibility: z.enum(['members', 'hidden']).optional(),
  successStory: z.object({ title: optText(140), body: optText(4000) }).optional(),
});

// ---------- Careers ----------
export const careerSchema = z.object({
  title: text(160, 3),
  type: z.enum(OPPORTUNITY_TYPES),
  organization: text(120, 2),
  location: optText(100),
  mode: z.enum(['onsite', 'remote', 'hybrid']).default('onsite'),
  description: text(5000, 20),
  eligibility: optText(2000),
  deadline: optDate,
  applyUrl: optUrl,
  sourceUrl: optUrl,
  tags: stringList(10, 30),
});

// ---------- Events ----------
export const eventSchema = z
  .object({
    title: text(160, 3),
    description: text(5000, 10),
    category: z.enum(EVENT_CATEGORIES).default('other'),
    startsAt: z.coerce.date(),
    endsAt: optDate,
    venue: optText(160),
    meetingUrl: optUrl,
    organizer: text(120, 2),
    registrationUrl: optUrl,
    sourceUrl: optUrl,
    department: optObjectId,
  })
  .refine((v) => !v.endsAt || v.endsAt >= v.startsAt, { path: ['endsAt'], message: 'End time must be after the start time' })
  .refine((v) => v.venue || v.meetingUrl, { path: ['venue'], message: 'Add a venue or a meeting link' });

// ---------- Communities ----------
export const communitySchema = z.object({
  name: text(80, 3),
  type: z.enum(COMMUNITY_TYPES).default('study_group'),
  description: optText(2000),
  department: optObjectId,
  visibility: z.enum(['public', 'private']).default('public'),
  rules: optText(2000),
});
export const communityUpdateSchema = z.object({
  description: optText(2000),
  rules: optText(2000),
  visibility: z.enum(['public', 'private']).optional(),
  pinnedResources: z
    .array(z.object({ title: text(120), url: z.string().trim().max(500) }))
    .max(10)
    .optional(),
});
export const memberActionSchema = z.object({ action: z.enum(['approve', 'remove', 'promote', 'demote']) });

// ---------- Messaging ----------
export const startConversationSchema = z.object({ userId: objectId, message: text(4000), context: optText(140) });
export const messageSchema = z.object({ body: text(4000) });

// ---------- Verification & moderation ----------
export const verificationSchema = z.object({
  requestedAffiliation: z.enum(['student', 'faculty', 'alumni']),
  evidence: text(1000, 10),
});
export const reviewDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: optText(1000),
  verified: z.boolean().optional(),
});
export const reportActionSchema = z.object({
  action: z.enum(['dismiss', 'remove_content', 'suspend_user']),
  note: optText(1000),
});
export const roleSchema = z.object({ role: z.enum(['member', 'moderator', 'admin']) });
export const suspendSchema = z.object({ reason: text(500, 3) });

export const departmentSchema = z.object({
  name: text(120, 2),
  code: text(12, 2),
  faculty: optText(120),
  overview: optText(3000),
  programs: z
    .array(z.object({ name: text(120), level: z.enum(['undergraduate', 'graduate', 'diploma']) }))
    .max(30)
    .optional(),
  researchAreas: stringList(30, 80),
  curriculumUrl: optUrl,
  officialUrl: optUrl,
  isDemo: z.boolean().optional(),
});

export const facultySchema = z.object({
  name: text(100, 2),
  designation: optText(80),
  designationVerified: z.boolean().optional(),
  department: objectId,
  qualifications: stringList(10, 200),
  researchInterests: stringList(20, 60),
  publications: z
    .array(z.object({ title: text(300), venue: optText(200), year: z.coerce.number().int().min(1950).max(2100).optional(), url: optUrl }))
    .max(100)
    .optional(),
  projects: stringList(30, 200),
  website: optUrl,
  orcid: optText(40),
  publicContact: optText(200),
  verified: z.boolean().optional(),
  user: optObjectId,
  isDemo: z.boolean().optional(),
});
