import mongoose, { Document, Schema } from 'mongoose';

export type AttendanceStatus = 'present' | 'absent' | 'half-day' | 'late' | 'holiday';

export interface IAttendance extends Document {
  staffId:   string;
  date:      string;   // YYYY-MM-DD
  status:    AttendanceStatus;
  checkIn?:  string;   // HH:mm
  checkOut?: string;   // HH:mm
  notes?:    string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    staffId:  { type: String, required: true, trim: true },
    date:     { type: String, required: true },
    status:   { type: String, enum: ['present','absent','half-day','late','holiday'], required: true },
    checkIn:  { type: String, default: '' },
    checkOut: { type: String, default: '' },
    notes:    { type: String, default: '' },
  },
  { timestamps: true }
);

// Compound unique index — one record per staff per day
AttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1 });
AttendanceSchema.index({ staffId: 1 });

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);