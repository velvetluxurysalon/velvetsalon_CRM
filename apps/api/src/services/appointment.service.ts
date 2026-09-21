import { Appointment, type IAppointment } from '../models/appointment.model.js';
import { Customer } from '../models/customer.model.js';
import type {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  AppointmentQueryDto,
} from '../dtos/appointment.dto.js';
import { resolveServicePrice } from '../utils/servicePriceLookup.js';

export class AppointmentService {

  // ── Get all with optional filters ─────────────────────────────────────────
  async getAll(query: AppointmentQueryDto): Promise<IAppointment[]> {
    const filter: Record<string, unknown> = {};
    if (query.date)     filter.date     = query.date;
    if (query.staff)    filter.staff    = query.staff;
    if (query.status)   filter.status   = query.status;
    if (query.isWalkIn !== undefined) filter.isWalkIn = query.isWalkIn;

    return Appointment.find(filter).sort({ date: 1, time: 1 });
  }

  // ── Get single by ID ──────────────────────────────────────────────────────
  async getById(id: string): Promise<IAppointment | null> {
    return Appointment.findById(id);
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async create(dto: CreateAppointmentDto): Promise<IAppointment> {
    const appointment = new Appointment({
      customer:  dto.customer,
      phone:     dto.phone     ?? '',
      service:   dto.service,
      staff:     dto.staff,
      date:      dto.date,
      time:      dto.time,
      duration:  dto.duration  ?? 30,
      status:    dto.status    ?? 'confirmed',
      isWalkIn:  dto.isWalkIn  ?? false,
      notes:     dto.notes     ?? '',
    });
    const saved = await appointment.save();

    // If a walk-in (or any appointment) is created already in "completed"
    // status, the status never transitions through updateStatus(), so the
    // visit-sync hook below would never fire. Handle that case here too.
    if (saved.status === 'completed') {
      await this.syncCustomerVisitOnCompletion(saved);
    }

    return saved;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateAppointmentDto): Promise<IAppointment | null> {
    const before = await Appointment.findById(id);
    if (!before) return null;

    const wasCompleted = before.status === 'completed';

    const updated = await Appointment.findByIdAndUpdate(
      id,
      { $set: dto },
      { new: true, runValidators: true }
    );

    // Full update (PUT) can also change status to "completed" — cover that
    // path too, not just the dedicated PATCH /status route.
    if (updated && !wasCompleted && updated.status === 'completed') {
      await this.syncCustomerVisitOnCompletion(updated);
    }

    return updated;
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete(id: string): Promise<boolean> {
    const result = await Appointment.findByIdAndDelete(id);
    return !!result;
  }

  // ── Update status only ────────────────────────────────────────────────────
  async updateStatus(id: string, status: IAppointment['status']): Promise<IAppointment | null> {
    const before = await Appointment.findById(id);
    if (!before) return null;

    const wasCompleted = before.status === 'completed';

    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );

    // Only fire the visit/stat sync the FIRST time this appointment becomes
    // "completed" — guards against double-counting if status is bounced
    // back and forth (e.g. completed → cancelled → completed) or this
    // method is called again with the same status.
    if (appointment && !wasCompleted && status === 'completed') {
      await this.syncCustomerVisitOnCompletion(appointment);
    }

    return appointment;
  }

  // ── Get appointments grouped by date (for calendar dots) ──────────────────
  async getCountByDate(month: string): Promise<{ date: string; count: number }[]> {
    // month format: YYYY-MM
    const regex = new RegExp(`^${month}`);
    interface DateCountAggregation {
      _id: string;
      count: number;
    }

    const results = await Appointment.aggregate<DateCountAggregation>([
      { $match: { date: { $regex: regex } } },
      { $group: { _id: '$date', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    return results.map(r => ({ date: r._id, count: r.count }));
  }

  // ── Sync Customer visit/stats when an appointment becomes "completed" ────
  /**
   * Creates the Visit + ServiceRecord on the matching Customer and bumps
   * visitCount/totalSpent/lastVisit — the same job portalRateAppointment
   * used to (incorrectly) do only when the customer submitted a star
   * rating. Completion of the appointment is what should count as a
   * visit; rating is separate, optional feedback layered on afterward
   * (see portalRateAppointment, which now just attaches a rating to the
   * service record created here instead of creating it itself).
   *
   * Matches the Customer by phone, same key used everywhere else in this
   * codebase (portal controller, bills). If no phone is set on the
   * appointment (e.g. some old contact-form bookings), or no Customer
   * record exists for that phone (e.g. a walk-in with no account), this
   * silently no-ops — there's no Customer doc to update.
   *
   * ⚠️ WALK-IN / BILLING OVERLAP: if your billing flow ALSO creates a
   * Visit/ServiceRecord for the same appointment (e.g. staff bill a
   * walk-in directly without ever flipping its status to "completed", or
   * bill it AND mark it completed), you may end up double-counting that
   * visit. This hook only fires on the appointment's own completion —
   * it does not know about Bill documents. If that's a real scenario in
   * your flow, the safest fix is to decide on ONE trigger per appointment
   * (either "completed status" or "bill created") and have the other path
   * skip visit-creation entirely. Flagging this rather than guessing,
   * since the answer depends on how walk-ins are actually billed.
   */
  private async syncCustomerVisitOnCompletion(appointment: IAppointment): Promise<void> {
    const phone = appointment.phone.trim();
    if (!phone) {
      console.warn(
        `[appointmentService] Appointment ${String(appointment._id)} marked completed ` +
        `but has no phone — cannot match a Customer record. Skipping visit sync.`
      );
      return;
    }

    const customer = await Customer.findOne({ phone });
    if (!customer) {
      // No portal/admin Customer record for this phone (e.g. a one-off
      // walk-in never registered as a customer). Nothing to update.
      return;
    }

    const visitDate = appointment.date.slice(0, 10);
    const price = resolveServicePrice(appointment.service, appointment.price);

    await Customer.findByIdAndUpdate(
      customer._id,
      {
        $push: {
  services: {
    date:     visitDate,
    service:  appointment.service,
    staff:    appointment.staff,
    duration: appointment.duration,
    price,
    appointmentId: appointment._id,   // ← added
  },
  visits: {
    date:     visitDate,
    services: [appointment.service],
    staff:    appointment.staff,
    total:    price,
    notes:    appointment.notes,
    appointmentId: appointment._id,   // ← added
  },
},
        $inc: {
          visitCount: 1,
          totalSpent: price,
        },
        $set: {
          lastVisit: visitDate,
        },
      }
    );
  }
}

export const appointmentService = new AppointmentService();