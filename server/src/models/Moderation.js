import mongoose from 'mongoose';

const { Schema } = mongoose;

export const REPORT_TARGETS = ['post', 'comment', 'resource', 'housing', 'research', 'career', 'event', 'user', 'community', 'message'];
export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'misinformation', 'scam', 'copyright', 'malicious_file', 'inappropriate', 'incorrect', 'other'];

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: REPORT_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 2000 },
    // Copyright takedown fields (reason === 'copyright')
    takedown: {
      claimantName: { type: String, trim: true, maxlength: 120 },
      originalWork: { type: String, trim: true, maxlength: 300 },
      goodFaith: Boolean,
    },
    status: { type: String, enum: ['open', 'actioned', 'dismissed'], default: 'open', index: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: { type: String, maxlength: 1000 },
    resolvedAt: Date,
  },
  { timestamps: true }
);
reportSchema.index({ targetType: 1, targetId: 1 });

const verificationRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedAffiliation: { type: String, enum: ['student', 'faculty', 'alumni'], required: true },
    // Free-text evidence such as a DIU email, student ID number, designation or graduation year.
    // Do not ask for national ID / passport scans.
    evidence: { type: String, trim: true, maxlength: 1000 },
    evidenceUrl: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, maxlength: 1000 },
    reviewedAt: Date,
  },
  { timestamps: true }
);

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, maxlength: 40 },
    targetId: { type: Schema.Types.ObjectId },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditLogSchema.index({ createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
export const VerificationRequest = mongoose.model('VerificationRequest', verificationRequestSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
