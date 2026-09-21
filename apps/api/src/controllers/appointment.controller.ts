import type { Request, Response } from 'express';
import { appointmentService } from '../services/appointment.service.js';
import type { CreateAppointmentDto, UpdateAppointmentDto } from '../dtos/appointment.dto.js';
import type { AppointmentStatus } from '../models/appointment.model.js';

const VALID_STATUSES: AppointmentStatus[] = [
  'confirmed', 'in-progress', 'completed', 'cancelled', 'pending',
];

export class AppointmentController {

  // GET /api/appointments?date=YYYY-MM-DD&staff=...&status=...&isWalkIn=true
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { date, staff, status, isWalkIn } = req.query as Record<string, string>;
      const appointments = await appointmentService.getAll({
        ...(date !== undefined && { date }),
        ...(staff !== undefined && { staff }),
        ...(status !== undefined && { status: status as AppointmentStatus }),
        ...(isWalkIn !== undefined && { isWalkIn: isWalkIn === 'true' }),
      });
      res.status(200).json(appointments);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointments.', error: err });
    }
  }

  // GET /api/appointments/:id
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        res.status(400).json({ message: 'Appointment id is required.' });
        return;
      }
      const appointment = await appointmentService.getById(id);
      if (!appointment) {
        res.status(404).json({ message: 'Appointment not found.' });
        return;
      }
      res.status(200).json(appointment);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointment.', error: err });
    }
  }

  // POST /api/appointments
  async create(req: Request, res: Response): Promise<void> {
    try {
      const dto = req.body as CreateAppointmentDto;

      if (!dto.customer || !dto.service || !dto.staff || !dto.date || !dto.time) {
        res.status(400).json({ message: 'customer, service, staff, date and time are required.' });
        return;
      }

      const appointment = await appointmentService.create(dto);
      res.status(201).json(appointment);
    } catch (err) {
      res.status(500).json({ message: 'Failed to create appointment.', error: err });
    }
  }

  // PUT /api/appointments/:id
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        res.status(400).json({ message: 'Appointment id is required.' });
        return;
      }
      const dto = req.body as UpdateAppointmentDto;
      const appointment = await appointmentService.update(id, dto);
      if (!appointment) {
        res.status(404).json({ message: 'Appointment not found.' });
        return;
      }
      res.status(200).json(appointment);
    } catch (err) {
      res.status(500).json({ message: 'Failed to update appointment.', error: err });
    }
  }

 // PATCH /api/appointments/:id/status
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.body as { status?: AppointmentStatus };

      if (!status || !VALID_STATUSES.includes(status)) {
        res.status(400).json({ message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
        return;
      }

     const { id } = req.params;
      if (typeof id !== 'string') {
        res.status(400).json({ message: 'Appointment id is required.' });
        return;
      }
      const appointment = await appointmentService.updateStatus(id, status);
      if (!appointment) {
        res.status(404).json({ message: 'Appointment not found.' });
        return;
      }
      res.status(200).json(appointment);
    } catch (err) {
      res.status(500).json({ message: 'Failed to update status.', error: err });
    }
  }

  // DELETE /api/appointments/:id
 async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        res.status(400).json({ message: 'Appointment id is required.' });
        return;
      }
      const deleted = await appointmentService.delete(id);
      if (!deleted) {
        res.status(404).json({ message: 'Appointment not found.' });
        return;
      }
      res.status(200).json({ message: 'Appointment deleted.' });
    } catch (err) {
      res.status(500).json({ message: 'Failed to delete appointment.', error: err });
    }
  }

  // GET /api/appointments/calendar?month=YYYY-MM
  async getCalendarDots(req: Request, res: Response): Promise<void> {
    try {
      const { month } = req.query as { month?: string };
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ message: 'month query param is required in YYYY-MM format.' });
        return;
      }
      const data = await appointmentService.getCountByDate(month);
      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch calendar data.', error: err });
    }
  }
}

export const appointmentController = new AppointmentController();