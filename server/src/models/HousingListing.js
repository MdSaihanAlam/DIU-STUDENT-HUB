import mongoose from 'mongoose';

const { Schema } = mongoose;

export const HOUSING_TYPES = ['mess_seat', 'sublet', 'shared_room', 'hostel', 'apartment', 'roommate_wanted'];

const housingListingSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 3000 },
    type: { type: String, enum: HOUSING_TYPES, required: true },
    rent: { type: Number, required: true, min: 0, max: 1000000 }, // BDT per month
    area: { type: String, required: true, trim: true, maxlength: 80, index: true },
    locationNote: { type: String, trim: true, maxlength: 200 }, // approximate only, never a full address
    availableFrom: { type: Date, required: true },
    facilities: [{ type: String, trim: true, maxlength: 40 }],
    rules: { type: String, trim: true, maxlength: 1000 },
    genderPreference: { type: String, enum: ['any', 'female', 'male'], default: 'any' },
    photos: [{ type: String }],
    contact: {
      // in_app = only via platform messages (default, most private)
      method: { type: String, enum: ['in_app', 'phone', 'email'], default: 'in_app' },
      value: { type: String, trim: true, maxlength: 120, select: false },
    },
    status: { type: String, enum: ['active', 'rented', 'expired', 'removed'], default: 'active', index: true },
    expiresAt: { type: Date, required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

housingListingSchema.index({ title: 'text', description: 'text', area: 'text' });
housingListingSchema.index({ status: 1, rent: 1 });

export const HousingListing = mongoose.model('HousingListing', housingListingSchema);
