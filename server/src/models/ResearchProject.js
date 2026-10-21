import mongoose from 'mongoose';

const { Schema } = mongoose;

export const RESEARCH_STATUS = ['proposed', 'ongoing', 'completed', 'published'];

const researchProjectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    abstract: { type: String, required: true, trim: true, maxlength: 3000 },
    domain: { type: String, required: true, trim: true, maxlength: 80, index: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    status: { type: String, enum: RESEARCH_STATUS, default: 'ongoing' },
    lead: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contributors: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, trim: true, maxlength: 100 },
        role: { type: String, trim: true, maxlength: 60 },
      },
    ],
    affiliation: { type: String, enum: ['student', 'faculty', 'joint'], default: 'student' },
    supervisor: { type: Schema.Types.ObjectId, ref: 'FacultyProfile' },
    supervisorName: { type: String, trim: true, maxlength: 100 },
    startDate: Date,
    endDate: Date,
    methodology: { type: String, trim: true, maxlength: 3000 },
    technologies: [{ type: String, trim: true, maxlength: 40 }],
    progress: { type: String, trim: true, maxlength: 3000 },
    links: { repo: String, dataset: String, paper: String, doi: String, preprint: String },
    files: [{ url: String, name: String, mime: String, size: Number }],
    collaborationOpen: { type: Boolean, default: false },
    collaborationNote: { type: String, trim: true, maxlength: 600 },
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    updates: [
      {
        author: { type: Schema.Types.ObjectId, ref: 'User' },
        content: { type: String, trim: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // pending = community submission awaiting review; verified = reviewed by moderators.
    reviewStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
    reviewNote: String,
    featured: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

researchProjectSchema.index({ title: 'text', abstract: 'text', domain: 'text', technologies: 'text' });

export const ResearchProject = mongoose.model('ResearchProject', researchProjectSchema);
