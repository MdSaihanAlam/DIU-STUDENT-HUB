import mongoose from 'mongoose';

const { Schema } = mongoose;

export const POST_TYPES = ['post', 'question', 'announcement', 'research_update', 'poll'];

const attachmentSchema = new Schema(
  { url: String, name: String, mime: String, size: Number, kind: { type: String, enum: ['image', 'document'] } },
  { _id: false }
);

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: POST_TYPES, default: 'post' },
    content: { type: String, trim: true, maxlength: 5000, default: '' },
    attachments: [attachmentSchema],
    hashtags: [{ type: String, lowercase: true, trim: true }],
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    community: { type: Schema.Types.ObjectId, ref: 'Community', index: true },
    poll: {
      options: [{ text: { type: String, trim: true, maxlength: 120 }, voters: [{ type: Schema.Types.ObjectId, ref: 'User' }] }],
      closesAt: Date,
    },
    sharedFrom: { type: Schema.Types.ObjectId, ref: 'Post' },
    // Announcements become "official" only when posted by verified faculty or staff.
    official: { type: Boolean, default: false },
    reactionCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    pinned: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'removed'], default: 'active', index: true },
    editedAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

postSchema.index({ content: 'text', hashtags: 'text' });
postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ hashtags: 1, createdAt: -1 });

export const Post = mongoose.model('Post', postSchema);
