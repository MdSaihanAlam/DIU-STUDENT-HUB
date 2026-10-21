import mongoose from 'mongoose';

const { Schema } = mongoose;

export const EVENT_CATEGORIES = [
  'seminar',
  'workshop',
  'conference',
  'career_fair',
  'club',
  'competition',
  'academic_deadline',
  'research_presentation',
  'announcement',
  'other',
];

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, enum: EVENT_CATEGORIES, default: 'other', index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: Date,
    venue: { type: String, trim: true, maxlength: 160 },
    meetingUrl: { type: String, trim: true },
    organizer: { type: String, required: true, trim: true, maxlength: 120 },
    registrationUrl: { type: String, trim: true },
    sourceUrl: { type: String, trim: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Official = published by verified faculty / staff. Everything else is labeled community-submitted.
    official: { type: Boolean, default: false },
    reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewNote: String,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

eventSchema.index({ title: 'text', description: 'text', organizer: 'text' });

export const Event = mongoose.model('Event', eventSchema);
