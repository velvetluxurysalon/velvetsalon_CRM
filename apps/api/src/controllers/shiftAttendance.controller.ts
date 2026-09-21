import { Request, Response } from "express";
import { z } from "zod";
import { ShiftDefinition, ShiftAttendance, IBreakEntry } from "../models/shiftAttendance.model.js";
import { timerOnDto, breakStartDto, addServiceDto } from "../dtos/shiftAttendance.dto.js";

/**
 * shiftAttendance.controller.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Implements steps 4–11 of the Shift Based Employee Attendance Workflow:
 * Timer ON → working timeline (breaks/services) → Timer OFF → totalWorkingMinutes.
 * Status (Present/Late/Half Day/Absent) is computed client-side in
 * ReceptionPage.tsx from these fields + the matching ShiftDefinition, so it
 * isn't persisted here.
 * ─────────────────────────────────────────────────────────────────────────
 */

const minutesBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 60000);

const sumBreakMinutes = (breaks: IBreakEntry[], until: Date) =>
  breaks.reduce((sum, b) => sum + minutesBetween(b.start, b.end ?? until), 0);

// GET /api/shifts
export const listShifts = async (_req: Request, res: Response) => {
  const shifts = await ShiftDefinition.find().sort({ startTime: 1 });
  res.json(shifts);
};

// GET /api/attendance?date=YYYY-MM-DD
export const listAttendanceForDate = async (req: Request, res: Response) => {
  const date = typeof req.query.date === "string" ? req.query.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Query param 'date' must be YYYY-MM-DD" });
  }
  const records = await ShiftAttendance.find({ date });
  return res.json(records);
};

// POST /api/attendance/timer-on   { staffId, shiftId, date }
export const timerOn = async (req: Request, res: Response) => {
  const parsed = timerOnDto.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: z.treeifyError(parsed.error) });
  const { staffId, shiftId, date } = parsed.data;

  const existing = await ShiftAttendance.findOne({ staffId, date });
  if (existing?.timerOnTime) {
    return res.status(409).json({ message: "This staff member has already clocked in today." });
  }

  const record = existing ?? new ShiftAttendance({ staffId, date, breaks: [], services: [] });
  record.set('shiftId', shiftId); // Mongoose accepts a string id for an ObjectId ref field; the dynamic setter avoids an unsafe `any` assignment
  record.timerOnTime = new Date();
  await record.save();
  return res.status(201).json(record);
};

// POST /api/attendance/:id/timer-off
export const timerOff = async (req: Request, res: Response) => {
  const record = await ShiftAttendance.findById(req.params.id);
  if (!record) return res.status(404).json({ message: "Attendance record not found." });
  if (!record.timerOnTime) return res.status(400).json({ message: "Timer was never started for this record." });
  if (record.timerOffTime) return res.status(400).json({ message: "Already timed off." });
  if (record.breaks.some(b => !b.end)) {
    return res.status(400).json({ message: "End the active break before clocking out." });
  }

  const now = new Date();
  record.timerOffTime = now;
  record.totalWorkingMinutes = Math.round(
    minutesBetween(record.timerOnTime, now) - sumBreakMinutes(record.breaks, now)
 );
  await record.save();
  return res.json(record);
};

// POST /api/attendance/:id/break/start   { label }
export const startBreak = async (req: Request, res: Response) => {
  const parsed = breakStartDto.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: z.treeifyError(parsed.error) });

  const record = await ShiftAttendance.findById(req.params.id);
  if (!record) return res.status(404).json({ message: "Attendance record not found." });
  if (!record.timerOnTime || record.timerOffTime) {
    return res.status(400).json({ message: "Staff must be on duty to start a break." });
  }
  if (record.breaks.some(b => !b.end)) {
    return res.status(400).json({ message: "A break is already active." });
  }

  record.breaks.push({ label: parsed.data.label, start: new Date() });
  await record.save();
  return res.json(record);
};

// POST /api/attendance/:id/break/end
export const endBreak = async (req: Request, res: Response) => {
  const record = await ShiftAttendance.findById(req.params.id);
  if (!record) return res.status(404).json({ message: "Attendance record not found." });

  const active = record.breaks.find(b => !b.end);
  if (!active) return res.status(400).json({ message: "No active break to end." });

  active.end = new Date();
  await record.save();
  return res.json(record);
};

// POST /api/attendance/:id/service   { type, customer? }
export const addService = async (req: Request, res: Response) => {
 const parsed = addServiceDto.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: z.treeifyError(parsed.error) });

  const record = await ShiftAttendance.findById(req.params.id);
  if (!record) return res.status(404).json({ message: "Attendance record not found." });
  if (!record.timerOnTime || record.timerOffTime) {
    return res.status(400).json({ message: "Staff must be on duty to log a service." });
  }

  record.services.push({ type: parsed.data.type, customer: parsed.data.customer, time: new Date() });
  await record.save();
  return res.json(record);
};