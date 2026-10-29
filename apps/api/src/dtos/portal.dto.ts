// ─── Auth ─────────────────────────────────────────────────────────────────────
// Fields below are marked optional even though a valid request always needs
// them — this interface only describes the *shape* of an unchecked JSON body
// (`req.body as CustomerLoginDto`), not a guarantee. The controller validates
// presence itself; the type just needs to admit that possibility so those
// checks aren't "impossible" per TypeScript.

export interface CustomerLoginDto {
  phone?: string;
  password?: string;
}

export interface CustomerSignupDto {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  dob?: string; // YYYY-MM-DD
  anniversary?: string; // YYYY-MM-DD — optional, e.g. wedding anniversary
  gender?: 'male' | 'female' | 'other';
  referredBy?: string; // referral code string
}

// ─── Public appointment booking (contact form + portal) ───────────────────────

export interface PublicBookingDto {
  customer?: string;
  phone?: string;
  service?: string;
  staff?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM — optional for contact-form enquiries
  duration?: number;
  notes?: string;
  referralCode?: string;
}

// ─── Portal referral submission ───────────────────────────────────────────────

export interface PortalReferralDto {
  referredName?: string;
  referredPhone?: string;
}

// ─── Portal staff rating ───────────────────────────────────────────────────────

export interface RateAppointmentDto {
  rating: number; // 1–5, integer
}

// ─── Portal appointment reschedule ─────────────────────────────────────────────

export interface RescheduleAppointmentDto {
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
}
