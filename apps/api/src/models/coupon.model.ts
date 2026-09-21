import mongoose, { Document, Schema } from 'mongoose';

export interface ICoupon extends Document {
  code:          string;
  discountType:  'percent' | 'flat';
  discountValue: number;
  description:   string;
  expiryDate:    string | null;
  active:        boolean;
  customerPhone: string | null;
  usedAt:        Date | null;   // ← added: set once this coupon is redeemed on a bill
  createdAt:     Date;
  updatedAt:     Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code:          { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType:  { type: String, enum: ['percent', 'flat'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    description:   { type: String, default: '' },
    expiryDate:    { type: String, default: null },
    active:        { type: Boolean, default: true },
    customerPhone: { type: String, default: null },
    usedAt:        { type: Date, default: null },   // ← added
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);