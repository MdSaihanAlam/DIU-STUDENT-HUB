import mongoose from 'mongoose';

const { Schema } = mongoose;

export const COMMUNITY_TYPES = ['department', 'batch', 'course', 'research', 'technology', 'study_group', 'project', 'club'];

const communitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: COMMUNITY_TYPES, default: 'study_group', index: true },
    description: { type: String, trim: true, maxlength: 2000 },
    department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    // public = anyone can join; private = join requests need moderator approval
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    memberCount: { type: Number, default: 0 },
    pinnedResources: [{ title: { type: String, maxlength: 120 }, url: String }],
    rules: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['active', 'archived', 'removed'], default: 'active' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

communitySchema.index({ name: 'text', description: 'text' });

const membershipSchema = new Schema(
  {
    community: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['member', 'moderator', 'owner'], default: 'member' },
    status: { type: String, enum: ['active', 'pending'], default: 'active' },
  },
  { timestamps: true }
);

membershipSchema.index({ community: 1, user: 1 }, { unique: true });

export const Community = mongoose.model('Community', communitySchema);
export const CommunityMembership = mongoose.model('CommunityMembership', membershipSchema);
