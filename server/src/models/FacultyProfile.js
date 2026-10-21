import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Directory entry for a faculty member. Managed by administrators (or by the faculty member
 * once their account is verified and linked via `user`).
 */
const facultyProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    designation: { type: String, trim: true, maxlength: 80 },
    designationVerified: { type: Boolean, default: false },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    photoUrl: String,
    qualifications: [{ type: String, trim: true, maxlength: 200 }],
    researchInterests: [{ type: String, trim: true, maxlength: 60 }],
    publications: [
      {
        title: { type: String, trim: true, maxlength: 300 },
        venue: { type: String, trim: true, maxlength: 200 },
        year: Number,
        url: String,
      },
    ],
    projects: [{ type: String, trim: true, maxlength: 200 }],
    website: String,
    orcid: String,
    // Only officially published contact details, or ones the person explicitly agreed to share.
    publicContact: { type: String, trim: true, maxlength: 200 },
    verified: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

facultyProfileSchema.index({ name: 'text', researchInterests: 'text' });

export const FacultyProfile = mongoose.model('FacultyProfile', facultyProfileSchema);
