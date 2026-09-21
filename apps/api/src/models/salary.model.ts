import mongoose, { Document, Schema } from 'mongoose';

export interface ISalaryCredit extends Document {
  staffId:   string;
  amount:    number;
  date:      string;   // YYYY-MM-DD
  note?:     string;
  period:    string;   // e.g. "June 2026"
  createdAt: Date;
  updatedAt: Date;
}

const SalaryCreditSchema = new Schema<ISalaryCredit>(
  {
    staffId: { type: String, required: true, trim: true },
    amount:  { type: Number, required: true, min: 0 },
    date:    { type: String, required: true },
    note:    { type: String, default: '' },
    period:  { type: String, required: true },
  },
  { timestamps: true }
);

SalaryCreditSchema.index({ staffId: 1 });
SalaryCreditSchema.index({ date: 1 });

export const SalaryCredit = mongoose.model<ISalaryCredit>('SalaryCredit', SalaryCreditSchema);