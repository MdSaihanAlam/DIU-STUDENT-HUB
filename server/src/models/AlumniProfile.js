import mongoose from 'mongoose';

const { Schema } = mongoose;

const alumniProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    graduationYear: { type: Number, min: 1995, max: 2100, index: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    jobTitle: { type: String, trim: true, maxlength: 100 },
    employer: { type: String, trim: true, maxlength: 100, index: true },
    industry: { type: String, trim: true, maxlength: 60, index: true },
    location: { type: String, trim: true, maxlength: 80 },
    skills: [{ type: String, trim: true, maxlength: 40 }],
    interests: [{ type: String, trim: true, maxlength: 40 }],
    careerJourney: { type: String, trim: true, maxlength: 4000 },
    achievements: [{ type: String, trim: true, maxlength: 200 }],
    advice: { type: String, trim: true, maxlength: 2000 },
    mentorshipAvailable: { type: Boolean, default: false },
    referralsNote: { type: String, trim: true, maxlength: 600 },
    linkedin: String,
    website: String,
    // Opt-in only. Hidden unless the alumnus chooses to share it with members.
    contactEmail: { type: String, trim: true, maxlength: 120 },
    shareContact: { type: Boolean, default: false },
    visibility: { type: String, enum: ['members', 'hidden'], default: 'members' },
    successStory: { title: String, body: { type: String, maxlength: 4000 }, featured: { type: Boolean, default: false } },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

alumniProfileSchema.index({ jobTitle: 'text', employer: 'text', industry: 'text', skills: 'text' });

export const AlumniProfile = mongoose.model('AlumniProfile', alumniProfileSchema);
