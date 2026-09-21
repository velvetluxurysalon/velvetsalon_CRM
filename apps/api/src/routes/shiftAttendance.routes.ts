import { Router } from "express";
import {
  listShifts,
  listAttendanceForDate,
  timerOn,
  timerOff,
  startBreak,
  endBreak,
  addService,
} from "../controllers/shiftAttendance.controller.js";

/**
 * shiftAttendance.routes.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Mount in app.ts as:
 *   app.use("/api/shifts", shiftDefinitionRouter);
 *   app.use("/api/shift-attendance", shiftAttendanceRouter);
 *
 * NOTE: mounted at /api/shift-attendance, not /api/attendance — your
 * existing attendance.routes.ts already owns GET/POST /api/attendance for
 * the salary-attendance system (getAttendance / upsertAttendance), so
 * ReceptionPage.tsx's ATTENDANCE_API constant points here instead.
 *
 * No auth middleware is attached here, matching staff.routes.ts and
 * attendance.routes.ts in this project (neither uses per-route auth).
 * ─────────────────────────────────────────────────────────────────────────
 */

export const shiftDefinitionRouter = Router();
shiftDefinitionRouter.get("/", listShifts); // GET /api/shifts

export const shiftAttendanceRouter = Router();
shiftAttendanceRouter.get("/", listAttendanceForDate);            // GET  /api/shift-attendance?date=
shiftAttendanceRouter.post("/timer-on", timerOn);                 // POST /api/shift-attendance/timer-on
shiftAttendanceRouter.post("/:id/timer-off", timerOff);           // POST /api/shift-attendance/:id/timer-off
shiftAttendanceRouter.post("/:id/break/start", startBreak);       // POST /api/shift-attendance/:id/break/start
shiftAttendanceRouter.post("/:id/break/end", endBreak);           // POST /api/shift-attendance/:id/break/end
shiftAttendanceRouter.post("/:id/service", addService);           // POST /api/shift-attendance/:id/service