import mongoose from 'mongoose';

const { Schema } = mongoose;

export const RESOURCE_TYPES = ['notes', 'slides', 'book', 'question_paper', 'lab_manual', 'assignment', 'other'];

const academicResourceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000 },
    courseCode: { type: String, trim: true, uppercase: true, maxlength: 20, index: true },
    courseTitle: { type: String, trim: true, maxlength: 120 },
    department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    semester: { type: String, trim: true, maxlength: 30 },
    topic: { type: String, trim: true, maxlength: 80 },
    resourceType: { type: String, enum: RESOURCE_TYPES, default: 'notes' },
    // Metadata only. The binary lives in the storage service under `file.key`.
    file: {
      key: { type: String, required: true },
      originalName: String,
      mime: String,
      size: Number,
    },
    attribution: { type: String, trim: true, maxlength: 300 }, // original author / source of the material
    uploader: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    downloads: { type: Number, default: 0 },
    ratings: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        value: { type: Number, min: 1, max: 5 },
        comment: { type: String, trim: true, maxlength: 500 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'removed'], default: 'pending', index: true },
    reviewNote: String,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

academicResourceSchema.index({ title: 'text', courseCode: 'text', courseTitle: 'text', topic: 'text', description: 'text' });

export const AcademicResource = mongoose.model('AcademicResource', academicResourceSchema);
