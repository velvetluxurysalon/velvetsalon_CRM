import { Request, Response } from 'express';
import mongoose               from 'mongoose';
import { Customer }          from '../models/customer.model.js';
import { Appointment }       from '../models/appointment.model.js';
import { StaffRoleMember }   from '../models/staffRole.model.js';
import { Bill }              from '../models/bill.model.js';
import { signCustomerToken } from '../middleware/customerAuth.middleware.js';
import type {
  CustomerLoginDto,
  CustomerSignupDto,
  PublicBookingDto,
  PortalReferralDto,
  RateAppointmentDto,
  RescheduleAppointmentDto,
} from '../dtos/portal.dto.js';
import { resolveServicePrice } from '../utils/servicePriceLookup.js';
import { generateInvoicePdf }  from '../services/invoicePdf.service.js';   // ← added
// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a YYYY-MM-DD string for comparison (strips time if caller passes ISO). */
const normDate = (d: string) => d.slice(0, 10);

/** Public-safe projection — never return internal ObjectId refs to the client. */
const PUBLIC_SELECT =
  'name phone email gender dob anniversary loyaltyPoints walletBalance referralCode ' +
  'membershipTier membershipExpiry visitCount totalSpent lastVisit ' +
  'joinDate tags notes referrals';



// ─── POST /api/portal/login ───────────────────────────────────────────────────
export const portalLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, dob } = req.body as CustomerLoginDto;

    if (!phone?.trim() || !dob?.trim()) {
      res.status(400).json({ message: 'phone and dob are required.' });
      return;
    }

    const customer = await Customer.findOne({ phone: phone.trim() })
      .select(PUBLIC_SELECT + ' dob')
      .lean();

    if (!customer) {
      res.status(401).json({
        message: 'No account found for this mobile number. Please register at the salon.',
      });
      return;
    }

    const storedDob = customer.dob
      ? new Date(customer.dob).toISOString().slice(0, 10)
      : null;

    if (!storedDob || storedDob !== normDate(dob)) {
      res.status(401).json({ message: 'Incorrect date of birth. Please try again.' });
      return;
    }

    const token = signCustomerToken(String(customer._id), customer.phone);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dob: _dob, ...profile } = customer;
    res.status(200).json({ token, customer: profile });
  } catch (err) {
    res.status(500).json({ message: 'Login failed.', error: (err as Error).message });
  }
};

// ─── POST /api/portal/signup ──────────────────────────────────────────────────
export const portalSignup = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CustomerSignupDto;

    if (!body.name?.trim() || !body.phone?.trim()) {
      res.status(400).json({ message: 'name and phone are required.' });
      return;
    }

    const existing = await Customer.findOne({ phone: body.phone.trim() });
    if (existing) {
      res.status(409).json({
        message: 'This mobile number is already registered. Please sign in.',
      });
      return;
    }

     const gender      = (body.gender?.toLowerCase() ?? 'other') as 'male' | 'female' | 'other';
    const referredByCode = (body.referredBy ?? '').toUpperCase().trim();

    if (referredByCode) {
      const referrer = await Customer.findOne({ referralCode: referredByCode });
      if (referrer) {
        referrer.referrals.push({
          referredName:  body.name.trim(),
          referredPhone: body.phone.trim(),
          date:          new Date().toISOString().slice(0, 10),
          status:        'pending',
          reward:        100,
        } as never);
        await referrer.save();
      }
    }

    const customer = await Customer.create({
      name:             body.name.trim(),
      phone:            body.phone.trim(),
      email:            body.email?.trim() ?? '',
      ...(body.dob ? { dob: new Date(body.dob) } : {}),
      ...(body.anniversary ? { anniversary: new Date(body.anniversary) } : {}),
      gender,
      joinDate:         new Date().toISOString().slice(0, 10),
      loyaltyPoints:    0,
      walletBalance:    0,
      membershipTier:   'none',
      membershipExpiry: '',
      referredByCode,
      tags:             [],
      notes:            'Self-registered via customer portal',
      isActive:         true,
    });

    const token = signCustomerToken(String(customer._id), customer.phone);

    const profile = await Customer.findById(customer._id).select(PUBLIC_SELECT).lean();
    res.status(201).json({ token, customer: profile });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg.includes('E11000') || msg.includes('duplicate key')) {
      res.status(409).json({ message: 'This mobile number is already registered.' });
      return;
    }
    res.status(500).json({ message: 'Registration failed.', error: msg });
  }
};

// ─── GET /api/portal/me ───────────────────────────────────────────────────────
export const portalMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.findById(req.customerId)
      .select(PUBLIC_SELECT)
      .lean();

    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    res.status(200).json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile.', error: (err as Error).message });
  }
};

// ─── POST /api/portal/contact-booking ────────────────────────────────────────
export const publicContactBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as PublicBookingDto;

    if (!body.customer?.trim() || !body.phone?.trim() || !body.service?.trim() || !body.date?.trim()) {
      res.status(400).json({ message: 'customer, phone, service and date are required.' });
      return;
    }

    const appointment = await Appointment.create({
      customer: body.customer.trim(),
      phone:    body.phone.trim(),
      service:  body.service.trim(),
      staff:    body.staff?.trim() ?? '',
      date:     body.date,
      time:     body.time ?? '',
      duration: body.duration ?? 30,
      status:   'pending',
      isWalkIn: false,
      notes:    body.notes ?? '',
    });

    res.status(201).json({
      message: "Appointment request received! We'll confirm within 2 hours.",
      appointment,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit booking.', error: (err as Error).message });
  }
};

// ─── GET /api/portal/staff ────────────────────────────────────────────────────
export const portalGetStaff = async (_req: Request, res: Response): Promise<void> => {
  try {
    const staff = await StaffRoleMember.find({ status: 'active' })
      .select('_id name speciality')
      .sort({ name: 1 })
      .lean();

    const result = staff.map((s) => ({
      id: String(s._id),
      name: s.name,
      speciality: s.speciality,
    }));

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load staff.', error: (err as Error).message });
  }
};

// ─── POST /api/portal/appointments ───────────────────────────────────────────
export const portalBookAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as PublicBookingDto;

    if (!body.service?.trim() || !body.staff?.trim() || !body.date?.trim() || !body.time?.trim()) {
      res.status(400).json({ message: 'service, staff, date and time are required.' });
      return;
    }

    const customer = await Customer.findById(req.customerId).lean();
    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    // NOTE: price is intentionally resolved here (rather than left at the
    // schema default of 0) so totalSpent/services[] stay correct downstream
    // — both when staff mark this appointment "completed" (which now
    // creates the visit — see appointmentService.syncCustomerVisitOnCompletion)
    // and as a fallback if it's ever rated.
    const price = resolveServicePrice(body.service.trim(), undefined);

    const appointment = await Appointment.create({
      customer:  customer.name,
      phone:     customer.phone,
      service:   body.service.trim(),
      staff:     body.staff.trim(),
      date:      body.date,
      time:      body.time,
      duration:  body.duration ?? 30,
      price,
      status:    'confirmed',
      isWalkIn:  false,
      notes:     body.notes ?? '',
    });

    res.status(201).json(appointment);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create appointment.', error: (err as Error).message });
  }
};

// ─── GET /api/portal/appointments ────────────────────────────────────────────
export const portalGetAppointments = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.findById(req.customerId).select('phone name').lean();
    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const appointments = await Appointment.find({ phone: customer.phone })
      .sort({ date: -1, time: -1 })
      .lean();

    res.status(200).json(appointments);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch appointments.', error: (err as Error).message });
  }
};

// ─── POST /api/portal/appointments/:id/rating ────────────────────────────────
/**
 * CUSTOMER AUTH required.
 * Rate the staff member for a completed appointment.
 *
 * IMPORTANT — CHANGED BEHAVIOUR:
 * This used to be the ONLY place that created the Customer's Visit +
 * ServiceRecord and bumped visitCount/totalSpent/lastVisit, which meant a
 * completed appointment that was never rated silently never counted as a
 * visit at all. That logic has moved to
 * appointmentService.syncCustomerVisitOnCompletion(), which now runs the
 * moment staff mark an appointment "completed" (PATCH /api/appointments/:id/status
 * or PUT /api/appointments/:id), independent of whether the customer ever
 * rates it.
 *
 * This handler's only remaining job is to attach the star rating to the
 * ServiceRecord that completion already created — mirroring exactly how
 * portalRateBill attaches a rating to a service record that bill-creation
 * already created. It does NOT push any new visits/services or touch
 * visitCount/totalSpent/lastVisit anymore.
 */
export const portalRateAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rating } = req.body as RateAppointmentDto;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ message: 'rating must be an integer between 1 and 5.' });
      return;
    }

    const customer = await Customer.findById(req.customerId).select('phone');
    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found.' });
      return;
    }

    if (appointment.phone !== customer.phone) {
      res.status(403).json({ message: 'You can only rate your own appointments.' });
      return;
    }

   if (appointment.status !== 'completed') {
  res.status(400).json({ message: 'Only completed appointments can be rated.' });
  return;
}

    if (appointment.staffRating != null) {
      res.status(409).json({ message: 'This appointment has already been rated.' });
      return;
    }

    appointment.staffRating = rating;
    await appointment.save();

    // ── Sync onto the existing Customer.services[] entry ────────────────────
    // syncCustomerVisitOnCompletion() already pushed one services[]
    // subdocument for this appointment when it was marked "completed"
    // (date, service, staff, duration, price — unrated). Find that entry
    // and set its rating in place, rather than pushing a new one (which
    // would create a duplicate row with no price/staff/duration data, and
    // would double-count nothing stat-wise but would look wrong in the
    // admin Services tab).
    //
    // Match key: same service name + same date, currently unrated. We
    // deliberately don't match on price/staff/duration in case those
    // drifted between appointment creation and now.
    const visitDate = appointment.date.slice(0, 10);

    const customerDoc = await Customer.findById(req.customerId);
    if (customerDoc) {
      const match = customerDoc.services.find(
        (s) =>
          s.date.slice(0, 10) === visitDate &&
          s.service === appointment.service &&
          s.rating == null
      );

      if (match) {
        match.rating = rating;
        await customerDoc.save();
      } else {
        // No matching unrated service record found. Most likely cause: this
        // appointment was never marked "completed" through the normal flow
        // (e.g. it predates this fix, or completion happened through a path
        // that didn't call syncCustomerVisitOnCompletion). The appointment's
        // own staffRating above is still saved either way, but it won't be
        // reflected in the admin Customers → Services tab.
        console.warn(
          `[portalRateAppointment] No matching Customer.services[] entry found ` +
          `for appointment ${String(appointment._id)} (phone ${appointment.phone}, ` +
          `date ${visitDate}, service "${appointment.service}"). Rating was ` +
          `saved on the appointment but not reflected on the admin Customers page.`
        );
      }
    }

    res.status(200).json(appointment);
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit rating.', error: (err as Error).message });
  }
};

// ─── POST /api/portal/referrals ───────────────────────────────────────────────
export const portalAddReferral = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as PortalReferralDto;

    if (!body.referredName?.trim() || !body.referredPhone?.trim()) {
      res.status(400).json({ message: 'referredName and referredPhone are required.' });
      return;
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const referredPhone = body.referredPhone.trim();

    if (referredPhone === customer.phone) {
      res.status(400).json({ message: 'You cannot refer yourself.' });
      return;
    }

    const alreadyReferred = customer.referrals.some(
      r => r.referredPhone === referredPhone
    );
    if (alreadyReferred) {
      res.status(409).json({ message: 'You have already referred this number.' });
      return;
    }

    customer.referrals.push({
      referredName:  body.referredName.trim(),
      referredPhone,
      date:          new Date().toISOString().slice(0, 10),
      status:        'pending',
      reward:        100,
    } as never);

    await customer.save();

    const updated = await Customer.findById(req.customerId).select(PUBLIC_SELECT).lean();
    res.status(201).json({ message: 'Referral submitted successfully.', customer: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit referral.', error: (err as Error).message });
  }
};

// ─── GET /api/portal/bills ────────────────────────────────────────────────────
/**
 * CUSTOMER AUTH required.
 * Returns all paid/pending bills that match the logged-in customer's phone.
 * Used by the "My Bookings" tab to show billing history alongside appointments.
 * Returns a minimal projection safe for the customer portal.
 */
export const portalGetBills = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.findById(req.customerId).select('phone').lean();
    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const bills = await Bill.find({ phone: customer.phone })
      .select(
        'billNumber phone items subtotal membershipDiscount discountAmount ' +
        'loyaltyRedeemed total paymentMethod status createdAt notes date staffRating'
      )
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(bills);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bills.', error: (err as Error).message });
  }
};


// ─── GET /api/portal/bills/:id/invoice ───────────────────────────────────────
/**
 * CUSTOMER AUTH required.
 * Streams a server-generated (Puppeteer) PDF invoice for one of the logged-in
 * customer's own bills — same renderer the staff-side billing page uses via
 * bill.controller.ts getBillInvoicePdf. Scoped by phone match so a customer
 * can never download someone else's invoice by guessing a bill id.
 */
export const portalGetBillInvoicePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid bill ID.' });
      return;
    }

    const customer = await Customer.findById(req.customerId).select('phone').lean();
    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const bill = await Bill.findById(id).populate('customer', 'name phone');
    if (!bill) {
      res.status(404).json({ message: 'Bill not found.' });
      return;
    }

    if (bill.phone !== customer.phone) {
      res.status(403).json({ message: 'You can only download your own invoices.' });
      return;
    }

    const staffIds  = [...new Set(bill.items.map((i) => i.staffId).filter(Boolean))];
    const validIds  = staffIds.filter((sid) => mongoose.Types.ObjectId.isValid(sid));
    const staff     = validIds.length
      ? await StaffRoleMember.find({ _id: { $in: validIds } }).select('_id name').lean()
      : [];
    const staffNameMap = new Map(staff.map((s) => [String(s._id), s.name]));
    const resolveStaffName = (staffId: string): string =>
      bill.items.find((i) => i.staffId === staffId)?.staffName
      || staffNameMap.get(staffId)
      || staffId;

    const pdfBuffer = await generateInvoicePdf(bill, resolveStaffName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${bill.billNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate invoice PDF.', error: (err as Error).message });
  }
};

// ─── POST /api/portal/bills/:id/rating ───────────────────────────────────────
/**
 * CUSTOMER AUTH required.
 * Rate the overall experience for a paid bill. One rating per bill — locked
 * in once submitted, cannot be edited afterward (mirrors appointment rating).
 *
 * Also updates the matching Customer.services[] entries (already created by
 * bill.controller.ts createBill at bill-creation time) so the rating shows
 * up on the admin Customers page Services tab — this step was previously
 * missing here entirely, which meant bill ratings only ever updated
 * Bill.staffRating and never reached the admin-facing Customer record.
 */
export const portalRateBill = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rating } = req.body as RateAppointmentDto;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ message: 'rating must be an integer between 1 and 5.' });
      return;
    }

    const customer = await Customer.findById(req.customerId).select('phone');
    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const bill = await Bill.findById(id);
    if (!bill) {
      res.status(404).json({ message: 'Bill not found.' });
      return;
    }

    if (bill.phone !== customer.phone) {
      res.status(403).json({ message: 'You can only rate your own bills.' });
      return;
    }

    if (bill.status !== 'paid') {
      res.status(400).json({ message: 'Only paid bills can be rated.' });
      return;
    }

    if (bill.staffRating != null) {
      res.status(409).json({ message: 'This bill has already been rated.' });
      return;
    }

    bill.staffRating = rating;
    await bill.save();

    // ── Sync onto existing Customer.services[] entries ──────────────────────
    // createBill() already pushes one services[] subdocument per line item
    // at bill-creation time (date, service: serviceName, staff, duration,
    // price — see bill.controller.ts createBill). Those entries already
    // exist by the time a rating is submitted here, so we UPDATE them in
    // place rather than pushing new ones — pushing would just create
    // duplicate rows with no price/staff/duration data attached.
    //
    // Match key: same customer + same service name + same date, currently
    // unrated. We deliberately do NOT match on price/staff/duration in case
    // those drifted; service name + date is what the portal bill and the
    // admin service record both agree on.
    const visitDate = bill.date.slice(0, 10);

    if (bill.items.length > 0) {
      const customerDoc = await Customer.findById(req.customerId);
      if (customerDoc) {
        let matchedCount = 0;

        // Match ONE unrated Customer.services[] entry PER BILL ITEM — scoped
        // by date + service name + PRICE, not just date + service name.
        // Previously this rated every unrated entry matching date+service,
        // so two separate same-day bills for the same service (e.g. two
        // "Moustache Colour" bills at different prices) would both get
        // rated when only one bill was actually being rated here.
        for (const item of bill.items) {
          if (!item.serviceName) continue;

          const match = customerDoc.services.find(
            (s) =>
              s.date.slice(0, 10) === visitDate &&
              s.service === item.serviceName &&
              s.price === item.price &&
              s.rating == null
          );

          if (match) {
            match.rating = rating;
            matchedCount++;
          }
        }

        if (matchedCount > 0) {
          await customerDoc.save();
        } else {
          // No matching unrated service record found — log for visibility
          // rather than failing the request. The bill's own staffRating is
          // still the source of truth either way.
          console.warn(
            `[portalRateBill] No matching Customer.services[] entry found ` +
            `for bill ${bill.billNumber} (phone ${bill.phone}, date ${visitDate}). ` +
            `Rating was saved on the bill but not reflected on the admin Customers page.`
          );
        }
      }
    }

    res.status(200).json(bill);
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit rating.', error: (err as Error).message });
  }
};
// ─── PATCH /api/portal/appointments/:id/reschedule ───────────────────────────
/**
 * CUSTOMER AUTH required.
 * Lets a customer move their own appointment to a new date/time, as long as
 * it hasn't already happened or been cancelled/billed. Does not touch any
 * other appointment fields (service, staff, price, notes, etc).
 */
export const portalRescheduleAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { date, time } = req.body as RescheduleAppointmentDto;

    if (!date?.trim() || !time?.trim()) {
      res.status(400).json({ message: 'date and time are required.' });
      return;
    }

    const customer = await Customer.findById(req.customerId).select('phone');
    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found.' });
      return;
    }

    if (appointment.phone !== customer.phone) {
      res.status(403).json({ message: 'You can only reschedule your own appointments.' });
      return;
    }

    if (!['confirmed', 'pending'].includes(appointment.status)) {
      res.status(400).json({ message: 'Only upcoming appointments can be rescheduled.' });
      return;
    }

    appointment.date = date;
    appointment.time = time;
    // Rescheduling a previously-pending request re-confirms it implicitly is
    // NOT done here — status is left untouched so admin still sees pending
    // requests as pending, just with the new requested slot.
    await appointment.save();

    res.status(200).json(appointment);
  } catch (err) {
    res.status(500).json({ message: 'Failed to reschedule appointment.', error: (err as Error).message });
  }
};

// ─── GET /api/portal/appointments/slots ──────────────────────────────────────
/**
 * PUBLIC (no auth needed — used while the customer is still filling the
 * booking form, before/independent of login). Returns the list of time
 * slots already taken for a given staff member on a given date, so the
 * frontend can grey them out and block double-booking.
 *
 * Only counts appointments that still occupy the slot — cancelled ones are
 * excluded so a freed-up slot becomes bookable again.
 *
 * GET /api/portal/appointments/slots?staff=<staffId>&date=YYYY-MM-DD
 */
export const portalGetBookedSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const staff = (req.query.staff as string | undefined)?.trim();
    const date  = (req.query.date as string | undefined)?.trim();

    if (!staff || !date) {
      res.status(400).json({ message: 'staff and date query params are required.' });
      return;
    }

    const appointments = await Appointment.find({
      staff,
      date: normDate(date),
      status: { $in: ['confirmed', 'pending', 'in-progress'] },
    })
      .select('time')
      .lean();

    const bookedTimes = appointments.map((a) => a.time).filter(Boolean);

    res.status(200).json({ bookedTimes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booked slots.', error: (err as Error).message });
  }
};

// ─── PATCH /api/portal/appointments/:id/cancel ───────────────────────────────
/**
 * CUSTOMER AUTH required.
 * Lets a customer cancel their own upcoming appointment.
 */
export const portalCancelAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(req.customerId).select('phone');
    if (!customer) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found.' });
      return;
    }

    if (appointment.phone !== customer.phone) {
      res.status(403).json({ message: 'You can only cancel your own appointments.' });
      return;
    }

    if (!['confirmed', 'pending'].includes(appointment.status)) {
      res.status(400).json({ message: 'Only upcoming appointments can be cancelled.' });
      return;
    }

    appointment.status = 'cancelled';
    await appointment.save();

    res.status(200).json(appointment);
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel appointment.', error: (err as Error).message });
  }
};