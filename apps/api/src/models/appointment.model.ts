import mongoose, { type Document, Schema } from 'mongoose';

export type AppointmentStatus =
  | 'confirmed'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'pending'
  | 'billed';   // ← added

export interface IAppointment extends Document {
  customer: string;
  phone: string;
  service: string;
  staff: string;
  date: string;        // YYYY-MM-DD
  time: string;         // HH:MM
  duration: number;    // minutes
  status: AppointmentStatus;
  isWalkIn: boolean;
  notes: string;
  price: number;
  staffRating?: number;
  bill?: mongoose.Types.ObjectId | null;   // ← added
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    customer: { type: String, required: true, trim: true },
    phone:    { type: String, default: '', trim: true },
    service:  { type: String, required: true, trim: true },
    staff:    { type: String, required: true, trim: true },
    date:     { type: String, required: true },
    time:     { type: String, required: true },
    duration: { type: Number, required: true, default: 30 },
    status:   {
      type: String,
      enum: ['confirmed', 'in-progress', 'completed', 'cancelled', 'pending', 'billed'], // ← added 'billed'
      default: 'confirmed',
    },
    isWalkIn:    { type: Boolean, default: false },
    notes:       { type: String, default: '', trim: true },
    price:       { type: Number, default: 0 },
    staffRating: { type: Number, min: 1, max: 5 },
    bill:        { type: Schema.Types.ObjectId, ref: 'Bill', default: null },  // ← added
  },
  { timestamps: true }
);

// Index for fast date-based queries (calendar view)
AppointmentSchema.index({ date: 1 });
AppointmentSchema.index({ date: 1, staff: 1 });

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);