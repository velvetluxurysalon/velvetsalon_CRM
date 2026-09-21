import mongoose, { Document, Schema } from 'mongoose';

export type SalaryMode = 'monthly' | 'daily' | 'hourly';

export interface IStaff extends Document {
  name:            string;
  role:            string;
  initials:        string;
  color:           string;
  joinDate:        string;   // YYYY-MM-DD
  terminatedDate?: string;   // YYYY-MM-DD
  salary:          number;
  salaryMode:      SalaryMode;
  createdAt:       Date;
  updatedAt:       Date;
}

const StaffSchema = new Schema<IStaff>(
  {
    name:           { type: String, required: true, trim: true },
    role:           { type: String, required: true, trim: true, default: 'Hair & Colour' },
    initials:       { type: String, required: true, trim: true },
    color:          { type: String, required: true, default: '#d4af37' },
    joinDate:       { type: String, required: true },
    terminatedDate: { type: String, default: null },
    salary:         { type: Number, required: true, default: 0 },
    salaryMode:     { type: String, enum: ['monthly', 'daily', 'hourly'], default: 'monthly' },
  },
  { timestamps: true }
);

StaffSchema.index({ joinDate: 1 });

export const Staff = mongoose.model<IStaff>('Staff', StaffSchema);