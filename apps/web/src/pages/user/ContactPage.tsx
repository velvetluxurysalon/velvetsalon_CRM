import { useState, useEffect, useCallback, useMemo } from 'react';
import { SERVICES_CAT, SERVICE_CATEGORIES } from '../../db/services';

// ─── Types ────────────────────────────────────────────────────────────────────
type PageTab = 'contact' | 'portal';
type PortalTab = 'book' | 'history' | 'membership' | 'referral';
type MembershipTier = 'none' | 'silver' | 'gold' | 'platinum';

interface UserSession {
  _id: string;
  name: string;
  phone: string;
  email: string;
  dob?: string;
  anniversary?: string;
  loyaltyPoints: number;
  membershipTier: MembershipTier;
  membershipExpiry: string;
  referralCode: string;
  referredByCode: string;
  visitCount: number;
  totalSpent: number;
  lastVisit: string;
  referrals: Referral[];
}

interface Appointment {
  _id: string;
  customer: string;
  phone: string;
  service: string;
  staff: string;
  date: string;
  time: string;
  duration: number;
  status: 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'pending' | 'billed';
  isWalkIn: boolean;
  notes: string;
  staffRating?: number;
}

/** Bill as returned by GET /api/portal/bills (matches portalGetBills projection). */
interface BillItem {
  name?: string;
  service?: string;
  serviceName?: string;
  staffName?: string; // ← added
  staffId?: string; // ← added: fallback lookup key when backend doesn't send staffName
  price?: number;
  qty?: number;
  quantity?: number;
  [key: string]: unknown;
}

interface Bill {
  _id: string;
  billNumber: string;
  phone: string;
  items: BillItem[];
  subtotal: number;
  membershipDiscount?: number;
  discountAmount?: number;
  loyaltyRedeemed?: number;
  referralDiscount?: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  notes?: string;
  date?: string;
  /** Overall-experience rating, 1-5. Locked once submitted — mirrors Appointment.staffRating. */
  staffRating?: number;
  /** Set when a referral reward was credited at the time this bill was created. */
  referralRewarded?: boolean;
  /** Name of the referrer who earned the reward, if available. */
  referrerName?: string;
}
/** Unified row used to render the merged Bookings timeline. */
type TimelineEntry =
  | { kind: 'appointment'; sortDate: string; data: Appointment }
  | { kind: 'bill'; sortDate: string; data: Bill };

interface Referral {
  _id: string;
  referredName: string;
  referredPhone: string;
  date: string;
  status: 'pending' | 'converted' | 'credited';
  reward: number;
}

/** Personal coupon locked to this customer's phone — returned by GET /api/portal/coupons. */
interface MyCoupon {
  _id: string;
  code: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  description: string;
  expiryDate: string | null;
}



/** Stylist as returned by the public GET /api/portal/staff endpoint. */
interface Stylist {
  id: string;
  name: string;
  speciality: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TIME_SLOTS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
];

const TIER_CFG: Record<
  MembershipTier,
  { label: string; color: string; gradient: string; discount: number }
> = {
  none: {
    label: 'Standard',
    color: '#8a7560',
    gradient: 'from-stone-400 to-stone-500',
    discount: 0,
  },
  silver: {
    label: 'Silver',
    color: '#64748b',
    gradient: 'from-slate-500 to-slate-400',
    discount: 10,
  },
  gold: {
    label: 'Gold',
    color: '#b8860b',
    gradient: 'from-yellow-700 to-yellow-500',
    discount: 20,
  },
  platinum: {
    label: 'Platinum',
    color: '#7c3aed',
    gradient: 'from-violet-800 to-violet-500',
    discount: 30,
  },
};

const STATUS_CFG = {
  confirmed: { label: 'Confirmed', cls: 'bg-green-50 text-green-700 ring-1 ring-green-200' },
  'in-progress': { label: 'In Progress', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  completed: { label: 'Completed', cls: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 ring-1 ring-red-200' },
  pending: { label: 'Pending', cls: 'bg-stone-100 text-stone-500 ring-1 ring-stone-200' },
  billed: { label: 'Billed', cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' },
};

/** Status pill styling for bills (separate from appointment STATUS_CFG since values differ). */
const BILL_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Paid', cls: 'bg-green-50 text-green-700 ring-1 ring-green-200' },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 ring-1 ring-red-200' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PORTAL_API = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''}/api/portal`;

const fmtDate = (d: string) =>
  d
    ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const fmtCur = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const todayStr = new Date().toISOString().slice(0, 10);

// Returns true if the given date's month+day matches today — used to flag
// birthdays/anniversaries regardless of birth year. Mirrors BillingPage.tsx.
const isTodayMonthDay = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const getAvailableSlots = (date: string): string[] => {
  if (date !== todayStr) return TIME_SLOTS;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  return TIME_SLOTS.filter((t) => {
    const [h = 0, m = 0] = t.split(':').map(Number);
    return h * 60 + m > nowMinutes;
  });
};

// Display-only: convert a 24h "HH:mm" value into 12h "h:mm AM/PM" for the dropdown label.
// The underlying <option value> stays in 24h so booking/slot logic is untouched.
const fmtTime12 = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12)}:${String(m).padStart(2, '0')} ${ampm}`;
};

const TOKEN_KEY = 'velvet_customer_token';
const SESSION_KEY = 'velvet_customer_session';
// Set by the Home page "Reserve Your Spot" button to open the My Portal tab.
const CONTACT_TAB_KEY = 'velvet_contact_tab';

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// ─── Star rating control ───────────────────────────────────────────────────────
const StarRating = ({
  value,
  onRate,
  submitting,
  size = 18,
}: {
  value?: number | undefined;
  onRate?: ((n: number) => void) | undefined;
  submitting?: boolean | undefined;
  size?: number | undefined;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const readOnly = value != null || !onRate;
  const display = hover ?? value ?? 0;

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => {
        setHover(null);
      }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly || submitting}
          onMouseEnter={() => {
            if (!readOnly) setHover(n);
          }}
          onClick={() => {
            if (!readOnly) onRate(n);
          }}
          className={`transition-transform ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          aria-label={`Rate ${String(n)} star${n > 1 ? 's' : ''}`}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={n <= display ? '#d4af37' : 'none'}
            stroke={n <= display ? '#d4af37' : '#c5b89a'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ContactPage() {
  const [pageTab, setPageTab] = useState<PageTab>(() =>
    localStorage.getItem(CONTACT_TAB_KEY) === 'portal' ? 'portal' : 'contact',
  );

  // Clear the one-time flag so a normal visit to Contact opens on "Book & Contact".
  useEffect(() => {
    localStorage.removeItem(CONTACT_TAB_KEY);
  }, []);

  // NOTE: the contact-booking form state (formData/setContactSubmitted) was
  // removed along with handleContactBook — it wasn't wired to any <form> in
  // the current JSX. See earlier note near where handleContactBook used to be.

  // ── Portal session ─────────────────────────────────────────────────────────
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [portalTab, setPortalTab] = useState<PortalTab>('book');

  // reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('');
  const [resSaving, setResSaving] = useState(false);
  const [resError, setResError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // login
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginDob, setLoginDob] = useState('');
  const [showDob, setShowDob] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // signup
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupDob, setSignupDob] = useState('');
  const [signupAnniversary, setSignupAnniversary] = useState('');
  const [signupGender, setSignupGender] = useState<'female' | 'male' | 'other'>('female');
  const [signupRef, setSignupRef] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // portal booking
  const [bkService, setBkService] = useState('');
  const [bkStaff, setBkStaff] = useState('');
  const [bkDate, setBkDate] = useState('');
  const [bkTime, setBkTime] = useState('');
  const [bkNotes, setBkNotes] = useState('');
  const [bkSaving, setBkSaving] = useState(false);
  const [bkSuccess, setBkSuccess] = useState(false);
  const [bkError, setBkError] = useState('');

  // history (appointments + bills, merged)
  const [history, setHistory] = useState<Appointment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState('');

  // staff / experience rating (shared between appointment rows and bill rows —
  // only one rating action can be in flight at a time, so a single id is safe)
  const [ratingSubmittingId, setRatingSubmittingId] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState('');

  // referral
  const [refName, setRefName] = useState('');
  const [refPhone, setRefPhone] = useState('');
  const [refSaving, setRefSaving] = useState(false);
  const [refSuccess, setRefSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // my coupons (personal reward coupons earned from big-ticket visits)
  const [myCoupons, setMyCoupons] = useState<MyCoupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);

  // stylists
  const [staffList, setStaffList] = useState<Stylist[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // booked slots (used by both Book form and Reschedule modal)
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

// invoice modal
  const [invoiceBill, setInvoiceBill] = useState<Bill | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null); // ← added

  // upcoming-appointment reminder banner
  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null);
  const [, tickMinute] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      tickMinute((t) => t + 1);
    }, 60000);
    return () => {
      clearInterval(id);
    };
  }, []);

  // ── Fetch fresh session from /api/portal/me ────────────────────────────────
  // Always called on mount (if token exists) and after login/signup so the
  // welcome banner always reflects the live DB values (visitCount, totalSpent,
  // loyaltyPoints) rather than potentially stale localStorage data.
  const refreshSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setSessionLoading(true);
    try {
      const res = await fetch(`${PORTAL_API}/me`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const fresh = (await res.json()) as UserSession;
        setSession(fresh);
        localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
      } else {
        // Token invalid / expired — clear and force re-login
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
      }
    } catch {
      // Network error: fall back to cached session so we don't log the user out
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as UserSession;
          if (stored._id) setSession(stored);
        }
      } catch {
        /* ignore */
      }
    } finally {
      setSessionLoading(false);
    }
  }, []);

  // On mount: restore session then immediately fetch fresh data from DB
  useEffect(() => {
    // 1. Show cached data instantly so the UI doesn't flash empty
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as UserSession;
        if (stored._id) setSession(stored);
      }
    } catch {
      /* ignore */
    }

    // 2. Then overwrite with live data from the server
    void refreshSession();
  }, [refreshSession]);

  // ── Fetch active stylists ──────────────────────────────────────────────────
  const fetchStaffList = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await fetch(`${PORTAL_API}/staff`);
      if (res.ok) setStaffList((await res.json()) as Stylist[]);
    } catch {
      /* silent */
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStaffList();
  }, [fetchStaffList]);

  // ── Fetch booked slots for a given staff+date ──────────────────────────────
  const fetchBookedSlots = useCallback(async (staffId: string, date: string) => {
    if (!staffId || !date) {
      setBookedTimes([]);
      return;
    }
    setSlotsLoading(true);
    try {
      const res = await fetch(
        `${PORTAL_API}/appointments/slots?staff=${encodeURIComponent(staffId)}&date=${encodeURIComponent(date)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { bookedTimes: string[] };
        setBookedTimes(data.bookedTimes);
      } else {
        setBookedTimes([]);
      }
    } catch {
      setBookedTimes([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // Refetch whenever staff or date changes in the booking form
  useEffect(() => {
    void fetchBookedSlots(bkStaff, bkDate);
  }, [bkStaff, bkDate, fetchBookedSlots]);

  // Refetch for the reschedule modal too
  useEffect(() => {
    if (rescheduleTarget) void fetchBookedSlots(rescheduleTarget.staff, resDate);
  }, [rescheduleTarget, resDate, fetchBookedSlots]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!loginPhone.trim() || !loginDob.trim()) return;
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${PORTAL_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone.trim(), dob: loginDob }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Login failed.');
      }
      const { token } = (await res.json()) as { token: string; customer: UserSession };
      localStorage.setItem(TOKEN_KEY, token);
      // Fetch fresh data from DB right after login instead of trusting the
      // login response payload (which may not include latest visit/spend stats)
      await refreshSession();
      setPortalTab('book');
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Sign up ────────────────────────────────────────────────────────────────
  const handleSignup = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!signupName.trim() || !signupPhone.trim()) return;
    setSignupError('');
    setSignupLoading(true);
    try {
      const res = await fetch(`${PORTAL_API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName.trim(),
          phone: signupPhone.trim(),
          email: signupEmail.trim(),
          dob: signupDob,
          anniversary: signupAnniversary,
          gender: signupGender,
          referredBy: signupRef.trim(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Registration failed.');
      }
      const { token } = (await res.json()) as { token: string; customer: UserSession };
      localStorage.setItem(TOKEN_KEY, token);
      await refreshSession();
      setPortalTab('book');
    } catch (err: unknown) {
      setSignupError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSignupLoading(false);
    }
  };

  // ── Fetch booking history (appointments + bills, in parallel) ─────────────
  const fetchHistory = useCallback(async () => {
    if (!session) return;
    setHistLoading(true);
    setHistError('');
    try {
      const [apptRes, billsRes] = await Promise.all([
        fetch(`${PORTAL_API}/appointments`, { headers: authHeaders() }),
        fetch(`${PORTAL_API}/bills`, { headers: authHeaders() }),
      ]);

      if (apptRes.ok) {
        setHistory((await apptRes.json()) as Appointment[]);
      }
      // Bills endpoint failing shouldn't wipe out appointments that loaded fine —
      // just leave bills empty and surface a soft error.
      if (billsRes.ok) {
        setBills((await billsRes.json()) as Bill[]);
      } else if (apptRes.ok) {
        setHistError('Could not load billing history right now.');
      }

      if (!apptRes.ok && !billsRes.ok) {
        setHistError('Failed to load your booking history.');
      }
    } catch {
      setHistError('Network error while loading your booking history.');
    } finally {
      setHistLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && portalTab === 'history') void fetchHistory();
  }, [session, portalTab, fetchHistory]);

  // Also fetch on login so the upcoming-appointment reminder can show even
  // if the customer hasn't opened the Bookings tab yet.
  useEffect(() => {
    if (session) void fetchHistory();
  }, [session, fetchHistory]);

  // Refresh points/tier/spend whenever the Membership tab is opened — the
  // cached session in localStorage can go stale if points/tier are updated
  // from the admin CRM (Members/Wallet tab) while the customer stays logged in.
  useEffect(() => {
    if (portalTab === 'membership' && localStorage.getItem(TOKEN_KEY)) {
      void refreshSession();
    }
  }, [portalTab, refreshSession]);

  // ── Fetch this customer's own active coupons ───────────────────────────────
  const fetchMyCoupons = useCallback(async () => {
    if (!session) return;
    setCouponsLoading(true);
    try {
      const res = await fetch(`${PORTAL_API}/coupons`, { headers: authHeaders() });
      if (res.ok) setMyCoupons((await res.json()) as MyCoupon[]);
    } catch {
      /* silent — non-critical */
    } finally {
      setCouponsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && portalTab === 'membership') void fetchMyCoupons();
  }, [session, portalTab, fetchMyCoupons]);

  // ── Merge appointments + bills into a single, date-sorted timeline ─────────
  // Newest first. Falls back to createdAt for bills without a `date` field.
  const timeline: TimelineEntry[] = [
    ...history.map(
      (a): TimelineEntry => ({
        kind: 'appointment',
        sortDate: `${normDateForSort(a.date)}T${a.time || '00:00'}`,
        data: a,
      }),
    ),
    ...bills.map(
      (b): TimelineEntry => ({
        kind: 'bill',
        sortDate: normDateForSort(b.date || b.createdAt),
        data: b,
      }),
    ),
  ].sort((a, b) => (a.sortDate < b.sortDate ? 1 : a.sortDate > b.sortDate ? -1 : 0));

 // NOTE: handleContactBook was removed — it wasn't wired to any form
  // (no <form onSubmit={handleContactBook}> exists in the current JSX).
  // If you intend to add a contact-booking form later, restore this
  // function and connect it to that form's onSubmit.

  // ── Portal book appointment ────────────────────────────────────────────────
  const handlePortalBook = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!bkService || !bkStaff || !bkDate || !bkTime) return;
    setBkSaving(true);
    setBkError('');
    setBkSuccess(false);
    try {
      const svc = SERVICES_CAT.find((s) => s.name === bkService);
      const res = await fetch(`${PORTAL_API}/appointments`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          service: bkService,
          staff: bkStaff,
          date: bkDate,
          time: bkTime,
          duration: svc?.duration ?? 30,
          notes: bkNotes,
        }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { message?: string }).message ?? 'Booking failed.');
      setBkSuccess(true);
      setBkService('');
      setBkStaff('');
      setBkDate('');
      setBkTime('');
      setBkNotes('');
      setTimeout(() => {
        setBkSuccess(false);
      }, 5000);
    } catch (err: unknown) {
      setBkError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    } finally {
      setBkSaving(false);
    }
  };

  // ── Rate a completed appointment ───────────────────────────────────────────
  const handleRateStaff = async (appointmentId: string, rating: number) => {
    setRatingError('');
    setRatingSubmittingId(appointmentId);
    try {
      const res = await fetch(`${PORTAL_API}/appointments/${appointmentId}/rating`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rating }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Failed to submit rating.');
      }
      const updated = (await res.json()) as Appointment;
      setHistory((prev) => prev.map((a) => (a._id === appointmentId ? updated : a)));

      // Refresh session stats from DB so banner shows updated visitCount/totalSpent
      await refreshSession();
    } catch (err: unknown) {
      setRatingError(err instanceof Error ? err.message : 'Failed to submit rating.');
      setTimeout(() => {
        setRatingError('');
      }, 4000);
    } finally {
      setRatingSubmittingId(null);
    }
  };

  const openReschedule = (a: Appointment) => {
    setRescheduleTarget(a);
    setResDate(a.date.slice(0, 10));
    setResTime(a.time);
    setResError('');
  };

  const submitReschedule = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rescheduleTarget || !resDate || !resTime) return;
    setResSaving(true);
    setResError('');
    try {
      const res = await fetch(`${PORTAL_API}/appointments/${rescheduleTarget._id}/reschedule`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ date: resDate, time: resTime }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { message?: string };
        throw new Error(errData.message ?? 'Reschedule failed.');
      }
      const updated = (await res.json()) as Appointment;
      setHistory((prev) => prev.map((a) => (a._id === updated._id ? updated : a)));
      setRescheduleTarget(null);
    } catch (err: unknown) {
      setResError(err instanceof Error ? err.message : 'Reschedule failed. Please try again.');
    } finally {
      setResSaving(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!window.confirm('Cancel this appointment?')) return;
    setCancellingId(id);
    try {
      const res = await fetch(`${PORTAL_API}/appointments/${id}/cancel`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { message?: string };
        throw new Error(errData.message ?? 'Cancel failed.');
      }
      const updated = (await res.json()) as Appointment;
      setHistory((prev) => prev.map((a) => (a._id === updated._id ? updated : a)));
    } catch (err: unknown) {
      setRatingError(err instanceof Error ? err.message : 'Failed to cancel appointment.');
      setTimeout(() => {
        setRatingError('');
      }, 4000);
    } finally {
      setCancellingId(null);
    }
  };

  // ── Rate a paid bill (overall experience) ──────────────────────────────────
  const handleRateBill = async (billId: string, rating: number) => {
    setRatingError('');
    setRatingSubmittingId(billId);
    try {
      const res = await fetch(`${PORTAL_API}/bills/${billId}/rating`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rating }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Failed to submit rating.');
      }
      const updated = (await res.json()) as Bill;
      setBills((prev) => prev.map((b) => (b._id === billId ? updated : b)));

      await refreshSession();
    } catch (err: unknown) {
      setRatingError(err instanceof Error ? err.message : 'Failed to submit rating.');
      setTimeout(() => {
        setRatingError('');
      }, 4000);
    } finally {
      setRatingSubmittingId(null);
    }
  };

  // ── Download a server-generated (Puppeteer) PDF invoice for one of this ────
  // customer's own bills, and trigger a browser download.
  const downloadInvoicePdf = async (billId: string, billNumber: string) => {
    setDownloadingInvoiceId(billId);
    try {
      const res = await fetch(`${PORTAL_API}/bills/${billId}/invoice`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${billNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download invoice PDF.');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

// ── Share a bill (native share sheet, falls back to WhatsApp text share) ──
  const shareInvoice = async (bill: Bill) => {
    const itemsText = bill.items
      .map((it) => `${it.serviceName ?? it.name ?? it.service ?? 'Service'} - ${fmtCur(it.price ?? 0)}`)
      .join('\n');
    const text = `Velvet Premium Unisex Salon\nInvoice #${bill.billNumber}\nDate: ${new Date(
      bill.date ?? bill.createdAt,
    ).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n${itemsText}\n\nTotal: ${fmtCur(
      bill.total,
    )}\nPayment: ${bill.paymentMethod.toUpperCase()}\n\nThank you for visiting Velvet!`;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Invoice #${bill.billNumber}`, text });
      } catch {
        /* user cancelled the share sheet — ignore */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  // ── Submit referral ────────────────────────────────────────────────────────
  const handleReferral = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!refName || !refPhone) return;
    setRefSaving(true);
    try {
      const res = await fetch(`${PORTAL_API}/referrals`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ referredName: refName, referredPhone: refPhone }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        alert(data.message ?? 'Failed to submit referral.');
        return;
      }
      setRefSuccess(true);
      setRefName('');
      setRefPhone('');
      setTimeout(() => {
        setRefSuccess(false);
      }, 4000);
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setRefSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setPageTab('contact');
  };

  const copyCode = () => {
    void navigator.clipboard.writeText(session?.referralCode ?? '').then(() => {
      setCopiedCode(true);
      setTimeout(() => {
        setCopiedCode(false);
      }, 2000);
    });
  };

const upcomingAppt = useMemo(() => {
    const now = new Date();
    return history.find((a) => {
      if (a.status !== 'confirmed' && a.status !== 'pending') return false;
      if (a.date.slice(0, 10) !== todayStr) return false;
      const [hh = '0', mm = '00'] = a.time.split(':');
      const apptTime = new Date(`${todayStr}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00`);
      const diffMinutes = (apptTime.getTime() - now.getTime()) / 60000;
      return diffMinutes > 0 && diffMinutes <= 60;
    });
  }, [history]);

   const tierCfg = TIER_CFG[session?.membershipTier ?? 'none'];
  const discount = tierCfg.discount;
  const selectedSvc = SERVICES_CAT.find((s) => s.name === bkService);
  const finalPrice = selectedSvc ? Math.round(selectedSvc.price * (1 - discount / 100)) : 0;

  // Resolve a bill line-item's staff name: prefer staffName if the backend
  // already sent it, otherwise look it up from the loaded stylist list by id.
  const staffNameForItem = (it: BillItem) => {
    if (it.staffName) return it.staffName;
    const stf = staffList.find((s) => s.id === it.staffId);
    return stf?.name ?? '—';
  };

  const labelCls = 'block text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-2';
  const inputCls =
    'w-full h-11 border border-[#e0d5c0] rounded-lg bg-white px-3 text-sm text-[#2c1f0e] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/10 placeholder:text-[#c5b89a] transition-all';

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#faf8f4] font-['Jost'] pt-[84px]">
  {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
  <header className="relative z-20 pt-2">
       <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-2 sm:gap-4">
          <div className="flex gap-1 bg-[#f5f0e8] rounded-lg p-1">
            {(
              [
                { id: 'contact', label: 'Book & Contact' },
                { id: 'portal', label: 'My Portal' },
              ] as { id: PageTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setPageTab(t.id);
                }}
                className={`px-2.5 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-[11px] font-medium tracking-[0.06em] sm:tracking-[0.08em] uppercase transition-all whitespace-nowrap ${
                  pageTab === t.id
                    ? 'bg-[#1a1208] text-[#d4af37]'
                    : 'text-[#8a7560] hover:text-[#1a1208]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {session && (
            <div className="w-full sm:w-auto sm:ml-auto flex items-center justify-between sm:justify-end gap-3">
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-sm font-medium text-[#1a1208]">{session.name}</span>
                <span
                  className="text-[10px] tracking-[0.1em] uppercase font-medium"
                  style={{ color: tierCfg.color }}
                >
                  {tierCfg.label} Member
                </span>
              </div>
              <button
                onClick={logout}
                className="h-8 px-3 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[10px] font-medium tracking-[0.1em] uppercase text-[#6b5740] hover:border-[#d4af37] hover:text-[#b8860b] transition-all flex-shrink-0"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          CONTACT PAGE
      ══════════════════════════════════════════════════════════════════════ */}
      {pageTab === 'contact' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-40 sm:pb-20">
          <div className="py-14 sm:py-10 flex flex-col items-center text-center gap-3">
            <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-[#b8860b]">
              Get in Touch
            </p>
            <h1
              className="font-['Cormorant_Garamond'] font-light text-[#1a1208] leading-[1.1]"
              style={{ fontSize: 'clamp(36px,6vw,56px)' }}
            >
              Book an Appointment
            </h1>
            <div className="w-12 h-px bg-[#d4af37]" />
           <p className="text-[15px] font-light text-[#8a7560] max-w-[520px] leading-[1.7]">
              Walk-ins welcome. For guaranteed slots, book ahead and we'll confirm within 2 hours.
            </p>
            <div className="flex gap-2.5 mt-2">
              <a
                href="https://www.google.com/search?sca_esv=24bf5a2419cba2ed&cs=0&output=search&kgmid=/g/11yt1q_p70&q=Velvet+Premium+Unisex+Salon+Bhavani+%7C+Luxury+Hair,+Beauty+%26+Bridal+Studio&shem=epsd1,ltae,rimspwouoe&shndl=30&source=sh/x/loc/act/m1/2&kgs=ec0fc4c726561543&utm_source=epsd1,ltae,rimspwouoe,sh/x/loc/act/m1/2&sei=k4WCapDxFvKVseMP38O9kQ0&fbclid=PAT01DUATvZOtwZG9mAmV4dG4DYWVtAjEwAHNydGMGYXBwX2lkDzU2NzA2NzM0MzM1MjQyNwABp7zHhlkuy-31mCdV8MmMiUL9ShWED7-aRKAe0ieWLZH5IY9A2pP6aG5-Cd7h_aem_BpLjtPdLEaTb8z9SGHaecQ#ebo=0"
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-4 border border-[#e0d5c0] rounded-full flex items-center justify-center text-[11px] font-medium tracking-[0.06em] text-[#6b5740] hover:border-[#d4af37] hover:text-[#b8860b] transition-all"
              >
                Google
              </a>
              <a
                href="https://www.facebook.com/share/19HWbeDTUu/"
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-4 border border-[#e0d5c0] rounded-full flex items-center justify-center text-[11px] font-medium tracking-[0.06em] text-[#6b5740] hover:border-[#d4af37] hover:text-[#b8860b] transition-all"
              >
                Facebook
              </a>
              <a
                href="https://www.linkedin.com/company/velvet-premium-unisex-salon/"
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-4 border border-[#e0d5c0] rounded-full flex items-center justify-center text-[11px] font-medium tracking-[0.06em] text-[#6b5740] hover:border-[#d4af37] hover:text-[#b8860b] transition-all"
              >
                LinkedIn
              </a>
            </div>
          </div>

                              <div className="max-w-4xl mx-auto">


             {/* ── INFO GRID (left/right instead of one straight column) ───── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
              <div className="bg-white border border-[#ede5d6] rounded-2xl p-[22px]">
                <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[#8a7560] mb-3">
                  📍 Location
                </p>
                <a
                  href="https://www.google.com/maps/place/Velvet+Premium+Unisex+Salon+Bhavani+%7C+Luxury+Hair,+Beauty+%26+Bridal+Studio/@11.4340949,77.6713517,854m/data=!3m2!1e3!4b1!4m6!3m5!1s0x44166e7af41cce15:0x4a9e4a102667960!8m2!3d11.4340949!4d77.6739266!16s%2Fg%2F11yt1q_p70?entry=ttu&g_ep=EgoyMDI2MDgwNS4xIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl h-[180px] flex flex-col items-center justify-center gap-2 border border-[#ede5d6] hover:opacity-90 transition-opacity cursor-pointer"
                  style={{ background: 'linear-gradient(135deg,#f0e8d8 0%,#e8dcc8 100%)' }}
                >
                  <div className="text-[32px]">📍</div>
                  <div className="text-[13px] font-light text-[#2c1f0e] text-center">
                    Opposite to ICICI bank, KK Nagar, Kalingarayanpalayam Bhavani
                    <br />
                    Erode, Tamil Nadu 638001
                  </div>
                </a>
                <div className="mt-3 space-y-2">
                  {[
                    {
                      lbl: 'Address',
                      val: ' Opposite to ICICI bank, KK Nagar, Kalingarayanpalayam Bhavani Erode, Tamil Nadu 638001',
                    },
                    { lbl: 'Phone', val: '+91 99941 19336' },
                    { lbl: 'Email', val: 'Velvetluxurysalon@gmail.com' },
                  ].map((r) => (
                    <div key={r.lbl} className="flex gap-2.5 text-[13px] text-[#2c1f0e]">
                      <span className="text-[#8a7560] text-[12px] min-w-[72px]">{r.lbl}</span>
                      <span>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#ede5d6] rounded-2xl p-[22px]">
                <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[#8a7560] mb-3">
                  📄 Documents
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href="https://drive.google.com/file/d/1lrSLoT9NqCTIBBXYfLfJLLEGl36O3KmN/view"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex items-center justify-between h-11 px-3.5 border border-[#e0d5c0] rounded-lg text-[13px] font-medium text-[#6b5740] hover:border-[#d4af37] hover:text-[#b8860b] hover:bg-[#fffdf5] transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <span className="relative flex-shrink-0">
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                      </span>
                      Men's Brochure
                    </span>
                    <span className="text-[10px] tracking-[0.08em] uppercase text-[#b8860b]">
                      View
                    </span>
                  </a>
                  <a
                    href="https://drive.google.com/file/d/1kSv1DPecHjw36f16ZS-EXkvsVnVLZPQk/view"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex items-center justify-between h-11 px-3.5 border border-[#e0d5c0] rounded-lg text-[13px] font-medium text-[#6b5740] hover:border-[#d4af37] hover:text-[#b8860b] hover:bg-[#fffdf5] transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <span className="relative flex-shrink-0">
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                      </span>
                      Women's Brochure
                    </span>
                    <span className="text-[10px] tracking-[0.08em] uppercase text-[#b8860b]">
                      View
                    </span>
                  </a>
                </div>
              </div>

              <div className="bg-white border border-[#ede5d6] rounded-2xl p-[22px]">
                <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[#8a7560] mb-3">
                  🕐 Working Hours
                </p>
                <table className="w-full border-collapse">
                  <tbody>
                    {[
                      { day: 'Monday – Saturday', hrs: '8:00 AM – 8:00 PM' },
                      // { day: 'Saturday', hrs: '8:00 AM – 8:00 PM' },
                      { day: 'Sunday', hrs: '8:00 AM – 8:00 PM' },
                      { day: 'Public Holidays', hrs: '8:00 AM – 8:00 PM' },
                    ].map((h, idx, arr) => (
                      <tr
                        key={h.day}
                        className={idx < arr.length - 1 ? 'border-b border-[#f5f0e8]' : ''}
                      >
                        <td className="py-[6px] text-[13px] text-[#8a7560]">{h.day}</td>
                        <td className="py-[6px] text-[13px] text-[#1a1208] font-medium text-right">
                          {h.hrs}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-[#ede5d6] rounded-2xl p-[22px]">
                <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[#8a7560] mb-3">
                  💬 Quick Contact
                </p>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => window.open('https://wa.me/919994119336')}
                    className="flex-1 h-[38px] bg-[#25D366] text-white rounded-lg text-[12px] font-medium tracking-[0.06em] hover:opacity-90 transition-opacity"
                  >
                    WhatsApp
                  </button>
                  <button
                    onClick={() => window.open('tel:+919994119336')}
                    className="flex-1 h-[38px] bg-[#1a1208] text-[#d4af37] rounded-lg text-[12px] font-medium tracking-[0.06em] hover:bg-[#2d2010] transition-colors"
                  >
                    Call Us
                  </button>
                </div>
                
                  
                <div className="mt-3 pt-3 border-t border-[#f5f0e8]">
                  <button
                    onClick={() => {
                      setPageTab('portal');
                    }}
                    className="w-full h-9 border border-[#d4af37] rounded-lg text-[11px] font-medium tracking-[0.1em] uppercase text-[#b8860b] hover:bg-[#d4af37] hover:text-[#1a1208] transition-all"
                  >
                    {session ? 'Go to My Portal →' : 'Sign in to My Portal →'}
                  </button>
                </div>
              </div>
            </div>

           
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MY PORTAL
      ══════════════════════════════════════════════════════════════════════ */}
      {pageTab === 'portal' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* ── SESSION LOADING STATE ──────────────────────────────────────── */}
          {sessionLoading && !session && (
            <div className="flex justify-center py-20">
              <span className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
            </div>
          )}
          {rescheduleTarget && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
              onClick={() => {
                setRescheduleTarget(null);
              }}
            >
              <div
                className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <h3 className="font-['Cormorant_Garamond'] text-2xl font-light text-[#1a1208] mb-1">
                  Reschedule
                </h3>
                <p className="text-xs text-[#8a7560] mb-5">{rescheduleTarget.service}</p>
                <form
                  onSubmit={(e) => {
                    void submitReschedule(e);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className={labelCls}>New Date</label>
                    <input
                      type="date"
                      min={todayStr}
                      value={resDate}
                      onChange={(e) => {
                        setResDate(e.target.value);
                      }}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>New Time</label>
                    <select
                      value={resTime}
                      onChange={(e) => {
                        setResTime(e.target.value);
                      }}
                      className={inputCls}
                      required
                    >
                      <option value="">Select time</option>
                      {getAvailableSlots(resDate).map((t) => {
  const isBooked = bookedTimes.includes(t) && t !== rescheduleTarget.time;
  return (
    <option key={t} value={t} disabled={isBooked}>
      {fmtTime12(t)}
      {isBooked ? ' (booked)' : ''}
    </option>
  );
})}
                    </select>
                    {slotsLoading && (
                      <p className="text-[10px] text-[#8a7560] mt-1">Checking availability…</p>
                    )}
                  </div>
                  {resError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-red-600 text-sm">
                      {resError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRescheduleTarget(null);
                      }}
                      className="flex-1 h-11 border border-[#e0d5c0] rounded-xl text-xs font-medium tracking-[0.1em] uppercase text-[#6b5740]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resSaving}
                      className="flex-1 h-11 bg-[#1a1208] text-[#d4af37] rounded-xl text-xs font-medium tracking-[0.1em] uppercase disabled:opacity-50"
                    >
                      {resSaving ? 'Saving…' : 'Confirm'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {invoiceBill && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
              onClick={() => {
                setInvoiceBill(null);
              }}
            >
                            <div
                className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <div className="px-4 sm:px-6 py-5 border-b border-[#f0e8d8] flex items-start justify-between sticky top-0 bg-white z-10">
                  <div>
                    <h3 className="font-['Cormorant_Garamond'] text-2xl font-light text-[#1a1208]">
                      Invoice
                    </h3>
                    <p className="text-xs text-[#8a7560] mt-1">#{invoiceBill.billNumber}</p>
                  </div>
                  <button
                    onClick={() => {
                      setInvoiceBill(null);
                    }}
                    className="w-8 h-8 border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] hover:border-[#d4af37] hover:text-[#b8860b] transition-all flex-shrink-0"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="px-4 sm:px-7 py-6">
                  <div className="flex flex-col xs:flex-row justify-between items-start gap-2 mb-5 pb-4 border-b-2 border-[#1a1208]">
                    <div>
                      <div className="font-['Cormorant_Garamond'] text-2xl font-semibold text-[#1a1208] tracking-wide">
                        Velvet Premium Unisex Salon
                      </div>
                      <div className="text-[10px] text-[#8a7560] tracking-[0.14em] uppercase mt-1">
                        Premium Beauty &amp; Wellness
                      </div>
                    </div>
                    <div className="text-left xs:text-right">
                      <div className="font-['Cormorant_Garamond'] text-lg text-[#1a1208]">
                        #{invoiceBill.billNumber}
                      </div>
                      <div className="text-xs text-[#8a7560] mt-1">
                        {new Date(invoiceBill.date ?? invoiceBill.createdAt).toLocaleDateString(
                          'en-IN',
                          { day: 'numeric', month: 'long', year: 'numeric' },
                        )}
                      </div>
                    </div>
                  </div>

                                    <div className="mb-5 px-4 py-3.5 bg-[#faf8f4] rounded-lg border border-[#f0e8d8]">
                    <div className="text-[9px] font-medium tracking-[0.18em] uppercase text-[#8a7560] mb-1.5">
                      Bill To
                    </div>
                    <div className="text-sm font-medium text-[#1a1208]">
                      {session?.name ?? 'Customer'}
                    </div>
                    <div className="text-xs text-[#6b5740] mt-0.5">{invoiceBill.phone}</div>
                  </div>

                  {session &&
                    (isTodayMonthDay(session.dob) || isTodayMonthDay(session.anniversary)) && (
                      <div className="mb-5 px-4 py-3 bg-[#fdf2f8] border border-[#fbcfe8] rounded-lg text-[12px] text-[#9d174d] flex items-center gap-2">
                        <span className="text-base">🎁</span>
                        {isTodayMonthDay(session.dob) && isTodayMonthDay(session.anniversary)
                          ? 'Happy birthday & anniversary!'
                          : isTodayMonthDay(session.dob)
                            ? 'Happy birthday!'
                            : 'Happy anniversary!'}
                      </div>
                    )}

                  <table className="w-full mb-3.5">
                    <thead>
                      <tr className="border-b border-[#e0d5c0]">
                        <th className="text-left text-[9px] font-medium tracking-[0.12em] uppercase text-[#8a7560] pb-2">
                          Service
                        </th>
                        <th className="text-left text-[9px] font-medium tracking-[0.12em] uppercase text-[#8a7560] pb-2 hidden xs:table-cell">
                          Staff
                        </th>
                        <th className="text-right text-[9px] font-medium tracking-[0.12em] uppercase text-[#8a7560] pb-2">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
  {invoiceBill.items.map((it, i) => (
    <tr key={i} className="border-b border-[#f5f0e8]">
      <td className="py-2.5 text-[13px] text-[#1a1208]">
        {it.serviceName ?? it.name ?? it.service ?? 'Service'}
        {/* Staff name — shown here on narrow screens where the dedicated column is hidden */}
        <div className="xs:hidden text-[11px] text-[#8a7560] mt-0.5">
          {staffNameForItem(it)}
        </div>
      </td>
      <td className="py-2.5 text-[13px] text-[#6b5740] hidden xs:table-cell">
        {staffNameForItem(it)}
      </td>
      <td className="py-2.5 text-[13px] text-[#1a1208] text-right">
        {fmtCur(it.price ?? 0)}
      </td>
    </tr>
  ))}
</tbody>
                  </table>

                  <div className="border-t border-[#e0d5c0] pt-3 space-y-1.5">
                    <div className="flex justify-between text-[13px] text-[#6b5740]">
                      <span>Subtotal</span>
                      <span>{fmtCur(invoiceBill.subtotal)}</span>
                    </div>
                    {(invoiceBill.membershipDiscount ?? 0) > 0 && (
                      <div className="flex justify-between text-[13px] text-[#2e7d32]">
                        <span>Membership Discount</span>
                        <span>−{fmtCur(invoiceBill.membershipDiscount ?? 0)}</span>
                      </div>
                    )}
                    {(invoiceBill.discountAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-[13px] text-[#2e7d32]">
                        <span>Discount</span>
                        <span>−{fmtCur(invoiceBill.discountAmount ?? 0)}</span>
                      </div>
                    )}
                                       {(invoiceBill.loyaltyRedeemed ?? 0) > 0 && (
                      <div className="flex justify-between text-[13px] text-[#2e7d32]">
                        <span>Loyalty Redeemed</span>
                        <span>−{fmtCur(invoiceBill.loyaltyRedeemed ?? 0)}</span>
                      </div>
                    )}
                    {/* ← ADD THIS BLOCK: shows the referral reward that was applied on this bill */}
                    {(invoiceBill.referralDiscount ?? 0) > 0 && (
                      <div className="flex justify-between text-[13px] text-[#2e7d32]">
                        <span>Referral Reward</span>
                        <span>−{fmtCur(invoiceBill.referralDiscount ?? 0)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-baseline pt-3 mt-2 border-t-2 border-[#1a1208]">
                      <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-[#8a7560]">
                        Total
                      </span>
                      <span className="font-['Cormorant_Garamond'] text-[28px] text-[#1a1208]">
                        {fmtCur(invoiceBill.total)}
                      </span>
                    </div>
                  </div>

                                   <div className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-1.5 bg-[#eaf3de] rounded-full text-[11px] font-medium text-[#3b6d11] tracking-[0.08em] uppercase">
                    <svg
                      className="w-3 h-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {(BILL_STATUS_CFG[invoiceBill.status] ?? { label: invoiceBill.status }).label}{' '}
                    via {invoiceBill.paymentMethod.toUpperCase()}
                  </div>

                  {/* Referral reward banner — mirrors the one shown to staff in BillingPage */}
                  {invoiceBill.referralRewarded && (
                    <div className="mt-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-base">🎁</span>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-green-800">
                          Referral reward credited!
                        </p>
                        <p className="text-[11px] text-green-600 mt-0.5">
                          {invoiceBill.referrerName
                            ? `${invoiceBill.referrerName} earned +100 loyalty points for referring this customer.`
                            : '+100 loyalty points credited to the referrer.'}
                        </p>
                      </div>
                    </div>
                  )}

                 {invoiceBill.notes && (
                    <div className="mt-3 text-[12px] text-[#6b5740] italic">
                      Note: {invoiceBill.notes}
                    </div>
                  )}

                  <div className="text-center mt-6 pt-4 border-t border-[#f0e8d8] text-[11px] text-[#8a7560] tracking-[0.04em]">
                    Thank you for visiting Velvet! ✦ We look forward to seeing you again.
                  </div>

                  <div className="flex gap-2 mt-5">
                    <button
                      onClick={() => {
                        void downloadInvoicePdf(invoiceBill._id, invoiceBill.billNumber);
                      }}
                      disabled={downloadingInvoiceId === invoiceBill._id}
                      className="flex-1 h-11 border border-[#d4af37] rounded-xl bg-white text-[#b8860b] text-xs font-medium tracking-[0.15em] uppercase hover:bg-[#d4af37] hover:text-[#1a1208] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {downloadingInvoiceId === invoiceBill._id ? (
                        <>
                          <span className="w-4 h-4 border-2 border-[#b8860b]/30 border-t-[#b8860b] rounded-full animate-spin" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                          </svg>
                          Download PDF
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        void shareInvoice(invoiceBill);
                      }}
                      className="flex-1 h-11 border border-[#e0d5c0] rounded-xl bg-white text-[#6b5740] text-xs font-medium tracking-[0.15em] uppercase hover:border-[#d4af37] hover:text-[#b8860b] transition-all flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── LOGIN / SIGNUP ─────────────────────────────────────────────── */}
          {!session && !sessionLoading && (
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#b8860b] mb-2">
                  Customer Portal
                </p>
                <h2 className="font-['Cormorant_Garamond'] text-4xl font-light text-[#1a1208] leading-tight">
                  {authMode === 'login' ? (
                    <>
                      Welcome <em className="italic text-[#b8860b]">back</em>
                    </>
                  ) : (
                    <>
                      Create <em className="italic text-[#b8860b]">account</em>
                    </>
                  )}
                </h2>
              </div>

              <div className="flex bg-[#f5f0e8] rounded-xl p-1 mb-6">
                {(['login', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setAuthMode(m);
                      setLoginError('');
                      setSignupError('');
                    }}
                    className={`flex-1 py-2.5 rounded-lg text-[11px] font-medium tracking-[0.1em] uppercase transition-all ${
                      authMode === m
                        ? 'bg-[#1a1208] text-[#d4af37]'
                        : 'text-[#8a7560] hover:text-[#1a1208]'
                    }`}
                  >
                    {m === 'login' ? 'Sign In' : 'Sign Up'}
                  </button>
                ))}
              </div>

              {/* ── SIGN IN ── */}
              {authMode === 'login' && (
                <form
                  onSubmit={(e) => {
                    void handleLogin(e);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className={labelCls}>Mobile Number</label>
                    <input
                      type="tel"
                      placeholder="Your registered mobile"
                      value={loginPhone}
                      onChange={(e) => {
                        setLoginPhone(e.target.value);
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div className="relative">
                    <label className={labelCls}>Date of Birth</label>
                    <input
                      type={showDob ? 'text' : 'password'}
                      placeholder="YYYY-MM-DD"
                      value={loginDob}
                      onChange={(e) => {
                        setLoginDob(e.target.value);
                      }}
                      className={`${inputCls} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowDob((v) => !v);
                      }}
                      className="absolute right-3 top-[38px] text-[#8a7560] hover:text-[#b8860b] transition-colors"
                    >
                      {showDob ? (
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {loginError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-red-600 text-sm">
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {loginError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loginLoading || !loginPhone.trim() || !loginDob.trim()}
                    className="w-full h-12 bg-[#1a1208] text-[#d4af37] rounded-lg text-xs font-medium tracking-[0.2em] uppercase transition-all hover:bg-[#2d2010] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loginLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      'Sign in to Portal'
                    )}
                  </button>
                  <p className="text-center text-xs text-[#8a7560] pt-1 font-light">
                    New customer?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                      }}
                      className="text-[#b8860b] hover:underline"
                    >
                      Create an account
                    </button>
                  </p>
                </form>
              )}

              {/* ── SIGN UP ── */}
              {authMode === 'signup' && (
                <form
                  onSubmit={(e) => {
                    void handleSignup(e);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className={labelCls}>Full Name *</label>
                    <input
                      type="text"
                      placeholder="Your full name"
                      value={signupName}
                      onChange={(e) => {
                        setSignupName(e.target.value);
                      }}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Mobile Number *</label>
                      <input
                        type="tel"
                        placeholder="10-digit mobile"
                        value={signupPhone}
                        onChange={(e) => {
                          setSignupPhone(e.target.value);
                        }}
                        className={inputCls}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input
                        type="email"
                        placeholder="you@email.com"
                        value={signupEmail}
                        onChange={(e) => {
                          setSignupEmail(e.target.value);
                        }}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>
                        Date of Birth <span className="text-[#b8860b]">(used to sign in)</span>
                      </label>
                      <input
                        type="date"
                        value={signupDob}
                        onChange={(e) => {
                          setSignupDob(e.target.value);
                        }}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Anniversary <span className="text-[#c5b89a]">(optional)</span>
                      </label>
                      <input
                        type="date"
                        value={signupAnniversary}
                        onChange={(e) => {
                          setSignupAnniversary(e.target.value);
                        }}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select
                      value={signupGender}
                      onChange={(e) => {
                        setSignupGender(e.target.value as typeof signupGender);
                      }}
                      className={`${inputCls} appearance-none cursor-pointer`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: '32px',
                      }}
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Referral Code (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. VLV-4GZB7V"
                      value={signupRef}
                      onChange={(e) => {
                        setSignupRef(e.target.value.toUpperCase());
                      }}
                      className={inputCls}
                    />
                    {signupRef.trim().length >= 8 && (
                      <p className="text-[11px] text-[#b8860b] mt-1.5">
                        ✓ Referral code will be applied on signup
                      </p>
                    )}
                  </div>
                  {signupError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-red-600 text-sm">
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {signupError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={signupLoading || !signupName.trim() || !signupPhone.trim()}
                    className="w-full h-12 bg-[#1a1208] text-[#d4af37] rounded-lg text-xs font-medium tracking-[0.2em] uppercase transition-all hover:bg-[#2d2010] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {signupLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                        Creating account…
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                  <p className="text-center text-xs text-[#8a7560] pt-1 font-light">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                      }}
                      className="text-[#b8860b] hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                  <div className="bg-[#faf5e8] border border-[#f0e4c0] rounded-xl px-4 py-3 text-xs text-[#6b5740] leading-relaxed">
                    ✦ Your account is created instantly and visible in our salon records. You can
                    book appointments and track loyalty points right away.
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ── PORTAL (LOGGED IN) ─────────────────────────────────────────── */}
          {session && (
            <>
              {/* Upcoming appointment reminder */}
              {upcomingAppt && dismissedAlertId !== upcomingAppt._id && (
                <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3.5">
                  <svg
                    className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">Upcoming appointment</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Your {upcomingAppt.service} appointment is at {fmtTime12(upcomingAppt.time)} today.
                      Please arrive a few minutes early.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setDismissedAlertId(upcomingAppt._id);
                    }}
                    className="text-amber-600 hover:text-amber-800 flex-shrink-0"
                    aria-label="Dismiss"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Welcome banner — always shows live DB values after refreshSession */}
              <div
                className={`bg-gradient-to-r ${tierCfg.gradient} rounded-2xl p-5 sm:p-6 mb-6 text-white relative overflow-hidden`}
              >
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 bg-white -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="text-xs tracking-[0.2em] uppercase opacity-70 mb-1">
                      Welcome back
                    </p>
                    <h2 className="font-['Cormorant_Garamond'] text-3xl font-light">
                      {session.name}
                    </h2>
                    <p className="text-sm opacity-65 mt-1">{session.phone}</p>
                  </div>
                  <div className="flex gap-4 sm:gap-6 justify-between sm:justify-end">
                    {[
                      { label: 'Visits', value: session.visitCount },
                      { label: 'Points', value: session.loyaltyPoints.toLocaleString() },
                      { label: 'Total Spent', value: fmtCur(session.totalSpent) },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <div className="font-['Cormorant_Garamond'] text-xl sm:text-2xl font-light">
                          {s.value}
                        </div>
                        <div className="text-[10px] tracking-[0.1em] uppercase opacity-60 mt-0.5">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Portal tabs */}
              <div className="bg-white border border-[#ede5d6] rounded-xl mb-6 p-1 grid grid-cols-2 sm:flex gap-1">
                {(
                  [
                    { id: 'book', label: 'Book', icon: 'M8 2v4M16 2v4M3 10h18M3 4h18v18H3z' },
                    {
                      id: 'history',
                      label: 'Bookings',
                      icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
                    },
                    {
                      id: 'membership',
                      label: 'Membership',
                      icon: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12',
                    },
                    {
                      id: 'referral',
                      label: 'Refer',
                      icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
                    },
                  ] as { id: PortalTab; label: string; icon: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setPortalTab(t.id);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 rounded-lg text-[10px] sm:text-[11px] font-medium tracking-[0.06em] sm:tracking-[0.08em] uppercase transition-all ${
                      portalTab === t.id
                        ? 'bg-[#1a1208] text-[#d4af37]'
                        : 'text-[#8a7560] hover:text-[#1a1208] hover:bg-[#faf8f4]'
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {t.icon
                        .split('M')
                        .filter(Boolean)
                        .map((d, i) => (
                          <path key={i} d={`M${d}`} />
                        ))}
                    </svg>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── BOOK ── */}
              {portalTab === 'book' && (
                <div className="bg-white border border-[#ede5d6] rounded-2xl overflow-hidden">
                  <div className="px-4 sm:px-6 py-5 border-b border-[#f0e8d8]">
                    <h3 className="font-['Cormorant_Garamond'] text-2xl font-light text-[#1a1208]">
                      Book an Appointment
                    </h3>
                    <p className="text-xs text-[#8a7560] mt-1">
                      Choose your service, stylist and preferred time
                    </p>
                  </div>
                  {bkSuccess && (
                    <div className="mx-4 sm:mx-6 mt-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <svg
                        className="w-5 h-5 text-green-600 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-green-700">Booking confirmed!</p>
                        <p className="text-xs text-green-600">
                          Your appointment has been saved. See you soon!
                        </p>
                      </div>
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      void handlePortalBook(e);
                    }}
                    className="p-4 sm:p-6 space-y-5"
                  >
                    <div>
                      <label className={labelCls}>Select Service</label>
                      <div className="max-h-[360px] overflow-y-auto pr-1 space-y-4">
                        {SERVICE_CATEGORIES.map((cat) => (
                          <div key={cat}>
                            <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#b8860b] mb-2">
                              {cat}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {SERVICES_CAT.filter((s) => s.category === cat).map((svc) => {
                                const discounted = Math.round(svc.price * (1 - discount / 100));
                                return (
                                  <button
                                    key={svc.id}
                                    type="button"
                                    onClick={() => {
                                      setBkService(svc.name);
                                    }}
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                      bkService === svc.name
                                        ? 'border-[#d4af37] bg-[#fffdf5] ring-1 ring-[#d4af37]'
                                        : 'border-[#e0d5c0] bg-white hover:border-[#d4af37] hover:bg-[#fffdf5]'
                                    }`}
                                  >
                                    <div className="text-xs font-medium text-[#1a1208] leading-tight">
                                      {svc.name}
                                    </div>
                                    <div className="text-[10px] text-[#8a7560] mt-1">
                                      {svc.duration} min
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm font-medium text-[#b8860b]">
                                        {fmtCur(discounted)}
                                      </span>
                                      {discount > 0 && (
                                        <span className="text-[10px] line-through text-[#c5b89a]">
                                          {fmtCur(svc.price)}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Choose Stylist</label>
                      {staffLoading ? (
                        <div className="flex items-center gap-2 py-4 text-[#8a7560] text-xs">
                          <span className="w-4 h-4 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                          Loading stylists…
                        </div>
                      ) : staffList.length === 0 ? (
                        <div className="py-4 text-[#8a7560] text-xs">
                          No stylists available right now. Please try again shortly.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {staffList.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setBkStaff(s.id);
                              }}
                              className={`p-3 rounded-xl border text-center transition-all ${
                                bkStaff === s.id
                                  ? 'border-[#d4af37] bg-[#fffdf5] ring-1 ring-[#d4af37]'
                                  : 'border-[#e0d5c0] bg-white hover:border-[#d4af37]'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-full bg-[#faf5e8] border border-[#ede5d6] flex items-center justify-center mx-auto mb-2 text-xs font-medium text-[#b8860b]">
                                {s.name
                                  .split(' ')
                                  .map((p) => p[0])
                                  .join('')}
                              </div>
                              <div className="text-xs font-medium text-[#1a1208]">{s.name}</div>
                              <div className="text-[10px] text-[#8a7560] mt-0.5">
                                {s.speciality}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Date</label>
                        <input
                          type="date"
                          min={todayStr}
                          value={bkDate}
                          onChange={(e) => {
                            setBkDate(e.target.value);
                          }}
                          className="w-full h-11 border border-[#e0d5c0] rounded-lg bg-white px-3 text-sm text-[#2c1f0e] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Time</label>
                        <select
                          value={bkTime}
                          onChange={(e) => {
                            setBkTime(e.target.value);
                          }}
                          className="w-full h-11 border border-[#e0d5c0] rounded-lg bg-white px-3 text-sm text-[#2c1f0e] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/10 appearance-none transition-all"
                        >
                          <option value="">Select time</option>
                          {getAvailableSlots(bkDate).map((t) => (
  <option key={t} value={t} disabled={bookedTimes.includes(t)}>
    {fmtTime12(t)}
    {bookedTimes.includes(t) ? ' (booked)' : ''}
  </option>
))}
                        </select>
                        {slotsLoading && (
                          <p className="text-[10px] text-[#8a7560] mt-1">Checking availability…</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Special Requests (optional)</label>
                      <textarea
                        value={bkNotes}
                        onChange={(e) => {
                          setBkNotes(e.target.value);
                        }}
                        rows={2}
                        placeholder="Allergies, preferences, special instructions…"
                        className="w-full border border-[#e0d5c0] rounded-lg bg-white px-3 py-2.5 text-sm text-[#2c1f0e] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/10 resize-none placeholder:text-[#c5b89a] transition-all"
                      />
                    </div>
                    {selectedSvc && (
                      <div className="bg-[#faf5e8] border border-[#f0e4c0] rounded-xl p-4 flex flex-col xs:flex-row xs:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs text-[#6b5740] font-medium">
                            {selectedSvc.name} · {selectedSvc.duration} min
                          </p>
                          {discount > 0 && (
                            <p className="text-[10px] text-[#b8860b] mt-0.5">
                              {discount}% {tierCfg.label} discount applied
                            </p>
                          )}
                        </div>
                        <div className="text-left xs:text-right">
                          <p className="font-['Cormorant_Garamond'] text-2xl text-[#1a1208]">
                            {fmtCur(finalPrice)}
                          </p>
                          {discount > 0 && (
                            <p className="text-xs line-through text-[#c5b89a]">
                              {fmtCur(selectedSvc.price)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {bkError && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-red-600 text-sm">
                        <svg
                          className="w-4 h-4 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {bkError}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={bkSaving || !bkService || !bkStaff || !bkDate || !bkTime}
                      className="w-full h-12 bg-[#1a1208] text-[#d4af37] rounded-xl text-xs font-medium tracking-[0.2em] uppercase transition-all hover:bg-[#2d2010] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {bkSaving ? (
                        <>
                          <span className="w-4 h-4 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                          Booking…
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          Confirm Appointment
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* ── HISTORY (merged appointments + bills timeline) ── */}
              {portalTab === 'history' && (
                <div className="bg-white border border-[#ede5d6] rounded-2xl overflow-hidden">
                  <div className="px-4 sm:px-6 py-5 border-b border-[#f0e8d8] flex flex-col xs:flex-row xs:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-['Cormorant_Garamond'] text-2xl font-light text-[#1a1208]">
                        My Bookings
                      </h3>
                      <p className="text-xs text-[#8a7560] mt-1">
                        Your appointments and billing history at Velvet
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        void fetchHistory();
                      }}
                      className="h-8 px-3 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[10px] font-medium tracking-[0.1em] uppercase text-[#6b5740] hover:border-[#d4af37] transition-all flex items-center gap-1.5 self-start xs:self-auto flex-shrink-0"
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                  {ratingError && (
                    <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-red-600 text-sm">
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {ratingError}
                    </div>
                  )}
                  {histError && (
                    <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-amber-700 text-sm">
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {histError}
                    </div>
                  )}
                  {histLoading ? (
                    <div className="flex justify-center py-16">
                      <span className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                    </div>
                  ) : timeline.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[#8a7560] gap-3">
                      <svg
                        className="w-12 h-12 opacity-20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <p className="text-sm font-light">No bookings found</p>
                      <button
                        onClick={() => {
                          setPortalTab('book');
                        }}
                        className="h-9 px-5 bg-[#1a1208] text-[#d4af37] rounded-lg text-[10px] font-medium tracking-[0.15em] uppercase hover:bg-[#2d2010] transition-all"
                      >
                        Book Now
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#f5f0e8]">
                      {timeline.map((entry) => {
                        // ── Appointment row ──────────────────────────────────
                        if (entry.kind === 'appointment') {
                          const a = entry.data;
                          const sc = STATUS_CFG[a.status];
                          const stf = staffList.find((s) => s.id === a.staff);
                          const [hh = '0', mm = '00'] = a.time.split(':');
                          const h = parseInt(hh, 10);
                          const ampm = h >= 12 ? 'PM' : 'AM';
                          const h12 = h > 12 ? h - 12 : h || 12;
                          return (
                            <div
                              key={`appt-${a._id}`}
                              className="px-4 sm:px-6 py-4 hover:bg-[#fdfbf7] transition-colors"
                            >
                              <div className="flex items-center gap-3 sm:gap-4">
                                <div className="text-center min-w-[44px] sm:min-w-[52px]">
                                  <div className="font-['Cormorant_Garamond'] text-lg sm:text-xl text-[#1a1208] leading-none">
                                    {h12}:{mm}
                                  </div>
                                  <div className="text-[10px] text-[#8a7560] tracking-wide">
                                    {ampm}
                                  </div>
                                </div>
                                <div className="w-px h-10 bg-[#ede5d6] flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-[#b8860b] bg-[#faf5e8] border border-[#f0e4c0] rounded px-1.5 py-0.5">
                                      Appointment
                                    </span>
                                    <div className="text-sm font-medium text-[#1a1208]">
                                      {a.service}
                                    </div>
                                  </div>
                                  <div className="text-xs text-[#6b5740] mt-0.5">
                                    {fmtDate(a.date)} · {stf?.name ?? a.staff} · {a.duration} min
                                  </div>
                                </div>
                                <span
                                  className={`text-[10px] font-medium tracking-[0.05em] px-2.5 py-1 rounded-full flex-shrink-0 ${sc.cls}`}
                                >
                                  {sc.label}
                                </span>
                              </div>

                              {/* Staff rating */}
                              {a.status === 'completed' && (
                                <div className="mt-3 pl-0 sm:pl-[68px] flex items-center gap-3 flex-wrap">
                                  <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#8a7560]">
                                    {a.staffRating
                                      ? 'Your rating'
                                      : `Rate ${stf?.name ?? 'your stylist'}`}
                                  </span>
                                  <StarRating
                                    value={a.staffRating}
                                    onRate={(n) => {
                                      void handleRateStaff(a._id, n);
                                    }}
                                    submitting={ratingSubmittingId === a._id}
                                    size={16}
                                  />
                                  {a.staffRating == null && ratingSubmittingId === a._id && (
                                    <span className="w-3.5 h-3.5 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                                  )}
                                </div>
                              )}
                              {(a.status === 'confirmed' || a.status === 'pending') && (
                                <div className="mt-3 pl-0 sm:pl-[68px] flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      openReschedule(a);
                                    }}
                                    className="h-7 px-3 border border-[#e0d5c0] rounded-lg text-[10px] font-medium tracking-[0.08em] uppercase text-[#6b5740] hover:border-[#d4af37] hover:text-[#b8860b] transition-all"
                                  >
                                    Reschedule
                                  </button>
                                  <button
                                    onClick={() => {
                                      void handleCancelAppointment(a._id);
                                    }}
                                    disabled={cancellingId === a._id}
                                    className="h-7 px-3 border border-[#f0c9c9] rounded-lg text-[10px] font-medium tracking-[0.08em] uppercase text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                                  >
                                    {cancellingId === a._id ? 'Cancelling…' : 'Cancel'}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // ── Bill row ──────────────────────────────────────────
                        const b = entry.data;
                        const bsc = BILL_STATUS_CFG[b.status] ?? {
                          label: b.status,
                          cls: 'bg-stone-100 text-stone-500 ring-1 ring-stone-200',
                        };
                        const billDt = b.date || b.createdAt;
                        const itemsSummary = b.items
                          .map((it) => it.name ?? it.service ?? '')
                          .filter(Boolean)
                          .join(', ');
                        const totalDiscount = (b.membershipDiscount ?? 0) + (b.discountAmount ?? 0);
                        return (
                          <div
                            key={`bill-${b._id}`}
                            className="px-4 sm:px-6 py-4 hover:bg-[#fdfbf7] transition-colors cursor-pointer"
                            onClick={() => {
                              setInvoiceBill(b);
                            }}
                          >
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="text-center min-w-[44px] sm:min-w-[52px]">
                                <svg
                                  className="w-6 h-6 mx-auto text-[#b8860b]"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                >
                                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                                  <rect x="9" y="3" width="6" height="4" rx="1" />
                                  <line x1="9" y1="12" x2="15" y2="12" />
                                  <line x1="9" y1="16" x2="13" y2="16" />
                                </svg>
                              </div>
                              <div className="w-px h-10 bg-[#ede5d6] flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-[#6b5740] bg-[#f5f0e8] border border-[#ede5d6] rounded px-1.5 py-0.5">
                                    Bill
                                  </span>
                                  <div className="text-sm font-medium text-[#1a1208] truncate">
                                    #{b.billNumber}{' '}
                                    {itemsSummary && (
                                      <span className="text-[#6b5740] font-normal">
                                        · {itemsSummary}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-[#6b5740] mt-0.5">
                                  {fmtDate(normDateForSort(billDt).slice(0, 10))} ·{' '}
                                  {b.paymentMethod}
                                  {totalDiscount > 0 && <> · {fmtCur(totalDiscount)} discount</>}
                                  {b.loyaltyRedeemed ? (
                                    <> · {b.loyaltyRedeemed} pts redeemed</>
                                  ) : null}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-['Cormorant_Garamond'] text-lg text-[#1a1208] leading-none">
                                  {fmtCur(b.total)}
                                </div>
                                <span
                                  className={`inline-block mt-1.5 text-[10px] font-medium tracking-[0.05em] px-2.5 py-1 rounded-full ${bsc.cls}`}
                                >
                                  {bsc.label}
                                </span>
                              </div>
                            </div>
                            {/* Experience rating */}
                            {b.status === 'paid' && (
                              <div
                                className="mt-3 pl-0 sm:pl-[68px] flex items-center gap-3 flex-wrap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#8a7560]">
                                  {b.staffRating ? 'Your rating' : 'Rate your experience'}
                                </span>
                                <StarRating
                                  value={b.staffRating}
                                  onRate={(n) => {
                                    void handleRateBill(b._id, n);
                                  }}
                                  submitting={ratingSubmittingId === b._id}
                                  size={16}
                                />
                                {b.staffRating == null && ratingSubmittingId === b._id && (
                                  <span className="w-3.5 h-3.5 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── MEMBERSHIP ── */}
              {portalTab === 'membership' && (
                <div className="space-y-5">
                  <div
                    className={`bg-gradient-to-br ${tierCfg.gradient} rounded-2xl p-5 sm:p-7 text-white relative overflow-hidden`}
                  >
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
                    <div className="relative z-10 flex justify-between items-start">
                      <div>
                        <p className="text-[10px] tracking-[0.25em] uppercase opacity-70">
                          Velvet Membership
                        </p>
                        <h3 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl font-light mt-1">
                          {tierCfg.label}
                        </h3>
                        {session.membershipExpiry && (
                          <p className="text-xs opacity-60 mt-1">
                            Valid until {fmtDate(session.membershipExpiry)}
                          </p>
                        )}
                      </div>
                      <div className="text-2xl opacity-80">◆</div>
                    </div>
                    <div className="relative z-10 mt-6 flex flex-col xs:flex-row justify-between xs:items-end gap-3">
                      <div>
                        <p className="text-xs opacity-60">{session.name}</p>
                        <p className="text-[10px] opacity-50 tracking-[0.1em] mt-0.5">
                          CODE: {session.referralCode}
                        </p>
                      </div>
                      <div className="text-left xs:text-right">
                        <p className="font-['Cormorant_Garamond'] text-2xl">
                          {session.loyaltyPoints.toLocaleString()} pts
                        </p>
                        <p className="text-[10px] opacity-60">
                          ≈ {fmtCur(Math.floor(session.loyaltyPoints / 10))} value
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Loyalty Points', value: session.loyaltyPoints.toLocaleString() },
                      { label: 'Discount', value: `${String(tierCfg.discount)}%` },
                      { label: 'Total Visits', value: session.visitCount },
                      { label: 'Total Spend', value: fmtCur(session.totalSpent) },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-white border border-[#ede5d6] rounded-xl p-4 text-center"
                      >
                        <div className="font-['Cormorant_Garamond'] text-2xl text-[#1a1208]">
                          {s.value}
                        </div>
                        <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#8a7560] mt-1">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white border border-[#ede5d6] rounded-2xl p-4 sm:p-6">
                    <h4 className="font-['Cormorant_Garamond'] text-xl font-light text-[#1a1208] mb-1">
                      My Coupons
                    </h4>
                    <p className="text-xs text-[#8a7560] mb-4">
                      Personal reward coupons earned from your visits
                    </p>
                    {couponsLoading ? (
                      <div className="flex justify-center py-6">
                        <span className="w-5 h-5 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                      </div>
                    ) : myCoupons.length === 0 ? (
                      <p className="text-xs text-[#8a7560] py-2">
                        No active coupons right now — a bigger visit earns you a reward coupon for
                        next time!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {myCoupons.map((c) => (
                          <div
                            key={c._id}
                            className="flex flex-col xs:flex-row xs:items-center gap-3 bg-[#faf5e8] border border-dashed border-[#d4af37] rounded-xl px-4 py-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-['Cormorant_Garamond'] text-xl tracking-[0.08em] text-[#1a1208]">
                                {c.code}
                              </div>
                              <div className="text-[11px] text-[#8a7560] mt-0.5">
                                {c.discountType === 'percent'
                                  ? `${String(c.discountValue)}% off`
                                  : `${fmtCur(c.discountValue)} off`}
                                {c.expiryDate && <> · valid until {fmtDate(c.expiryDate)}</>}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                void navigator.clipboard.writeText(c.code).then(() => {
                                  setCopiedCouponId(c._id);
                                  setTimeout(() => {
                                    setCopiedCouponId(null);
                                  }, 2000);
                                });
                              }}
                              className="h-8 px-3 border border-[#d4af37] rounded-lg bg-white text-[#b8860b] text-[10px] font-medium tracking-[0.1em] uppercase hover:bg-[#d4af37] hover:text-[#1a1208] transition-all flex-shrink-0 self-start xs:self-auto"
                            >
                              {copiedCouponId === c._id ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {session.anniversary && (
                    <div className="bg-white border border-[#ede5d6] rounded-2xl p-5 flex items-center gap-4">
                      <div className="text-2xl">💍</div>
                      <div>
                        <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560]">
                          Anniversary on file
                        </p>
                        <p className="text-sm font-medium text-[#1a1208] mt-0.5">
                          {fmtDate(session.anniversary)}
                        </p>
                      </div>
                    </div>
                  )}
                  {session.membershipTier !== 'platinum' && (
                    <div className="bg-[#faf5e8] border border-[#f0e4c0] rounded-2xl p-5 flex items-center gap-4">
                      <div className="text-2xl">✨</div>
                      <div>
                        <p className="text-sm font-medium text-[#1a1208]">
                          {session.membershipTier === 'none'
                            ? 'Upgrade to Silver for 10% off all services'
                            : session.membershipTier === 'silver'
                              ? 'Upgrade to Gold for 20% off + priority booking'
                              : 'Upgrade to Platinum for 30% off + dedicated stylist'}
                        </p>
                        <p className="text-xs text-[#8a7560] mt-0.5">
                          Visit the salon or speak to our receptionist
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── REFER & EARN ── */}
              {portalTab === 'referral' && (
                <div className="space-y-5">
                  <div className="bg-white border border-[#ede5d6] rounded-2xl p-4 sm:p-6">
                    <h3 className="font-['Cormorant_Garamond'] text-2xl font-light text-[#1a1208] mb-1">
                      Your Referral Code
                    </h3>
                    <p className="text-xs text-[#8a7560] mb-5">
                      Share your code and earn ₹100 for every friend who visits
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <div className="flex-1 bg-[#faf5e8] border border-dashed border-[#d4af37] rounded-xl py-4 px-6 text-center">
                        <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#8a7560] mb-1">
                          Your Code
                        </p>
                        <p className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl tracking-[0.15em] sm:tracking-[0.2em] text-[#1a1208] break-all">
                          {session.referralCode || '—'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={copyCode}
                          className="h-10 px-5 border border-[#d4af37] rounded-xl bg-white text-[#b8860b] text-xs font-medium tracking-[0.1em] uppercase flex items-center justify-center gap-2 hover:bg-[#d4af37] hover:text-[#1a1208] transition-all"
                        >
                          {copiedCode ? '✓ Copied!' : 'Copy Code'}
                        </button>
                        <button
                          onClick={() =>
                            window.open(
                              `https://wa.me/?text=Get pampered at Velvet Salon! Use my code ${session.referralCode} for a discount.`,
                            )
                          }
                          className="h-10 px-5 border border-[#25D366] rounded-xl bg-white text-[#25D366] text-xs font-medium tracking-[0.1em] uppercase flex items-center justify-center gap-2 hover:bg-[#25D366] hover:text-white transition-all"
                        >
                          Share on WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
                    {[
                      { label: 'Total Referred', value: session.referrals.length },
                      {
                        label: 'Converted',
                        value: session.referrals.filter((r) => r.status === 'converted').length,
                      },
                      {
                        label: 'Rewards Earned',
                        value: fmtCur(
                          session.referrals
                            .filter((r) => r.status === 'credited')
                            .reduce((s, r) => s + r.reward, 0),
                        ),
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-white border border-[#ede5d6] rounded-xl p-4 text-center"
                      >
                        <div className="font-['Cormorant_Garamond'] text-2xl text-[#1a1208]">
                          {s.value}
                        </div>
                        <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#8a7560] mt-1">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white border border-[#ede5d6] rounded-2xl p-4 sm:p-6">
                    <h4 className="font-['Cormorant_Garamond'] text-xl font-light text-[#1a1208] mb-1">
                      Refer a Friend
                    </h4>
                    <p className="text-xs text-[#8a7560] mb-5">
                      Enter their details and we'll reach out to them
                    </p>
                    {refSuccess && (
                      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                        <svg
                          className="w-4 h-4 text-green-600"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <p className="text-sm text-green-700 font-medium">
                          Referral submitted! You'll earn ₹100 when they visit.
                        </p>
                      </div>
                    )}
                    <form
                      onSubmit={(e) => {
                        void handleReferral(e);
                      }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Friend's Name</label>
                          <input
                            type="text"
                            placeholder="Full name"
                            value={refName}
                            onChange={(e) => {
                              setRefName(e.target.value);
                            }}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Mobile Number</label>
                          <input
                            type="tel"
                            placeholder="10-digit mobile"
                            value={refPhone}
                            onChange={(e) => {
                              setRefPhone(e.target.value);
                            }}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={refSaving || !refName || !refPhone}
                        className="w-full h-11 bg-[#1a1208] text-[#d4af37] rounded-xl text-xs font-medium tracking-[0.2em] uppercase hover:bg-[#2d2010] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                      >
                        {refSaving ? (
                          <>
                            <span className="w-4 h-4 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                            Submitting…
                          </>
                        ) : (
                          'Submit Referral'
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Module-level helpers ─────────────────────────────────────────────────────
/**
 * Normalise any date-ish string (YYYY-MM-DD or full ISO timestamp) into a
 * sortable ISO-ish string so appointments and bills can be merged into one
 * chronological timeline. Falls back to a very old date if missing/invalid
 * so malformed entries sink to the bottom rather than crashing the sort.
 */
function normDateForSort(d?: string): string {
  if (!d) return '0000-01-01T00:00';
  // Already a full ISO timestamp (bills' createdAt) — use as-is.
  if (d.includes('T')) return d;
  // Plain YYYY-MM-DD (appointments' date, or bills' date field) — pad with time.
  return `${d.slice(0, 10)}T00:00`;
}
