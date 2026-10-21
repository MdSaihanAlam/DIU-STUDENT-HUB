import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema } = mongoose;

/**
 * Two orthogonal role concepts:
 *  - affiliation: who the person is at DIU (student / faculty / alumni). Self-declared,
 *    and only trusted once `affiliationVerified` is set by a moderator via a VerificationRequest.
 *  - role: platform privileges (member / moderator / admin). Never settable by the user.
 */
export const AFFILIATIONS = ['student', 'faculty', 'alumni'];
export const ROLES = ['member', 'moderator', 'admin'];

// Fields safe to show to other signed-in members.
export const PUBLIC_USER_FIELDS = 'name avatarUrl department program batch affiliation affiliationVerified headline role';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, default: false },

    affiliation: { type: String, enum: AFFILIATIONS, default: 'student' },
    affiliationVerified: { type: Boolean, default: false },
    role: { type: String, enum: ROLES, default: 'member' },

    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    program: { type: String, trim: true, maxlength: 80 },
    batch: { type: String, trim: true, maxlength: 30 },
    headline: { type: String, trim: true, maxlength: 140 },
    bio: { type: String, trim: true, maxlength: 1000 },
    avatarUrl: { type: String },
    skills: [{ type: String, trim: true, maxlength: 40 }],
    links: {
      linkedin: String,
      website: String,
      github: String,
      orcid: String,
    },
    onboarded: { type: Boolean, default: false },

    privacy: {
      profileVisibility: { type: String, enum: ['members', 'connections', 'private'], default: 'members' },
      showEmail: { type: Boolean, default: false },
      allowMessagesFrom: { type: String, enum: ['everyone', 'connections', 'nobody'], default: 'everyone' },
    },
    notificationPrefs: {
      social: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      moderation: { type: Boolean, default: true },
      events: { type: Boolean, default: true },
      careers: { type: Boolean, default: true },
    },
    blocked: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    status: { type: String, enum: ['active', 'suspended', 'deletion_requested', 'deleted'], default: 'active', index: true },
    suspendedReason: String,
    deletionRequestedAt: Date,

    // Incremented to invalidate all existing sessions (password change, suspension).
    tokenVersion: { type: Number, default: 0 },
    passwordReset: { tokenHash: { type: String, select: false }, expiresAt: { type: Date, select: false } },
    emailVerifyTokenHash: { type: String, select: false },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', headline: 'text', skills: 'text' });
userSchema.index({ department: 1, affiliation: 1 });

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.virtual('isStaff').get(function isStaff() {
  return this.role === 'admin' || this.role === 'moderator';
});

/** Shape returned to the signed-in owner of the account. */
userSchema.methods.toSelf = function toSelf() {
  const o = this.toObject({ virtuals: false });
  delete o.passwordHash;
  delete o.passwordReset;
  delete o.emailVerifyTokenHash;
  delete o.tokenVersion;
  delete o.__v;
  return o;
};

export const User = mongoose.model('User', userSchema);
