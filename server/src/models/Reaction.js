import mongoose from 'mongoose';

const { Schema } = mongoose;

export const REACTION_TYPES = ['like', 'love', 'insightful', 'support', 'curious'];

const reactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    type: { type: String, enum: REACTION_TYPES, default: 'like' },
  },
  { timestamps: true }
);

reactionSchema.index({ post: 1, user: 1 }, { unique: true });

export const Reaction = mongoose.model('Reaction', reactionSchema);
