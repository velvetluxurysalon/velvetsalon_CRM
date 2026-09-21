import mongoose, { Document, Schema } from 'mongoose';

export type Gender = 'male' | 'female' | 'other';
export type MembershipTier = 'none' | 'silver' | 'gold' | 'platinum';

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface IServiceRecord {
  _id: mongoose.Types.ObjectId;
  date: string;
  service: string;
  staff: string;
  duration: number;
  price: number;
  rating?: number;
  appointmentId?: mongoose.Types.ObjectId;   // ← added
}

export interface IVisit {
  _id: mongoose.Types.ObjectId;
  date: string;
  services: string[];
  staff: string;
  total: number;
  notes: string;
  appointmentId?: mongoose.Types.ObjectId;   // ← added
}

export interface IReferral {
  _id: mongoose.Types.ObjectId;
  referredName: string;
  referredPhone: string;
  date: string;
  status: 'pending' | 'converted' | 'credited';
  reward: number;
}

// ─── Main Customer interface ──────────────────────────────────────────────────

export interface ICustomer extends Document {
  name: string;
  phone: string;
  email?: string;
  gender?: Gender;
  dob?: Date;
  anniversary?: Date;
  loyaltyPoints: number;
  walletBalance: number;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;  // ObjectId ref — never set from form string
  referredByCode: string;                // plain string referral code from form
  membershipId?: mongoose.Types.ObjectId;
  hasAnnualPass: boolean;
  annualPassExpiry: string;
  visitCount: number;
  totalSpent: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // ── fields for CustomersPage ──
  joinDate: string;
  membershipTier: MembershipTier;
  membershipExpiry: string;
  tags: string[];
  lastVisit: string;
  visits: IVisit[];
  services: IServiceRecord[];
  referrals: IReferral[];
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const ServiceRecordSchema = new Schema<IServiceRecord>(
  {
    date:          { type: String, required: true },
    service:       { type: String, required: true },
    staff:         { type: String, default: '' },
    duration:      { type: Number, default: 30 },
    price:         { type: Number, default: 0 },
    rating:        { type: Number, min: 1, max: 5 },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null }, // ← added
  },
  { _id: true }
);

const VisitSchema = new Schema<IVisit>(
  {
    date:          { type: String, required: true },
    services:      [{ type: String }],
    staff:         { type: String, default: '' },
    total:         { type: Number, default: 0 },
    notes:         { type: String, default: '' },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null }, // ← added
  },
  { _id: true }
);

const ReferralSchema = new Schema<IReferral>(
  {
    referredName:  { type: String, required: true },
    referredPhone: { type: String, required: true },
    date:          { type: String, required: true },
    status:        { type: String, enum: ['pending', 'converted', 'credited'], default: 'pending' },
    reward:        { type: Number, default: 100 },
  },
  { _id: true }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const CustomerSchema = new Schema<ICustomer>(
  {
    name:          { type: String, required: true, trim: true },
    phone:         { type: String, required: true, unique: true, trim: true },
    email:         { type: String, lowercase: true, trim: true },
    gender:        { type: String, enum: ['male', 'female', 'other'] },
    dob:           { type: Date },
    anniversary: { type: Date },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    walletBalance: { type: Number, default: 0, min: 0 },
    referralCode:  { type: String, unique: true },

    // ✅ referredBy is ObjectId only — never accept a raw string here
    referredBy:    { type: Schema.Types.ObjectId, ref: 'Customer', default: undefined },
    membershipId:  { type: Schema.Types.ObjectId, ref: 'Membership', default: undefined },

    visitCount:    { type: Number, default: 0 },
    totalSpent:    { type: Number, default: 0 },
    notes:         { type: String },
    isActive:      { type: Boolean, default: true },

    joinDate:         { type: String, default: () => new Date().toISOString().slice(0, 10) },
    membershipTier:   { type: String, enum: ['none', 'silver', 'gold', 'platinum'], default: 'none' },
     membershipExpiry: { type: String, default: '' },
    hasAnnualPass:    { type: Boolean, default: false },
    annualPassExpiry: { type: String, default: '' },
    tags:             [{ type: String }],
    lastVisit:        { type: String, default: '' },
    referredByCode:   { type: String, default: '' },  // plain string from form
    visits:           [VisitSchema],
    services:         [ServiceRecordSchema],
    referrals:        [ReferralSchema],
  },
  { timestamps: true }
);

// ─── Auto-generate referral code — async style (no next callback) ─────────────
// ✅ Using async pre-hook avoids "next is not a function" in newer Mongoose versions

CustomerSchema.pre('save', function () {
  if (!this.referralCode) {
    this.referralCode = 'VLV-' + Math.random().toString(36).toUpperCase().slice(2, 8);
  }
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

CustomerSchema.index({ name: 'text', phone: 'text', email: 'text' });
CustomerSchema.index({ isActive: 1 });
CustomerSchema.index({ membershipTier: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);