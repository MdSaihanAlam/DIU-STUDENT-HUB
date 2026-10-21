import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 12 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    faculty: { type: String, trim: true, maxlength: 120 }, // e.g. "Faculty of Science & Engineering"
    overview: { type: String, trim: true, maxlength: 3000 },
    programs: [{ name: { type: String, trim: true }, level: { type: String, enum: ['undergraduate', 'graduate', 'diploma'] } }],
    researchAreas: [{ type: String, trim: true }],
    curriculumUrl: String,
    officialUrl: String,
    // Descriptions created for local development must be labeled so nobody mistakes them for official facts.
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Department = mongoose.model('Department', departmentSchema);
