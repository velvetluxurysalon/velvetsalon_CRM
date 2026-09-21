import { Schema, model, Types, Document } from "mongoose";

/**
 * shiftAttendance.model.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Backs ReceptionPage.tsx's Timer ON/OFF workflow.
 * Named "shiftAttendance" (not "attendance") on purpose so it doesn't clash
 * with any existing attendance.model.ts from your salary/attendance system.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ── Shift Definition ────────────────────────────────────────────────────────
// GET /api/shifts reads from this collection.
export interface IShiftDefinition extends Document {
  name: string;              // "Morning" | "Evening" | "Night" | custom
  startTime: string;         // "09:00" (24h HH:mm)
  endTime: string;           // "17:00"
  graceMinutes: number;      // late-arrival grace window
  minWorkingHours: number;   // hours required for a full/"Present" day
  halfDayThresholdHours: number; // below this worked-hours => Half Day
}

const shiftDefinitionSchema = new Schema<IShiftDefinition>(
  {
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    graceMinutes: { type: Number, default: 15, min: 0 },
    minWorkingHours: { type: Number, default: 8, min: 0 },
    halfDayThresholdHours: { type: Number, default: 6, min: 0 },
  },
  { timestamps: true }
);

export const ShiftDefinition = model<IShiftDefinition>("ShiftDefinition", shiftDefinitionSchema);

// ── Shift Attendance (one Timer ON/OFF record per staff member per day) ────
export interface IBreakEntry {
  label: string;   // "Lunch Break" | "Tea Break" | "Other"
  start: Date;
  end?: Date;
}

export interface IServiceEntry {
  type: string;       // "Hair Cut" | "Facial" | ...
  customer?: string;
  time: Date;
}

export interface IShiftAttendance extends Document {
  staffId: Types.ObjectId;   // ref StaffRoleMember (staffroles collection)
  shiftId: Types.ObjectId;   // ref ShiftDefinition
  date: string;               // "YYYY-MM-DD", one record per staff per date
  timerOnTime?: Date;
  timerOffTime?: Date;
  breaks: Types.DocumentArray<IBreakEntry>;
  services: Types.DocumentArray<IServiceEntry>;
  totalWorkingMinutes?: number;
}

const breakEntrySchema = new Schema<IBreakEntry>(
  {
    label: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date },
  },
  { _id: true }
);

const serviceEntrySchema = new Schema<IServiceEntry>(
  {
    type: { type: String, required: true },
    customer: { type: String, trim: true },
    time: { type: Date, required: true },
  },
  { _id: true }
);

const shiftAttendanceSchema = new Schema<IShiftAttendance>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "StaffRoleMember", required: true, index: true },
    shiftId: { type: Schema.Types.ObjectId, ref: "ShiftDefinition", required: true },
    date: { type: String, required: true, index: true },
    timerOnTime: { type: Date },
    timerOffTime: { type: Date },
    breaks: { type: [breakEntrySchema], default: [] },
    services: { type: [serviceEntrySchema], default: [] },
    totalWorkingMinutes: { type: Number },
  },
  { timestamps: true }
);

// One attendance record per staff member per calendar day.
shiftAttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

export const ShiftAttendance = model<IShiftAttendance>("ShiftAttendance", shiftAttendanceSchema);