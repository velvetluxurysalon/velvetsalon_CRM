import { Router }                from 'express';
import { authenticateCustomer } from '../middleware/customerAuth.middleware.js';
import {
  portalLogin,
  portalSignup,
  portalMe,
  publicContactBooking,
  portalGetStaff,
  portalGetBookedSlots,
  portalBookAppointment,
  portalGetAppointments,
  portalRateAppointment,
  portalRescheduleAppointment,
  portalCancelAppointment,
  portalAddReferral,
  portalGetBills,
  portalRateBill,
  portalGetBillInvoicePdf,   // ← added
} from '../controllers/portal.controller.js';
import { getMyCoupons } from '../controllers/coupon.controller.js';

const router = Router();

// ─── PUBLIC — no token required ───────────────────────────────────────────────
router.post('/login',  portalLogin);
router.post('/signup', portalSignup);
router.post('/contact-booking', publicContactBooking);

/**
 * GET /api/portal/staff
 * Public list of active stylists for the booking UI.
 */
router.get('/staff', portalGetStaff);

/**
 * GET /api/portal/appointments/slots?staff=&date=
 * Public — returns already-booked time slots for a staff+date so the
 * booking UI can disable them.
 */
router.get('/appointments/slots', portalGetBookedSlots);

// ─── CUSTOMER AUTH — requires Bearer token from login/signup ─────────────────
router.use(authenticateCustomer);

router.get('/me', portalMe);

router
  .route('/appointments')
  .get(portalGetAppointments)
  .post(portalBookAppointment);

/**
 * POST /api/portal/appointments/:id/rating
 * Rate the staff member for a completed appointment. One rating per
 * appointment — locked in once submitted, cannot be edited afterward.
 */
router.post('/appointments/:id/rating', portalRateAppointment);

router.post('/referrals', portalAddReferral);

/**
 * GET /api/portal/bills
 * Returns all bills (paid + pending) for the logged-in customer, matched by phone.
 * Used by the "My Bookings" tab to show real billing history.
 */
router.get('/bills', portalGetBills);

/**
 * GET /api/portal/bills/:id/invoice
 * Downloads a server-generated PDF invoice for one of the logged-in
 * customer's own bills (same Puppeteer renderer as the staff billing page).
 */
router.get('/bills/:id/invoice', portalGetBillInvoicePdf);   // ← added

/**
 * POST /api/portal/bills/:id/rating
 * Rate the overall experience for a paid bill. One rating per bill — locked
 * in once submitted, cannot be edited afterward (mirrors appointment rating).
 */
router.post('/bills/:id/rating', portalRateBill);

/**
 * PATCH /api/portal/appointments/:id/reschedule
 * Move an upcoming appointment to a new date/time.
 */
router.patch('/appointments/:id/reschedule', portalRescheduleAppointment);

/**
 * PATCH /api/portal/appointments/:id/cancel
 * Cancel an upcoming appointment.
 */
router.patch('/appointments/:id/cancel', portalCancelAppointment);
// add near your other authenticated portal routes (same middleware as /bills, /me):
router.get('/coupons', getMyCoupons);
export default router;