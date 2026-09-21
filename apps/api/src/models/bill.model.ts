import mongoose, { Document, Schema } from 'mongoose';

export interface IBillItem {
  serviceId:   string;
  serviceName: string;
  staffId:     string;
  staffName:   string;   // ← add this
  price:       number;
  duration:    number;
}

export interface IBill extends Document {
  billNumber:         string;
  customer:           mongoose.Types.ObjectId | null;
  phone:              string;
  customerName:       string;
  items:              IBillItem[];
  subtotal:           number;
  membershipDiscount: number;
  discountType:       'percent' | 'flat';
  discountValue:      number;
  discountAmount:     number;
    loyaltyRedeemed:    number;
  referralDiscount:   number; // ← ADD THIS LINE
  total:              number;
  paymentMethod:      'cash' | 'card' | 'upi';
  status:             'paid' | 'pending';
  notes:              string;
  date:               string;
  staffRating:        number | null;
  appointment:        mongoose.Types.ObjectId | null;   // ← added
  couponCode:     string | null;   // ← add
  couponDiscount: number;          // ← add
  createdAt:          Date;
  updatedAt:          Date;
  
}

const billItemSchema = new Schema<IBillItem>(
  {
    serviceId:   { type: String, required: true },
    serviceName: { type: String, required: true },
    staffId:     { type: String, required: true },
    staffName:   { type: String, default: '' },   // ← added
    price:       { type: Number, required: true },
    duration:    { type: Number, required: true },
  },
  { _id: false }
);

const billSchema = new Schema<IBill>(
  {
    billNumber:         { type: String, unique: true },
    customer:           { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    phone:              { type: String, required: true },
    customerName:       { type: String, default: 'Walk-in' },
    items:              [billItemSchema],
    subtotal:           { type: Number, required: true, default: 0 },
    membershipDiscount: { type: Number, default: 0 },
    discountType:       { type: String, enum: ['percent', 'flat'], default: 'percent' },
    discountValue:      { type: Number, default: 0 },
    discountAmount:     { type: Number, default: 0 },
       loyaltyRedeemed:    { type: Number, default: 0 },
    referralDiscount:   { type: Number, default: 0 }, // ← ADD THIS LINE
    total:              { type: Number, required: true },
    paymentMethod:      { type: String, enum: ['cash', 'card', 'upi'], required: true },
    status:             { type: String, enum: ['paid', 'pending'], default: 'paid' },
    notes:              { type: String, default: '' },
    date:               { type: String, default: () => new Date().toISOString().slice(0, 10) },
    staffRating:        { type: Number, default: null, min: 1, max: 5 },
    appointment:        { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },  // ← added
       couponCode:     { type: String, default: null },   // ← add
    couponDiscount: { type: Number, default: 0 },       // ← add
  },
  { timestamps: true }
);

// Auto-generate bill number before saving
// ✅ CORRECT — don't accept next param with async, just return a Promise
// ✅ NEW — always finds the true highest number and increments
billSchema.pre('save', async function () {
  if (!this.billNumber) {
    // Find the bill with the highest billNumber
   const last = await mongoose.model<IBill>('Bill')
      .findOne({ billNumber: { $regex: /^VLT-\d+$/ } })
      .sort({ billNumber: -1 })
      .select('billNumber')
      .lean();

    let nextNum = 1;
    if (last?.billNumber) {
      // Extract the numeric part: "VLT-00003" → 3
      const lastNum = parseInt(last.billNumber.replace('VLT-', ''), 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }

    this.billNumber = `VLT-${String(nextNum).padStart(5, '0')}`;
  }
});

export const Bill = mongoose.model<IBill>('Bill', billSchema);