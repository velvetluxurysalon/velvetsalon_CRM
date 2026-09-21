import { z } from "zod";

/**
 * shiftAttendance.dto.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Zod request validators for the shift-attendance endpoints. Kept
 * self-contained (each controller action calls .safeParse directly) so it
 * doesn't assume a particular validate() middleware shape — wire it into
 * your existing validate middleware instead if you already have one.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format");

export const timerOnDto = z.object({
  staffId: z.string().min(1, "staffId is required"),
  shiftId: z.string().min(1, "shiftId is required"),
  date: dateStringSchema,
});

export const breakStartDto = z.object({
  label: z.string().min(1, "label is required"),
});

export const addServiceDto = z.object({
  type: z.string().min(1, "type is required"),
  customer: z.string().trim().optional(),
});

export type TimerOnInput = z.infer<typeof timerOnDto>;
export type BreakStartInput = z.infer<typeof breakStartDto>;
export type AddServiceInput = z.infer<typeof addServiceDto>;