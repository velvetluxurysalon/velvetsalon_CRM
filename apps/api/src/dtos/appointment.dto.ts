import type { AppointmentStatus } from '../models/appointment.model.js';

// ─── Create ───────────────────────────────────────────────────────────────────
export interface CreateAppointmentDto {
  customer: string;
  phone?: string;
  service: string;
  staff: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
  duration?: number;
  status?: AppointmentStatus;
  isWalkIn?: boolean;
  notes?: string;
}

// ─── Update (all fields optional) ────────────────────────────────────────────
export interface UpdateAppointmentDto {
  customer?: string;
  phone?: string;
  service?: string;
  staff?: string;
  date?: string;
  time?: string;
  duration?: number;
  status?: AppointmentStatus;
  isWalkIn?: boolean;
  notes?: string;
}

// ─── Query filters ────────────────────────────────────────────────────────────
export interface AppointmentQueryDto {
  date?: string;        // filter by YYYY-MM-DD
  staff?: string;       // filter by staff name/id
  status?: AppointmentStatus;
  isWalkIn?: boolean;
}