import mongoose from 'mongoose';

const { Schema } = mongoose;

export const OPPORTUNITY_TYPES = ['job', 'internship', 'scholarship', 'admission', 'research_assistant', 'competition', 'hackathon'];

const careerOpportunitySchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: OPPORTUNITY_TYPES, required: true, index: true },
    organization: { type: String, required: true, trim: true, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 100 },
    mode: { type: String, enum: ['onsite', 'remote', 'hybrid'], default: 'onsite' },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    eligibility: { type: String, trim: true, maxlength: 2000 },
    deadline: { type: Date, index: true },
    applyUrl: { type: String, trim: true },
    sourceUrl: { type: String, trim: true },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // verified = checked by moderators against the source; otherwise "community submitted".
    verified: { type: Boolean, default: false },
    reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewNote: String,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

careerOpportunitySchema.index({ title: 'text', organization: 'text', description: 'text', tags: 'text' });

export const CareerOpportunity = mongoose.model('CareerOpportunity', careerOpportunitySchema);
