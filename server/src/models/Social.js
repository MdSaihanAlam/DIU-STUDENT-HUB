import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Connection or mentorship request between two members. */
const connectionSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['connection', 'mentorship'], default: 'connection' },
    message: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);
connectionSchema.index({ requester: 1, recipient: 1, kind: 1 }, { unique: true });

/** Polymorphic bookmark ("saved items"). */
export const BOOKMARK_TYPES = ['post', 'resource', 'housing', 'research', 'career', 'event'];
const bookmarkSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: BOOKMARK_TYPES, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);
bookmarkSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });

/** Two-person conversation. Starts as a "request" unless the recipient allows open messages. */
const conversationSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    status: { type: String, enum: ['request', 'active', 'blocked'], default: 'request' },
    startedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, maxlength: 140 },
    context: { type: String, maxlength: 140 }, // e.g. "About your listing: Mess seat near campus"
  },
  { timestamps: true }
);
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);
messageSchema.index({ conversation: 1, createdAt: -1 });

export const NOTIFICATION_TYPES = [
  'reaction',
  'comment',
  'reply',
  'mention',
  'message',
  'connection_request',
  'connection_accepted',
  'mentorship_request',
  'resource_review',
  'research_collaboration',
  'research_review',
  'housing_response',
  'event_reminder',
  'career_deadline',
  'submission_review',
  'verification',
  'community',
  'system',
];
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, required: true, maxlength: 300 },
    link: { type: String, maxlength: 300 },
    read: { type: Boolean, default: false },
    dedupeKey: { type: String }, // prevents duplicate reminders
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

export const Connection = mongoose.model('Connection', connectionSchema);
export const Bookmark = mongoose.model('Bookmark', bookmarkSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
