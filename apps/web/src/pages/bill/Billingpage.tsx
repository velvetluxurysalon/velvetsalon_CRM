import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom'; // ← ADD THIS LINE
import * as XLSX from 'xlsx';
import {
  SERVICE_INVENTORY_MAP,
  SERVICES_CAT,
  SERVICE_CATEGORIES,
  type ServiceCatalogue,
} from '../../db/services';

// ─── Types ─────────────────────────────────────────────────────────────────────
type PaymentMethod = 'cash' | 'card' | 'upi';
type DiscountType = 'percent' | 'flat';
type MembershipTier = 'none' | 'silver' | 'gold' | 'platinum';

interface BillItem {
  _key: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  price: number;
  duration: number;
}
interface Referral {
  _id: string;
  referredName: string;
  referredPhone: string;
  date: string;
  status: 'pending' | 'converted' | 'credited';
  reward: number;
}
interface CustomerInfo {
  _id: string;
  name: string;
  phone: string;
  email: string;
  loyaltyPoints: number;
  membershipTier: MembershipTier;
  membershipExpiry: string;
  visitCount: number;
  totalSpent: number;
  dob?: string;
  anniversary?: string;
  referrals?: Referral[]; // ← ADD THIS LINE
}
interface SavedBill {
  _id: string;
  billNumber: string;
  customer: { name: string; phone: string } | null;
  phone: string;
  items: Omit<BillItem, '_key'>[];
  subtotal: number;
  membershipDiscount: number;
  discountAmount: number;
  loyaltyRedeemed: number;
  referralDiscount?: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: 'paid' | 'pending';
  createdAt: string;
  notes: string;
  date?: string;
}

interface StockInfo {
  currentStock: number;
  unit: string;
  status: 'ok' | 'low' | 'critical' | 'out';
}
interface DeductionResult {
  productName: string;
  deducted: number;
  skipped: boolean;
  reason?: string;
}

// ── Staff member as returned by /api/staff-roles ────────────────────────────
type StaffRole = 'admin' | 'manager' | 'senior_stylist' | 'stylist' | 'receptionist' | 'support';

type StaffStatus = 'active' | 'on_leave' | 'inactive';

interface StaffMember {
  _id: string;
  name: string;
  phone: string;
  email: string;
  role: StaffRole;
  speciality: string;
  status: StaffStatus;
  joinDate: string;
  exitDate: string;
  notes: string;
}

// ─── Static config ─────────────────────────────────────────────────────────────
const MEMBERSHIP_DISCOUNT: Record<MembershipTier, number> = {
  none: 0,
  silver: 10,
  gold: 20,
  platinum: 30,
};
const MEMBERSHIP_CFG: Record<MembershipTier, { label: string; color: string; bg: string }> = {
  none: { label: 'No Membership', color: '#8a7560', bg: '#f5f0e8' },
  silver: { label: 'Silver Member', color: '#6b7280', bg: '#f3f4f6' },
  gold: { label: 'Gold Member', color: '#b8860b', bg: '#fefce8' },
  platinum: { label: 'Platinum', color: '#7c3aed', bg: '#f5f3ff' },
};

// ── UPI dynamic QR config ────────────────────────────────────────────────
const UPI_ID = 'paytm.s209biv@pty';
const UPI_PAYEE_NAME = 'Velvet Premium Unisex Salon';

// Replace with your real Google review / feedback form link
const FEEDBACK_URL = 'https://g.page/r/CWB5ZgKh5KkEEBM/review';

// Builds a upi://pay deep link with the amount baked in, then wraps it in a
// free QR-image endpoint so we can just point an <img> at it — no extra
// npm dependency needed.
const buildUpiQrSrc = (amount: number, note: string) => {
  const upiLink =
    `upi://pay?pa=${encodeURIComponent(UPI_ID)}` +
    `&pn=${encodeURIComponent(UPI_PAYEE_NAME)}` +
    `&am=${encodeURIComponent(amount.toFixed(2))}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(note)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(upiLink)}`;
};

// ── Staff display helpers (replaces the old hardcoded STAFF_LIST) ───────────
// Roles considered "service-performing" staff, shown in the Assign Staff dropdown.
// Adjust this list if you want different roles selectable for bookings.
const BOOKABLE_ROLES: StaffRole[] = ['senior_stylist', 'stylist', 'manager', 'admin'];

const STAFF_AVATAR_COLORS = [
  '#d4af37',
  '#b8860b',
  '#8a7050',
  '#6b5740',
  '#0f766e',
  '#7c3aed',
  '#db2777',
  '#2563eb',
];
const staffAvatarColor = (name: string) => {
  const code = name[0]?.toUpperCase().charCodeAt(0) ?? 65;
  return STAFF_AVATAR_COLORS[code % STAFF_AVATAR_COLORS.length];
};
// const staffInitials = (name: string) =>
//   (name || "?").split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  senior_stylist: 'Senior Stylist',
  stylist: 'Stylist',
  receptionist: 'Receptionist',
  support: 'Support Staff',
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
const API = `${API_BASE}/api`;
const token = (): string => {
  try {
    const parsed = JSON.parse(localStorage.getItem('velvet_token') ?? '{}') as { token?: string };
    return parsed.token ?? '';
  } catch {
    return '';
  }
};
const hdr = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });
const fmtCur = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const todayStr = new Date().toISOString().slice(0, 10);

// Returns true if the given "YYYY-MM-DD" date's month+day matches today —
// used to flag birthdays/anniversaries regardless of birth year.
const isTodayMonthDay = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};
let _k = 0;
const nk = () => `k${String(++_k)}`;

function getAggregatedConsumables(
  items: BillItem[],
): Map<string, { quantity: number; unit: string }> {
  const map = new Map<string, { quantity: number; unit: string }>();
  for (const item of items) {
    const consumables = (SERVICE_INVENTORY_MAP[item.serviceId] ?? []) as {
      productName: string;
      quantity: number;
      unit: string;
    }[];
    for (const c of consumables) {
      const prev = map.get(c.productName);
      if (prev) prev.quantity += c.quantity;
      else map.set(c.productName, { quantity: c.quantity, unit: c.unit });
    }
  }
  return map;
}

// ── Excel export helper ──────────────────────────────────────────────────────
function downloadBillsExcel(rows: SavedBill[], filename: string) {
  const sheetData = rows.map((b) => ({
    'Bill Number': b.billNumber,
    Customer: b.customer?.name ?? 'Walk-in',
    Phone: b.phone,
    Services: b.items.map((i) => i.serviceName).join(', '),
    Subtotal: b.subtotal,
    'Membership Discount': b.membershipDiscount,
    'Manual/Coupon Discount': b.discountAmount,
    'Loyalty Redeemed': b.loyaltyRedeemed,
    Total: b.total,
    'Payment Method': b.paymentMethod,
    Status: b.status,
    Date: (b.date ?? b.createdAt).slice(0, 10),
    Notes: b.notes,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bills');
  XLSX.writeFile(wb, filename);
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const p: Record<string, string> = {
    plus: 'M12 5v14M5 12h14',
    trash: 'M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2',
    search: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    phone:
      'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z',
    receipt:
      'M4 2h16a1 1 0 0 1 1 1v19l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 0 1 1-1zM8 8h8M8 12h8M8 16h4',
    print:
      'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
    whatsapp: 'M12 2a10 10 0 0 1 8.93 14.47L22 22l-5.53-1.07A10 10 0 1 1 12 2z',
    scissors:
      'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12',
    tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    award: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12',
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    cash: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    card: 'M1 4h22v16H1zM1 10h22',
    upi: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    history: 'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8',
    refresh:
      'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    gift: 'M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01',
    box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
    alert:
      'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  };
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {(p[n] ?? '')
        .split('M')
        .filter(Boolean)
        .map((d, i) => (
          <path key={i} d={`M${d}`} />
        ))}
    </svg>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const [phone, setPhone] = useState('');
  const [searchParams] = useSearchParams(); // ← ADD
  const appointmentId = searchParams.get('appointmentId'); // ← ADD
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupState, setLookupState] = useState<'idle' | 'found' | 'new' | 'error'>('idle');
  const [items, setItems] = useState<BillItem[]>([]);
  const [apptDate, setApptDate] = useState<string | null>(null); // ← NEW
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState<number | ''>(0);
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  const [loyaltyInput, setLoyaltyInput] = useState<number | ''>(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: DiscountType;
    discountValue: number;
    discountAmount: number;
    description: string;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [upiPaymentConfirmed, setUpiPaymentConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [lastBill, setLastBill] = useState<SavedBill | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [recentBills, setRecentBills] = useState<SavedBill[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [stockMap, setStockMap] = useState<Map<string, StockInfo>>(new Map());
  const [stockLoading, setStockLoading] = useState(false);
  const [deductionResults, setDeductionResults] = useState<DeductionResult[]>([]);
  const [showConsumables, setShowConsumables] = useState(false);
 const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null); // ← added
const [sharingWa, setSharingWa] = useState(false);
const waLinkRef = useRef<{ billNumber: string; url: string } | null>(null);

  // Amazon-style download toast — shows progress, then success with a "View" action
  const [downloadToast, setDownloadToast] = useState<{
    billNumber: string;
    status: 'loading' | 'success' | 'error';
    blobUrl?: string;
  } | null>(null);
  // ── Live staff list (fetched from the Staff & Roles backend) ───────────────
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

    // ── Referral reward state ──────────────────────────────────────────────────
  const [referralReward, setReferralReward] = useState<{
    rewarded: boolean;
    referrerName?: string;
  } | null>(null);
  // ← ADD THIS LINE: tracks which of the customer's pending referrals the
  // staff has toggled "on" to be redeemed/converted on this bill.
  const [selectedReferralIds, setSelectedReferralIds] = useState<string[]>([]);
    const [autoCoupon, setAutoCoupon] = useState<{
    code: string;
    discountValue: number;
    expiryDate: string;
  } | null>(null);
  const [invoiceOccasion, setInvoiceOccasion] = useState<{
    birthday: boolean;
    anniversary: boolean;
  } | null>(null);

    const subtotal = items.reduce((s, i) => s + i.price, 0);
  const isCustomerBirthdayToday = customer ? isTodayMonthDay(customer.dob) : false;
  const isCustomerAnniversaryToday = customer ? isTodayMonthDay(customer.anniversary) : false;
  const membershipPct = customer ? MEMBERSHIP_DISCOUNT[customer.membershipTier] : 0;
  const membershipDisc = Math.round((subtotal * membershipPct) / 100);
  const afterMembership = subtotal - membershipDisc;
  const dv = Number(discountValue) || 0;
  const manualDisc =
    discountType === 'percent'
      ? Math.round((afterMembership * dv) / 100)
      : Math.min(dv, afterMembership);
  const afterManual = afterMembership - manualDisc;
  const couponDisc = appliedCoupon?.discountAmount ?? 0;
  const afterCoupon = Math.max(0, afterManual - couponDisc);
    const maxLoyalty = customer
    ? Math.min(
        Math.floor(customer.loyaltyPoints / 10) * 10,
        Math.floor(afterCoupon * 0.2),
        afterCoupon,
      )
    : 0;
  const loyaltyDisc = redeemLoyalty ? Math.min(Number(loyaltyInput) || 0, maxLoyalty) : 0;
  // ← ADD THIS BLOCK: sum the reward value of every toggled-on referral, applied as a discount on this bill
  const referralDisc = (customer?.referrals ?? [])
    .filter((r) => selectedReferralIds.includes(r._id))
    .reduce((sum, r) => sum + r.reward, 0);
  const total = Math.max(0, afterCoupon - loyaltyDisc - referralDisc); // ← CHANGED: subtract referralDisc, clamp at 0
  const totalSavings = membershipDisc + manualDisc + couponDisc + loyaltyDisc + referralDisc; // ← CHANGED: include referralDisc

  const aggregatedConsumables = getAggregatedConsumables(items);

  const stockWarnings = Array.from(aggregatedConsumables.entries())
    .map(([name, { quantity, unit }]) => ({
      name,
      needed: quantity,
      unit,
      info: stockMap.get(name.toLowerCase()),
    }))
    .filter((w): w is typeof w & { info: StockInfo } => !!w.info && w.info.status !== 'ok');

  const hasOutOfStock = stockWarnings.some((w) => w.info.status === 'out');

  // ── Fetch staff from backend (same source as Staff & Roles page) ───────────
  const fetchStaffList = useCallback(async () => {
    setStaffLoading(true);
    setStaffError('');
    try {
      const res = await fetch(`${API}/staff-roles`, { headers: hdr() });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as StaffMember[];
      setStaffList(data);
    } catch (e: unknown) {
      setStaffError(e instanceof Error ? e.message : 'Failed to load staff list.');
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStaffList();
  }, [fetchStaffList]);

  // Staff selectable in the "Assign Staff" dropdown: active + bookable roles
  const bookableStaff = useMemo(
    () => staffList.filter((s) => s.status === 'active' && BOOKABLE_ROLES.includes(s.role)),
    [staffList],
  );

  // Lookup map so existing bill items / invoices can resolve a staffId -> name even
  // for staff who may have since left or changed role.
  const staffById = useMemo(() => {
    const map = new Map<string, StaffMember>();
    for (const s of staffList) map.set(s._id, s);
    return map;
  }, [staffList]);

  const staffName = (id: string) => staffById.get(id)?.name ?? '—';

  const fetchStockForItems = useCallback(async (billItems: BillItem[]) => {
    const consumables = getAggregatedConsumables(billItems);
    if (consumables.size === 0) return;
    setStockLoading(true);
    try {
      const res = await fetch(`${API}/inventory`, { headers: hdr() });
      if (!res.ok) return;
      const products = (await res.json()) as Array<{
        name: string;
        currentStock: number;
        unit: string;
        lowStockThreshold: number;
      }>;
      const newMap = new Map<string, StockInfo>();
      for (const prod of products) {
        const key = prod.name.toLowerCase();
        const stock = prod.currentStock;
        const threshold = prod.lowStockThreshold;
        let status: StockInfo['status'] = 'ok';
        if (stock <= 0) status = 'out';
        else if (stock <= threshold * 0.5) status = 'critical';
        else if (stock <= threshold) status = 'low';
        newMap.set(key, { currentStock: stock, unit: prod.unit, status });
      }
      setStockMap(newMap);
    } catch {
      /* advisory */
    } finally {
      setStockLoading(false);
    }
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const t = setTimeout(() => {
      void fetchStockForItems(items);
    }, 400);
    return () => {
      clearTimeout(t);
    };
  }, [items, fetchStockForItems]);

   const lookupCustomer = useCallback(async (p: string) => {
    if (p.length < 10) {
      setCustomer(null);
      setLookupState('idle');
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch(`${API}/customers?q=${p}`, { headers: hdr() });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as CustomerInfo[];
           const found = data.find((c) => c.phone === p);
      setCustomer(found ?? null);
      setLookupState(found ? 'found' : 'new');
      setSelectedReferralIds([]); // ← ADD THIS LINE: reset toggles for the new lookup

      // ← ADD THIS BLOCK: the search endpoint returns a lightweight record
      // that doesn't include `referrals` — fetch the full customer detail
      // (same endpoint CustomersPage uses) so the pending-referral note
      // above has the data it needs.
      if (found) {
        try {
          const res2 = await fetch(`${API}/customers/${found._id}`, { headers: hdr() });
          if (res2.ok) {
            const full = (await res2.json()) as CustomerInfo;
            setCustomer(full);
          }
        } catch {
          /* keep the lightweight record already set */
        }
      }
    } catch {
      setLookupState('error');
    } finally {
      setLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (phone.length >= 10) {
        void lookupCustomer(phone);
      } else {
        setCustomer(null);
        setLookupState('idle');
      }
    }, 500);
    return () => {
      clearTimeout(t);
    };
  }, [phone, lookupCustomer]);

  const fetchRecent = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await fetch(`${API}/bills?limit=15`, { headers: hdr() });
      if (!res.ok) throw new Error();
      setRecentBills((await res.json()) as SavedBill[]);
    } catch {
      /* silent */
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecent();
  }, [fetchRecent]);

  // ── Export all bills to Excel ────────────────────────────────────────────
  const handleExportClick = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API}/bills`, { headers: hdr() });
      if (!res.ok) throw new Error(await res.text());
      const all = (await res.json()) as SavedBill[];
      downloadBillsExcel(all, `bills_${todayStr}.xlsx`);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Failed to export bills.');
    } finally {
      setExporting(false);
    }
  };

  // Any change to payment method or bill amount invalidates a prior UPI
  // confirmation — force the cashier to re-confirm against the new QR/amount.
  useEffect(() => {
    setUpiPaymentConfirmed(false);
  }, [paymentMethod, total]);

  // ── ADD THIS WHOLE BLOCK ──────────────────────────────────────────────────
  useEffect(() => {
    if (!appointmentId) return;
    void (async () => {
      try {
        const res = await fetch(`${API}/appointments/${appointmentId}`, { headers: hdr() });
        if (!res.ok) throw new Error('Appointment not found');
        const appt = (await res.json()) as {
          phone: string;
          service: string;
          staff: string;
          duration: number;
          price?: number;
          date: string; // ← ADDED date
        };

        if (appt.phone) setPhone(appt.phone);
        if (appt.date) setApptDate(appt.date); // ← NEW

        const svc = SERVICES_CAT.find((s) => s.name === appt.service);
        if (svc) {
          setItems([
            {
              _key: nk(),
              serviceId: svc.id,
              serviceName: svc.name,
              staffId: appt.staff,
              price: svc.price,
              duration: svc.duration,
            },
          ]);
        } else {
          setApiError(`Service "${appt.service}" not found in catalogue — please add it manually.`);
        }
      } catch {
        setApiError("Couldn't load appointment details — please add services manually.");
      }
    })();
  }, [appointmentId]);
  // ── END NEW BLOCK ─────────────────────────────────────────────────────────

  const addItem = (svc: ServiceCatalogue, staffId: string) => {
    setItems((prev) => [
      ...prev,
      {
        _key: nk(),
        serviceId: svc.id,
        serviceName: svc.name,
        staffId,
        price: svc.price,
        duration: svc.duration,
      },
    ]);
    setPickerOpen(false);
  };
  const removeItem = (key: string) => {
    setItems((p) => p.filter((i) => i._key !== key));
  };
  const updatePrice = (key: string, price: number) => {
    setItems((p) => p.map((i) => (i._key === key ? { ...i, price } : i)));
  };

  const applyCoupon = useCallback(
    async (code: string, silent = false) => {
      if (!code.trim()) return;
      setCouponLoading(true);
      setCouponError('');
      try {
        const res = await fetch(`${API}/coupons/validate`, {
          method: 'POST',
          headers: hdr(),
          body: JSON.stringify({ code: code.trim(), amount: afterManual, customerPhone: phone }),
        });
        const data = (await res.json()) as {
          valid: boolean;
          message?: string;
          code: string;
          discountType: DiscountType;
          discountValue: number;
          discountAmount: number;
          description: string;
        };
        if (!res.ok || !data.valid) {
          setAppliedCoupon(null);
          setCouponError(data.message ?? 'Invalid coupon code.');
          return;
        }
        setAppliedCoupon({
          code: data.code,
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountAmount: data.discountAmount,
          description: data.description,
        });
        if (!silent) setCouponCode('');
      } catch {
        setCouponError('Failed to validate coupon.');
      } finally {
        setCouponLoading(false);
      }
    },
    [afterManual, phone],
  );

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // Silently re-check the applied coupon whenever the pre-coupon total shifts
  // (items or manual discount edited) so the shown amount stays accurate.
  useEffect(() => {
    if (!appliedCoupon) return;
    const t = setTimeout(() => {
      void applyCoupon(appliedCoupon.code, true);
    }, 300);
    return () => {
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterManual]);

  const saveBill = async (status: 'paid' | 'pending') => {
    if (!items.length) {
      setApiError('Add at least one service.');
      return;
    }
    if (!phone) {
      setApiError('Enter a customer phone number.');
      return;
    }
    setSaving(true);
    setApiError('');
        const stripKey = (item: BillItem): Omit<BillItem, '_key'> => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- intentional discard of the local-only React key
      const { _key, ...rest } = item;
      return rest;
    };

    // Distribute the overall bill discount proportionally across each line item,
    // so per-service records (Services tab) reflect the amount actually charged —
    // same as how the invoice/visit total already does.
    const discountRatio = subtotal > 0 ? total / subtotal : 1;
    const discountedItems = items.map((item) => ({
      ...stripKey(item),
      price: Math.round(item.price * discountRatio),
    }));

    const payload = {
      phone,
      customerName: customer?.name ?? 'Walk-in',
      customerId: customer?._id,
      items: discountedItems,
      subtotal,
      membershipDiscount: membershipDisc,
      discountType,
      discountValue: dv,
      discountAmount: manualDisc,
           couponCode: appliedCoupon?.code,
      loyaltyRedeemed: loyaltyDisc,
      total,
      paymentMethod,
      status,
      notes,
      date: apptDate ?? todayStr,
           appointmentId: appointmentId || undefined,
      redeemedReferralIds: selectedReferralIds, // ← tells the backend which pending referrals to mark converted + credit
      referralDiscount: referralDisc, // ← ADD THIS LINE: the ₹ amount deducted from this bill for the toggled referrals
    };
    try {
      const url = editingBillId ? `${API}/bills/${editingBillId}` : `${API}/bills`;
      const method = editingBillId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: hdr(), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as SavedBill & {
        referral_rewarded?: boolean;
        referral_referrer_name?: string;
        auto_coupon?: { code: string; discountValue: number; expiryDate: string } | null;
      };
      const bill: SavedBill = data;

      if (data.referral_rewarded) {
        setReferralReward({
          rewarded: true,
          ...(data.referral_referrer_name ? { referrerName: data.referral_referrer_name } : {}),
        });
      } else {
        setReferralReward(null);
      }

      setAutoCoupon(data.auto_coupon ?? null);

            setLastBill(bill);
      setInvoiceOccasion(
        isCustomerBirthdayToday || isCustomerAnniversaryToday
          ? { birthday: isCustomerBirthdayToday, anniversary: isCustomerAnniversaryToday }
          : null,
      );
      const predicted: DeductionResult[] = [];
      for (const [name, { quantity }] of Array.from(aggregatedConsumables.entries())) {
        const info = stockMap.get(name.toLowerCase());
        if (!info)
          predicted.push({
            productName: name,
            deducted: 0,
            skipped: true,
            reason: 'not found in inventory',
          });
        else if (info.status === 'out')
          predicted.push({ productName: name, deducted: 0, skipped: true, reason: 'out of stock' });
        else
          predicted.push({
            productName: name,
            deducted: Math.min(quantity, info.currentStock),
            skipped: false,
          });
      }
      setDeductionResults(predicted);
      setShowInvoice(true);
      setItems([]);
      setPhone('');
      setCustomer(null);
      setLookupState('idle');
      setDiscountValue(0);
      setRedeemLoyalty(false);
      setLoyaltyInput(0);
      setAppliedCoupon(null);
      setCouponCode('');
      setCouponError('');
      setNotes('');
            setPaymentMethod('cash');
      setStockMap(new Map());
      setUpiPaymentConfirmed(false);
      setEditingBillId(null);
      setSelectedReferralIds([]); // ← ADD THIS LINE
      void fetchRecent();
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Failed to save bill.');
    } finally {
      setSaving(false);
    }
  };

  // Fetches a server-generated PDF for a bill by its Order ID (billNumber)
  // and triggers a browser download — replaces the old window.print() popup.
  // Now also drives an Amazon-style toast: "Preparing…" while fetching, then
  // "Downloaded" with a View button once the file lands.
  const downloadInvoicePdf = async (orderId: string) => {
    setDownloadingInvoiceId(orderId);
    setDownloadToast({ billNumber: orderId, status: 'loading' });
    try {
      const res = await fetch(`${API}/bills/${orderId}/invoice`, { headers: hdr() });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Keep the blob URL alive (don't revoke) so the toast's "View" button
      // can still open it — cleaned up when the toast is dismissed instead.
      setDownloadToast({ billNumber: orderId, status: 'success', blobUrl: url });
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Failed to download invoice PDF.');
      setDownloadToast({ billNumber: orderId, status: 'error' });
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  // Dismiss the toast and free the blob URL it was holding open
  const dismissDownloadToast = () => {
    if (downloadToast?.blobUrl) URL.revokeObjectURL(downloadToast.blobUrl);
    setDownloadToast(null);
  };

  // Auto-dismiss the success toast after a few seconds, Amazon-style
  useEffect(() => {
    if (downloadToast?.status !== 'success') return;
    const t = setTimeout(() => {
      dismissDownloadToast();
    }, 6000);
    return () => {
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadToast?.status, downloadToast?.billNumber]);

     // Pre-fetch the PDF as soon as the invoice modal opens, so the WhatsApp
  // click can call navigator.share() immediately (it needs a live user gesture).
    useEffect(() => {
    if (!showInvoice || !lastBill) {
      waLinkRef.current = null;
      return;
    }
    const billNo = lastBill.billNumber;
    const state = { cancelled: false }; // ← CHANGED (was: let cancelled = false)
    setSharingWa(true);
    void (async () => {
      try {
        const res = await fetch(`${API}/bills/${billNo}/invoice-link`, { headers: hdr() });
        if (!res.ok) throw new Error();
        const { url } = (await res.json()) as { url: string };
        if (!state.cancelled) { // ← CHANGED (was: !cancelled)
          waLinkRef.current = { billNumber: billNo, url };
        }
      } catch {
        /* click handler falls back to text + download */
      } finally {
        setSharingWa(false);
      }
    })();
    return () => {
      state.cancelled = true; // ← CHANGED (was: cancelled = true)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInvoice, lastBill?.billNumber]);

  const whatsappInvoice = (b: SavedBill) => {
    const E = (cp: number) => String.fromCodePoint(cp); // safe emoji
    const lines = b.items.map((i) => `• ${i.serviceName} — ${fmtCur(i.price)}`).join('\n');
    const disc = b.membershipDiscount + b.discountAmount + b.loyaltyRedeemed;
    const couponLine = autoCoupon
      ? `\n${E(0x1f381)} You've earned ${autoCoupon.discountValue.toString()}% off your next visit! Use code *${autoCoupon.code}* before ${new Date(autoCoupon.expiryDate).toLocaleDateString('en-IN')}.\n`
      : '';
       const msg =
      `*Velvet Premium Unisex Salon*\nInvoice #${b.billNumber}\nDate: ${new Date(b.date ?? b.createdAt).toLocaleDateString('en-IN')}\n\n${lines}\n\n${disc > 0 ? `Discount: −${fmtCur(disc)}\n` : ''}*Total: ${fmtCur(b.total)}*\nPayment: ${b.paymentMethod.toUpperCase()}\n${couponLine}` +
      `\nThank you for visiting Velvet! We hope you loved your experience.\n` +
           `We'd love your feedback: ${FEEDBACK_URL}`;

       const cached = waLinkRef.current;
    const link = cached?.billNumber === b.billNumber ? cached.url : null;

    const finalMsg = link ? `${msg}\n\nDownload your invoice (PDF): ${link}` : msg;

    // Link kedaikkala na fallback: PDF download aagum, manual ah attach pannalam
    if (!link) void downloadInvoicePdf(b.billNumber);

    window.open(
      `https://api.whatsapp.com/send?phone=91${b.phone}&text=${encodeURIComponent(finalMsg)}`,
      '_blank',
    );
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const startEditBill = (bill: SavedBill) => {
    setEditingBillId(bill._id);
    setPhone(bill.phone);
    setItems(bill.items.map((i) => ({ ...i, _key: nk() })));
    setDiscountType('percent');
    setDiscountValue(0);
    setRedeemLoyalty(bill.loyaltyRedeemed > 0);
    setLoyaltyInput(bill.loyaltyRedeemed || 0);
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setPaymentMethod(bill.paymentMethod);
    setNotes(bill.notes);
    setApptDate(bill.date ?? null);
    setShowHistory(false);
  };

  const StockBadge = ({ name }: { name: string }) => {
    const info = stockMap.get(name.toLowerCase());
    if (!info || info.status === 'ok') return null;
    const cfg: Record<
      Exclude<StockInfo['status'], 'ok'>,
      { label: string; bg: string; color: string; border: string }
    > = {
      low: { label: 'Low', bg: '#fffbeb', color: '#b45309', border: '#fcd34d' },
      critical: { label: 'Critical', bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
      out: { label: 'Out', bg: '#fef2f2', color: '#7f1d1d', border: '#ef4444' },
    };
    const c = cfg[info.status];
    return (
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          padding: '1px 6px',
          borderRadius: 10,
          background: c.bg,
          color: c.color,
          border: `1px solid ${c.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        {c.label}
      </span>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
       .bl-page{display:flex;flex-direction:column;height:100%;width:100%;min-width:0;background:#f5f0e8;font-family:'Jost',sans-serif;color:#2c1f0e;overflow:hidden}
        .bl-topbar{height:60px;background:#fff;border-bottom:1px solid #ede5d6;display:flex;align-items:center;padding:0 28px;gap:14px;flex-shrink:0}
        .bl-page-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208}
        .bl-topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px}
        .bl-err{background:#fff5f5;border-bottom:1px solid #f5c6c6;padding:9px 28px;font-size:12px;color:#c0392b;display:flex;align-items:center;gap:8px;flex-shrink:0}
        .bl-err button{margin-left:auto;background:none;border:none;cursor:pointer;color:#c0392b;display:flex}
        .bl-stock-warn{background:#fffbeb;border-bottom:1px solid #fcd34d;padding:9px 28px;font-size:12px;color:#92400e;display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
        .bl-stock-warn-out{background:#fef2f2;border-bottom-color:#fca5a5;color:#7f1d1d}
        .bl-stock-tags{display:flex;gap:6px;flex-wrap:wrap;margin-left:4px}
        .bl-stock-tag{font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px;border:1px solid currentColor;opacity:.8}
                .bl-body{display:grid;grid-template-columns:1fr 360px;flex:1;overflow:hidden}
        .bl-left{overflow-y:auto;padding:22px 20px 22px 28px;display:flex;flex-direction:column;gap:16px;scrollbar-width:none;-ms-overflow-style:none}
        .bl-left::-webkit-scrollbar{display:none}
      .bl-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;overflow:hidden;min-width:0}
        .bl-ch{padding:14px 18px;border-bottom:1px solid #f0e8d8;display:flex;align-items:center;justify-content:space-between}
        .bl-ct{font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#8a7560;display:flex;align-items:center;gap:7px}
        .bl-cb{padding:16px 18px}
        .bl-btn{height:36px;padding:0 16px;border:none;border-radius:8px;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .18s}
        .bl-btn-primary{background:#1a1208;color:#d4af37}.bl-btn-primary:hover{background:#2d2010}.bl-btn-primary:disabled{opacity:.55;cursor:not-allowed}
        .bl-btn-secondary{background:#faf8f4;border:1px solid #ede5d6;color:#6b5740}.bl-btn-secondary:hover{border-color:#d4af37;background:#fffdf5}
        .bl-btn-wa{background:#25D366;color:#fff}.bl-btn-wa:hover{background:#1da854}
        .bl-btn-sm{height:30px;padding:0 12px;font-size:10px}
        .bl-btn-lg{height:46px;font-size:12px;letter-spacing:.17em;border-radius:10px;width:100%;justify-content:center}
        .bl-phone-wrap{position:relative}
        .bl-phone-ico{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#8a7560;pointer-events:none}
        .bl-phone-input{width:100%;height:44px;border:1.5px solid #e0d5c0;border-radius:10px;background:#faf8f4;padding:0 14px 0 40px;font-family:'Jost',sans-serif;font-size:16px;font-weight:300;color:#2c1f0e;outline:none;transition:border-color .2s,box-shadow .2s;letter-spacing:.04em}
        .bl-phone-input:focus{border-color:#d4af37;box-shadow:0 0 0 3px rgba(212,175,55,.12);background:#fff}
        .bl-phone-input::placeholder{color:#c5b89a}
        .bl-cust-found{display:flex;align-items:center;gap:14px;padding:13px 14px;background:#faf5e8;border:1px solid #e8d8a8;border-radius:10px;margin-top:12px;animation:bl-fadeIn .3s ease}
        .bl-cust-avatar{width:42px;height:42px;border-radius:50%;background:#b8860b;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Cormorant Garamond',serif;font-size:16px;flex-shrink:0}
        .bl-cust-name{font-size:14px;font-weight:500;color:#1a1208;line-height:1.2}
        .bl-cust-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:5px;align-items:center}
        .bl-cust-badge{font-size:10px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;padding:2px 9px;border-radius:20px}
        .bl-note-info{padding:10px 13px;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:7px;margin-top:12px}
        .bl-note-blue{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}
        .bl-note-gray{background:#f1f5f9;border:1px solid #e2e8f0;color:#475569}
        .bl-spinner-sm{width:14px;height:14px;border:2px solid rgba(212,175,55,.3);border-top-color:#d4af37;border-radius:50%;animation:bl-spin .7s linear infinite}
        .bl-svc-tbl{width:100%;border-collapse:collapse}
        .bl-svc-tbl th{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560;padding:0 0 10px;text-align:left}
        .bl-svc-tbl th.r,.bl-svc-tbl td.r{text-align:right}
        .bl-svc-tbl td{padding:10px 0;border-top:1px solid #f5f0e8;vertical-align:middle}
        .bl-svc-tbl tr:first-child td{border-top:none}
        .bl-svc-name{font-size:13px;color:#1a1208;line-height:1.2}
        .bl-svc-dur{font-size:10px;color:#c5b89a;margin-top:1px}
        .bl-consumable-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
        .bl-ctag{font-size:9px;font-weight:500;letter-spacing:.04em;padding:2px 7px;border-radius:20px;background:#f5f0e8;color:#8a7560;border:1px solid #e8dfc8;display:flex;align-items:center;gap:3px;white-space:nowrap}
        .bl-ctag-warn{background:#fffbeb;color:#b45309;border-color:#fcd34d}
        .bl-ctag-out{background:#fef2f2;color:#dc2626;border-color:#fca5a5}
        .bl-staff-info{display:flex;align-items:center;gap:5px;font-size:11px;color:#8a7560}
        .bl-sdot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
        .bl-price-inp{width:86px;height:32px;border:1px solid #e0d5c0;border-radius:6px;background:#faf8f4;padding:0 8px;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e;outline:none;text-align:right;transition:border-color .2s}
        .bl-price-inp:focus{border-color:#d4af37;background:#fff}
        .bl-rm-btn{width:26px;height:26px;border:1px solid #ede5d6;border-radius:6px;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#c5b89a;transition:all .15s;flex-shrink:0}
        .bl-rm-btn:hover{border-color:#e74c3c;color:#e74c3c;background:#fff5f5}
        .bl-add-svc-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px;border:1.5px dashed #d4af37;border-radius:10px;background:none;cursor:pointer;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#b8860b;transition:all .2s;margin-top:12px}
        .bl-add-svc-btn:hover{background:#fffdf5;border-color:#b8860b}
        .bl-consumables-panel{margin-top:12px;border:1px solid #ede5d6;border-radius:10px;overflow:hidden;animation:bl-fadeIn .25s ease}
        .bl-consumables-hd{padding:9px 14px;background:#faf8f4;border-bottom:1px solid #f0e8d8;font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#8a7560;display:flex;align-items:center;gap:6px}
        .bl-consumable-row{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #f5f0e8;font-size:12px}
        .bl-consumable-row:last-child{border-bottom:none}
        .bl-consumable-dot{width:6px;height:6px;border-radius:50%;background:#d4af37;flex-shrink:0}
        .bl-consumable-name{flex:1;color:#1a1208}
        .bl-consumable-qty{color:#8a7560;font-size:11px;white-space:nowrap}
        .bl-consumable-stock{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:500;white-space:nowrap}
        .bl-consumables-toggle{display:flex;align-items:center;gap:6px;margin-top:10px;padding:7px 10px;border:1px solid #ede5d6;border-radius:8px;background:#faf8f4;cursor:pointer;font-size:11px;color:#8a7560;font-weight:500;letter-spacing:.1em;text-transform:uppercase;transition:all .15s;width:100%;justify-content:center}
        .bl-consumables-toggle:hover{border-color:#d4af37;color:#b8860b;background:#fffdf5}
        /* Picker */
        .bl-picker{border:1px solid #ede5d6;border-radius:10px;overflow:hidden;margin-top:12px;animation:bl-fadeIn .25s ease}
        .bl-picker-search{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#faf8f4;border-bottom:1px solid #f0e8d8}
        .bl-picker-search input{flex:1;border:none;background:transparent;outline:none;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e}
        .bl-cat-tabs{display:flex;overflow-x:auto;border-bottom:1px solid #f0e8d8;background:#faf8f4;scrollbar-width:none}
        .bl-cat-tabs::-webkit-scrollbar{display:none}
        .bl-cat-tab{flex-shrink:0;padding:8px 12px;font-family:'Jost',sans-serif;font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#8a7560;background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;transition:all .18s;white-space:nowrap}
        .bl-cat-tab:hover{color:#b8860b}
        .bl-cat-tab.on{color:#b8860b;border-bottom-color:#d4af37;background:#fff}
.bl-picker-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:14px;max-height:260px;overflow-y:auto}      
 .bl-picker-item{padding:11px 8px;border:1px solid #ede5d6;border-radius:9px;cursor:pointer;text-align:center;transition:all .18s;min-width:0}
        .bl-picker-item:hover{border-color:#d4af37;background:#fffdf5}
        .bl-picker-item.sel{border-color:#d4af37;background:#fffdf5;box-shadow:inset 0 0 0 1px #d4af37}
       .bl-picker-pname{font-size:12px;color:#1a1208;line-height:1.2;overflow-wrap:break-word;word-break:break-word}
        .bl-picker-price{font-size:11px;color:#b8860b;margin-top:3px;font-weight:500}
        .bl-picker-dur{font-size:10px;color:#c5b89a;margin-top:1px}
        .bl-picker-confirm{display:flex;align-items:center;gap:10px;padding:12px 14px;border-top:1px solid #f0e8d8;background:#fffdf5}
        .bl-staff-sel{flex:1;height:34px;border:1px solid #e0d5c0;border-radius:7px;background:#fff;padding:0 28px 0 10px;font-family:'Jost',sans-serif;font-size:12px;color:#2c1f0e;outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 9px center}
        .bl-staff-sel:disabled{opacity:.6;cursor:not-allowed}
        .bl-disc-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .bl-disc-toggle{display:flex;border:1px solid #ede5d6;border-radius:8px;overflow:hidden}
        .bl-disc-opt{height:34px;padding:0 14px;border:none;background:#faf8f4;font-family:'Jost',sans-serif;font-size:12px;font-weight:500;color:#8a7560;cursor:pointer;transition:all .18s}
        .bl-disc-opt.on{background:#1a1208;color:#d4af37}
        .bl-disc-inp{height:34px;border:1px solid #e0d5c0;border-radius:8px;background:#faf8f4;padding:0 12px;font-family:'Jost',sans-serif;font-size:14px;font-weight:300;color:#2c1f0e;outline:none;width:100px;transition:border-color .2s}
        .bl-disc-inp:focus{border-color:#d4af37;background:#fff}
        .bl-loyalty-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #ede5d6;border-radius:10px;background:#faf8f4;cursor:pointer;transition:all .18s;user-select:none}
        .bl-loyalty-row.on{border-color:#d4af37;background:#fffdf5}
        .bl-tog{width:36px;height:20px;border-radius:20px;background:#e0d5c0;position:relative;transition:background .2s;flex-shrink:0}
        .bl-tog.on{background:#d4af37}
        .bl-tok{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,.18)}
        .bl-tog.on .bl-tok{transform:translateX(16px)}
        .bl-loy-inp{height:30px;border:1px solid #d4af37;border-radius:6px;background:#fff;padding:0 10px;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e;outline:none;width:88px;text-align:right}
        .bl-pay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .bl-pay-opt{padding:14px 8px;border:1.5px solid #ede5d6;border-radius:10px;cursor:pointer;text-align:center;transition:all .18s}
        .bl-pay-opt:hover{border-color:#d4af37;background:#fffdf5}
        .bl-pay-opt.on{border-color:#d4af37;background:#fffdf5;box-shadow:inset 0 0 0 1px #d4af37}
        .bl-pay-ico{display:flex;justify-content:center;margin-bottom:6px;color:#8a7560}
        .bl-pay-opt.on .bl-pay-ico{color:#b8860b}
        .bl-pay-lbl{font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#6b5740}
        .bl-pay-opt.on .bl-pay-lbl{color:#1a1208}
        .bl-notes-inp{width:100%;height:62px;border:1px solid #e0d5c0;border-radius:8px;background:#faf8f4;padding:10px 12px;font-family:'Jost',sans-serif;font-size:13px;font-weight:300;color:#2c1f0e;outline:none;resize:none;transition:border-color .2s}
        .bl-notes-inp:focus{border-color:#d4af37;background:#fff}
        .bl-notes-inp::placeholder{color:#c5b89a}
       .bl-right{background:#fff;border-left:1px solid #ede5d6;display:flex;flex-direction:column;overflow-y:auto}
        .bl-sum-hd{padding:18px 22px 14px;border-bottom:1px solid #f0e8d8;flex-shrink:0}
        .bl-sum-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208}
        .bl-sum-date{font-size:11px;color:#8a7560;margin-top:2px}
        .bl-sum-scroll{padding:18px 22px}
        .bl-sum-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:44px 20px;color:#c5b89a;gap:10px;text-align:center}
        .bl-sum-empty-lbl{font-size:13px;font-weight:300}
        .bl-sum-line{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px}
        .bl-sum-lbl{color:#6b5740}
        .bl-sum-val{color:#1a1208}
        .bl-sum-divider{height:1px;background:#f0e8d8;margin:7px 0}
        .bl-saving-line{color:#2e7d32 !important}
        .bl-total-row{display:flex;justify-content:space-between;align-items:baseline;padding:13px 0 0;border-top:2px solid #1a1208;margin-top:6px}
        .bl-total-lbl{font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#8a7560}
        .bl-total-val{font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:400;color:#1a1208}
        .bl-pay-info{display:flex;align-items:center;gap:8px;margin-top:12px;padding:9px 13px;background:#faf8f4;border-radius:8px;border:1px solid #f0e8d8;font-size:12px;color:#6b5740;font-weight:500;letter-spacing:.07em;text-transform:uppercase}
        .bl-earn-info{display:flex;align-items:center;gap:6px;margin-top:10px;padding:9px 13px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:11px;color:#15803d}
        .bl-inv-sum{margin-top:14px;border:1px solid #ede5d6;border-radius:10px;overflow:hidden}
        .bl-inv-sum-hd{padding:8px 13px;background:#faf8f4;border-bottom:1px solid #f0e8d8;font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#8a7560;display:flex;align-items:center;gap:6px}
        .bl-inv-sum-row{display:flex;align-items:center;gap:8px;padding:7px 13px;border-bottom:1px solid #f5f0e8;font-size:11px}
        .bl-inv-sum-row:last-child{border-bottom:none}
        .bl-inv-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
        .bl-hist-wrap{margin-top:18px;border-top:1px solid #f0e8d8;padding-top:14px}
        .bl-hist-hd{font-size:10px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#8a7560;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between}
        .bl-hist-hd button{background:none;border:none;cursor:pointer;color:#8a7560;display:flex;transition:color .15s}
        .bl-hist-hd button:hover{color:#b8860b}
        .bl-hist-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .15s;border:1px solid transparent}
        .bl-hist-item:hover{background:#faf8f4;border-color:#ede5d6}
        .bl-hist-name{font-size:12px;font-weight:400;color:#1a1208;line-height:1.2}
        .bl-hist-meta{font-size:10px;color:#8a7560;margin-top:1px}
        .bl-hist-amt{font-size:13px;font-weight:500;color:#b8860b;margin-left:auto;flex-shrink:0}
       .bl-sum-actions{padding:14px 22px 18px;border-top:1px solid #f0e8d8;flex-shrink:0;display:flex;flex-direction:column;gap:9px}
        .bl-pending-btn{height:38px;width:100%;border:1px solid #ede5d6;border-radius:8px;background:#faf8f4;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#6b5740;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .18s}
        .bl-pending-btn:hover{border-color:#d4af37;background:#fffdf5}
        .bl-pending-btn:disabled{opacity:.5;cursor:not-allowed}
        .bl-overlay{position:fixed;inset:0;background:rgba(26,18,8,.55);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;animation:bl-fadeIn .2s ease}
                .bl-modal{background:#fff;border-radius:16px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(26,18,8,.28);animation:bl-slideUp .3s ease;scrollbar-width:none;-ms-overflow-style:none}
        .bl-modal::-webkit-scrollbar{display:none}
        .bl-modal-hd{padding:22px 28px 14px;display:flex;align-items:flex-start;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1;border-bottom:1px solid #f0e8d8}
        .bl-modal-title{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:400;color:#1a1208}
        .bl-modal-sub{font-size:12px;color:#8a7560;margin-top:2px}
        .bl-modal-close{width:32px;height:32px;border:1px solid #ede5d6;border-radius:8px;background:#faf8f4;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b5740;transition:all .18s}
        .bl-modal-close:hover{border-color:#e74c3c;color:#e74c3c;background:#fff5f5}
        /* Referral reward banner */
        .bl-referral-banner{display:flex;align-items:center;gap:10px;margin:0 28px 16px;padding:12px 16px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;font-size:13px;color:#15803d;animation:bl-fadeIn .4s ease}
        .bl-referral-banner-icon{width:32px;height:32px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#15803d}
        .bl-referral-banner-title{font-weight:500;color:#14532d;font-size:13px}
        .bl-referral-banner-sub{font-size:11px;color:#16a34a;margin-top:1px}
        .bl-ded-wrap{margin:0 28px 18px;border:1px solid #ede5d6;border-radius:10px;overflow:hidden}
        .bl-ded-hd{padding:9px 14px;background:#faf8f4;border-bottom:1px solid #f0e8d8;font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#8a7560;display:flex;align-items:center;gap:6px}
        .bl-ded-row{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #f5f0e8;font-size:12px}
        .bl-ded-row:last-child{border-bottom:none}
        .bl-ded-icon{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px}
        .bl-ded-ok{background:#f0fdf4;color:#15803d}
        .bl-ded-skip{background:#fff5f5;color:#c0392b}
        .bl-ded-name{flex:1;color:#1a1208}
        .bl-ded-amt{font-size:11px;font-weight:500;color:#6b5740;white-space:nowrap}
        .bl-ded-reason{font-size:10px;color:#c5b89a;margin-top:1px}
        .inv-wrap{padding:28px 32px;font-family:'Jost',sans-serif;color:#2c1f0e}
        .inv-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:18px;border-bottom:2px solid #1a1208}
        .inv-salon{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:600;color:#1a1208;letter-spacing:.02em}
        .inv-tagline{font-size:10px;color:#8a7560;letter-spacing:.14em;text-transform:uppercase;margin-top:3px}
        .inv-num{font-family:'Cormorant Garamond',serif;font-size:18px;color:#1a1208;text-align:right}
        .inv-date{font-size:11px;color:#8a7560;margin-top:3px;text-align:right}
        .inv-cust{margin-bottom:18px;padding:13px 15px;background:#faf8f4;border-radius:8px;border:1px solid #f0e8d8}
        .inv-cust-lbl{font-size:9px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#8a7560;margin-bottom:5px}
        .inv-cust-name{font-size:14px;font-weight:500;color:#1a1208}
        .inv-cust-phone{font-size:12px;color:#6b5740;margin-top:2px}
        .inv-tbl{width:100%;border-collapse:collapse;margin-bottom:14px}
        .inv-tbl th{font-size:9px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560;padding:7px 0;border-bottom:1px solid #e0d5c0;text-align:left}
        .inv-tbl th:last-child,.inv-tbl td:last-child{text-align:right}
        .inv-tbl td{padding:9px 0;font-size:13px;border-bottom:1px solid #f5f0e8}
        .inv-totals{border-top:1px solid #e0d5c0;padding-top:11px}
        .inv-tr{display:flex;justify-content:space-between;font-size:13px;color:#6b5740;padding:3px 0}
        .inv-tr.save{color:#2e7d32}
        .inv-grand{display:flex;justify-content:space-between;align-items:baseline;padding:11px 0 0;border-top:2px solid #1a1208;margin-top:7px}
        .inv-grand-lbl{font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#8a7560}
        .inv-grand-val{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:400;color:#1a1208}
        .inv-paid-badge{display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:5px 14px;background:#eaf3de;border-radius:20px;font-size:11px;font-weight:500;color:#3b6d11;letter-spacing:.08em;text-transform:uppercase}
        .inv-footer{text-align:center;margin-top:22px;padding-top:14px;border-top:1px solid #f0e8d8;font-size:11px;color:#8a7560;letter-spacing:.07em}
        .bl-inv-actions{display:flex;gap:10px;padding:14px 28px 22px}
        .bl-spin{width:16px;height:16px;border:2px solid rgba(212,175,55,.3);border-top-color:#d4af37;border-radius:50%;animation:bl-spin .7s linear infinite;flex-shrink:0}
        @keyframes bl-fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes bl-slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bl-spin{to{transform:rotate(360deg)}}

        /* ═══════════════════════════════════════════════════════════
           RESPONSIVE — TABLET (≤ 968px)
           Stack the two-column layout, let the page scroll normally.
        ═══════════════════════════════════════════════════════════ */
       @media (max-width: 968px) {
         .bl-page{ height:auto; min-height:100vh; overflow-x:hidden; overflow-y:visible; width:100%; min-width:0; }
          .bl-body{
            grid-template-columns: 1fr;
           overflow-x:hidden;
   overflow-y:visible;
            height:auto;
            min-width:0;
          }
          .bl-left{
            overflow-y:visible;
   overflow-x:hidden;
   min-width:0;
            padding:16px 16px 8px;
          }
          .bl-right{
            border-left:none;
            border-top:1px solid #ede5d6;
            overflow:visible;
          }
          .bl-sum-scroll{ overflow-y:visible; max-height:none; }
                    .bl-sum-actions{
            position:sticky; bottom:0;
            background:#fff;
            box-shadow:0 -4px 12px rgba(26,18,8,.06);
            z-index:5;
          }
          .bl-topbar{ padding:0 16px; height:54px; }
          .bl-page-title{ font-size:19px; }
         .bl-picker-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
          .bl-cb{ overflow-x:auto; }
          .bl-svc-tbl{ min-width:480px; }
        }

        /* ═══════════════════════════════════════════════════════════
           RESPONSIVE — MOBILE (≤ 600px)
        ═══════════════════════════════════════════════════════════ */
        @media (max-width: 600px) {
          .bl-topbar{ padding:0 12px; flex-wrap:wrap; height:auto; min-height:54px; gap:8px; }
          .bl-topbar-right{ width:100%; margin-left:0; }
          .bl-topbar-right .bl-btn{ width:100%; justify-content:center; }

          .bl-err, .bl-stock-warn{ padding:9px 12px; }

          .bl-left{ padding:12px 12px 6px; gap:12px; }
          .bl-ch{ padding:12px 14px; }
          .bl-cb{ padding:12px 14px; }

          .bl-pay-grid{ grid-template-columns:repeat(3,1fr); gap:6px; }
          .bl-pay-opt{ padding:10px 4px; }
          .bl-pay-lbl{ font-size:9px; letter-spacing:.05em; }

         .bl-picker-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; padding:10px; max-height:220px; }
          .bl-picker-confirm{ flex-direction:column; align-items:stretch; }
          .bl-picker-confirm .bl-btn{ width:100%; justify-content:center; }

          .bl-disc-row{ flex-direction:column; align-items:stretch; }
          .bl-disc-inp{ width:100%; }
          .bl-disc-toggle{ width:100%; }
          .bl-disc-opt{ flex:1; }

          .bl-loyalty-row{ flex-wrap:wrap; }
          .bl-loy-inp{ width:100%; margin-top:8px; }

          .bl-sum-hd{ padding:14px 16px 10px; }
          .bl-sum-title{ font-size:19px; }
          .bl-sum-scroll{ padding:14px 16px; }
          .bl-total-val{ font-size:28px; }
          .bl-sum-actions{ padding:12px 16px 14px; }

          /* UPI QR panel */
          .bl-cb img[alt*="Scan"]{ width:220px !important; }

          /* Invoice modal */
          .bl-overlay{ padding:0; align-items:flex-end; }
          .bl-modal{
            max-width:100%;
            width:100%;
            border-radius:16px 16px 0 0;
            max-height:94vh;
          }
          .inv-wrap{ padding:18px 16px; }
          .inv-hd{ flex-direction:column; gap:10px; }
          .inv-num, .inv-date{ text-align:left; }
          .bl-inv-actions{ padding:12px 16px 16px; flex-direction:column; }
          .bl-referral-banner{ margin:0 16px 14px; }
          .bl-ded-wrap{ margin:0 16px 14px; }

          /* Services table → horizontal scroll instead of squeeze */
          .bl-svc-tbl{ min-width:420px; }
          .bl-price-inp{ width:70px; }
        }
      `}</style>

      <div className="bl-page">
        <header className="bl-topbar">
          <div className="bl-page-title">Billing</div>
          <div className="bl-topbar-right">
            <button
              className="bl-btn bl-btn-secondary bl-btn-sm"
              onClick={() => {
                void handleExportClick();
              }}
              disabled={exporting}
              title="Download all bills as Excel"
            >
              {exporting ? (
                'Exporting…'
              ) : (
                <>
                  <Ic n="receipt" s={13} /> Export Excel
                </>
              )}
            </button>
            <button
              className="bl-btn bl-btn-secondary bl-btn-sm"
              onClick={() => {
                setShowHistory((h) => !h);
                if (!showHistory) void fetchRecent();
              }}
            >
              <Ic n="history" s={13} /> {showHistory ? 'Hide History' : 'Recent Bills'}
            </button>
          </div>
        </header>

        {apiError && (
          <div className="bl-err">
            ⚠ {apiError}
            <button
              onClick={() => {
                setApiError('');
              }}
            >
              <Ic n="x" s={14} />
            </button>
          </div>
        )}

        {staffError && (
          <div className="bl-err">
            ⚠ {staffError} — staff list could not be loaded.
            <button
              onClick={() => {
                setApiError('');
              }}
            >
              <Ic n="x" s={14} />
            </button>
          </div>
        )}

        {stockWarnings.length > 0 && (
          <div className={`bl-stock-warn${hasOutOfStock ? ' bl-stock-warn-out' : ''}`}>
            <Ic n="alert" s={14} />
            <span style={{ fontWeight: 500 }}>
              {hasOutOfStock ? 'Out of stock —' : 'Low stock —'}
            </span>{' '}
            some products needed for this bill have insufficient stock:
            <div className="bl-stock-tags">
              {stockWarnings.map((w) => (
                <span key={w.name} className="bl-stock-tag">
                  {w.name} ({w.info.currentStock} {w.info.unit} available, need {w.needed})
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bl-body">
          <div className="bl-left">
            {/* 1 · Customer */}
            <div className="bl-card">
              <div className="bl-ch">
                <div className="bl-ct">
                  <Ic n="user" s={13} />
                  Customer
                </div>
                {lookupLoading && <div className="bl-spinner-sm" />}
              </div>
              <div className="bl-cb">
                <div className="bl-phone-wrap">
                  <span className="bl-phone-ico">
                    <Ic n="phone" s={15} />
                  </span>
                  <input
                    className="bl-phone-input"
                    placeholder="Enter mobile number…"
                    value={phone}
                    maxLength={10}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, ''));
                    }}
                  />
                </div>
                                {lookupState === 'found' && customer && (
                  <div className="bl-cust-found">
                    <div className="bl-cust-avatar">{initials(customer.name)}</div>
                    <div style={{ flex: 1 }}>
                      <div className="bl-cust-name">{customer.name}</div>
                      <div className="bl-cust-meta">
                        {customer.membershipTier !== 'none' && (
                          <span
                            className="bl-cust-badge"
                            style={{
                              background: MEMBERSHIP_CFG[customer.membershipTier].bg,
                              color: MEMBERSHIP_CFG[customer.membershipTier].color,
                            }}
                          >
                            ◆ {MEMBERSHIP_CFG[customer.membershipTier].label} · {membershipPct}% off
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            color: '#8a7560',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Ic n="star" s={10} />⭑ {customer.loyaltyPoints.toLocaleString()} pts ·{' '}
                          {customer.visitCount} visits
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                               {lookupState === 'found' && customer && (isCustomerBirthdayToday || isCustomerAnniversaryToday) && (
                  <div
                    className="bl-note-info"
                    style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', color: '#9d174d' }}
                  >
                    <Ic n="gift" s={14} />
                    {isCustomerBirthdayToday && isCustomerAnniversaryToday
                      ? "It's their birthday and anniversary today — remember to offer the birthday/anniversary discount!"
                      : isCustomerBirthdayToday
                        ? "It's their birthday today — remember to offer the birthday discount!"
                        : "It's their anniversary today — remember to offer the anniversary discount!"}
                  </div>
                )}
                               {/* ← REPLACED BLOCK: one toggle per pending referral instead of a static note */}
                {lookupState === 'found' &&
                  customer &&
                  (customer.referrals?.filter((r) => r.status === 'pending').length ?? 0) > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {customer.referrals
                        ?.filter((r) => r.status === 'pending')
                        .map((r) => {
                          const isOn = selectedReferralIds.includes(r._id);
                          return (
                            <div
                              key={r._id}
                              className={`bl-loyalty-row${isOn ? ' on' : ''}`}
                              onClick={() => {
                                setSelectedReferralIds((prev) =>
                                  prev.includes(r._id)
                                    ? prev.filter((id) => id !== r._id)
                                    : [...prev, r._id],
                                );
                              }}
                            >
                              <div className={`bl-tog${isOn ? ' on' : ''}`}>
                                <div className="bl-tok" />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, color: '#1a1208' }}>
                                  Referred: {r.referredName} ({r.referredPhone})
                                </div>
                                <div style={{ fontSize: 11, color: '#8a7560', marginTop: 2 }}>
                                  ₹{r.reward} reward pending —{' '}
                                  {isOn ? 'will be marked converted on this bill' : 'toggle to use this referral'}
                                </div>
                              </div>
                              <Ic n="gift" s={14} />
                            </div>
                          );
                        })}
                    </div>
                  )}
                {lookupState === 'new' && (
                  <div className="bl-note-info bl-note-blue">
                    <Ic n="info" s={14} />
                    New customer — a profile will be created when the bill is generated.
                  </div>
                )}
                {lookupState === 'error' && (
                  <div className="bl-note-info bl-note-gray">
                    <Ic n="info" s={14} />
                    Could not fetch customer info. Proceeding as walk-in.
                  </div>
                )}
              </div>
            </div>

            {/* 2 · Services */}
            <div className="bl-card">
              <div className="bl-ch">
                <div className="bl-ct">
                  <Ic n="scissors" s={13} />
                  Services
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {stockLoading && <div className="bl-spinner-sm" />}
                  <span style={{ fontSize: 11, color: '#8a7560' }}>
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="bl-cb">
                {items.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '18px 0',
                      color: '#c5b89a',
                      fontSize: 13,
                      fontWeight: 300,
                    }}
                  >
                    No services added yet
                  </div>
                ) : (
                  <table className="bl-svc-tbl">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Staff</th>
                        <th className="r">Price (₹)</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const stf = staffById.get(item.staffId);
                        const consumables = (SERVICE_INVENTORY_MAP[item.serviceId] ?? []) as {
                          productName: string;
                          quantity: number;
                          unit: string;
                        }[];
                        return (
                          <tr key={item._key}>
                            <td>
                              <div className="bl-svc-name">{item.serviceName}</div>
                              <div className="bl-svc-dur">{item.duration} min</div>
                              {consumables.length > 0 && (
                                <div className="bl-consumable-tags">
                                  {consumables.map((c) => {
                                    const info = stockMap.get(c.productName.toLowerCase());
                                    const tagClass = !info
                                      ? 'bl-ctag'
                                      : info.status === 'out'
                                        ? 'bl-ctag bl-ctag-out'
                                        : info.status === 'critical' || info.status === 'low'
                                          ? 'bl-ctag bl-ctag-warn'
                                          : 'bl-ctag';
                                    return (
                                      <span key={c.productName} className={tagClass}>
                                        <Ic n="box" s={8} />
                                        {c.quantity}
                                        {c.unit} {c.productName.split(' ').slice(0, 2).join(' ')}
                                        {info && info.status !== 'ok' && (
                                          <span style={{ marginLeft: 2, opacity: 0.7 }}>
                                            ({info.currentStock}
                                            {c.unit})
                                          </span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="bl-staff-info">
                                {stf && (
                                  <span
                                    className="bl-sdot"
                                    style={{ background: staffAvatarColor(stf.name) }}
                                  />
                                )}
                                {stf?.name ?? '—'}
                              </div>
                            </td>
                            <td className="r">
                              <input
                                className="bl-price-inp"
                                type="number"
                                min={0}
                                value={item.price}
                                onChange={(e) => {
                                  updatePrice(item._key, Number(e.target.value));
                                }}
                              />
                            </td>
                            <td style={{ paddingLeft: 8 }}>
                              <button
                                className="bl-rm-btn"
                                onClick={() => {
                                  removeItem(item._key);
                                }}
                              >
                                <Ic n="trash" s={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {items.length > 0 && aggregatedConsumables.size > 0 && (
                  <button
                    className="bl-consumables-toggle"
                    onClick={() => {
                      setShowConsumables((o) => !o);
                    }}
                  >
                    <Ic n="box" s={12} />
                    {showConsumables ? 'Hide' : 'Show'} Inventory Impact
                    {stockWarnings.length > 0 && (
                      <span
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          borderRadius: 10,
                          fontSize: 9,
                          fontWeight: 600,
                          padding: '1px 6px',
                          marginLeft: 4,
                        }}
                      >
                        {stockWarnings.length} alert{stockWarnings.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                )}

                {showConsumables && aggregatedConsumables.size > 0 && (
                  <div className="bl-consumables-panel">
                    <div className="bl-consumables-hd">
                      <Ic n="box" s={11} />
                      Products to be deducted
                    </div>
                    {Array.from(aggregatedConsumables.entries()).map(
                      ([name, { quantity, unit }]) => {
                        const info = stockMap.get(name.toLowerCase());
                        const statusCfg = {
                          ok: { bg: '#f0fdf4', color: '#15803d', label: 'In Stock' },
                          low: { bg: '#fffbeb', color: '#b45309', label: 'Low' },
                          critical: { bg: '#fef2f2', color: '#dc2626', label: 'Critical' },
                          out: { bg: '#fef2f2', color: '#7f1d1d', label: 'Out of Stock' },
                        };
                        const sc = info ? statusCfg[info.status] : null;
                        return (
                          <div key={name} className="bl-consumable-row">
                            <div className="bl-consumable-dot" />
                            <div className="bl-consumable-name">{name}</div>
                            <div className="bl-consumable-qty">
                              −{quantity} {unit}
                              {info && (
                                <span style={{ color: '#c5b89a', marginLeft: 4 }}>
                                  ({info.currentStock} in stock)
                                </span>
                              )}
                            </div>
                            {sc && (
                              <span
                                className="bl-consumable-stock"
                                style={{ background: sc.bg, color: sc.color }}
                              >
                                {sc.label}
                              </span>
                            )}
                            {!info && !stockLoading && (
                              <span
                                className="bl-consumable-stock"
                                style={{ background: '#f1f5f9', color: '#64748b' }}
                              >
                                Not tracked
                              </span>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                )}

                <button
                  className="bl-add-svc-btn"
                  onClick={() => {
                    setPickerOpen((o) => !o);
                  }}
                >
                  <Ic n="plus" s={14} />
                  {pickerOpen ? 'Close Picker' : 'Add Service'}
                </button>

                {pickerOpen && (
                  <ServicePicker
                    staffOptions={bookableStaff}
                    staffLoading={staffLoading}
                    onAdd={(svc, staffId) => {
                      addItem(svc, staffId);
                    }}
                  />
                )}
              </div>
            </div>

            {/* 3 · Discounts */}
            <div className="bl-card">
              <div className="bl-ch">
                <div className="bl-ct">
                  <Ic n="tag" s={13} />
                  Discounts
                </div>
              </div>
              <div className="bl-cb" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {customer && customer.membershipTier !== 'none' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 13px',
                      background: MEMBERSHIP_CFG[customer.membershipTier].bg,
                      border: `1px solid ${MEMBERSHIP_CFG[customer.membershipTier].color}40`,
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Ic n="award" s={13} />
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: MEMBERSHIP_CFG[customer.membershipTier].color,
                          }}
                        >
                          {MEMBERSHIP_CFG[customer.membershipTier].label} — {membershipPct}% off
                        </div>
                        <div style={{ fontSize: 11, color: '#8a7560' }}>
                          Auto-applied on subtotal
                        </div>
                      </div>
                    </div>
                    {membershipDisc > 0 && (
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#2e7d32' }}>
                        −{fmtCur(membershipDisc)}
                      </span>
                    )}
                  </div>
                )}
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: '#8a7560',
                      marginBottom: 8,
                    }}
                  >
                    Manual Discount
                  </div>
                  <div className="bl-disc-row">
                    <div className="bl-disc-toggle">
                      <button
                        className={`bl-disc-opt${discountType === 'percent' ? ' on' : ''}`}
                        onClick={() => {
                          setDiscountType('percent');
                        }}
                      >
                        %
                      </button>
                      <button
                        className={`bl-disc-opt${discountType === 'flat' ? ' on' : ''}`}
                        onClick={() => {
                          setDiscountType('flat');
                        }}
                      >
                        ₹ Flat
                      </button>
                    </div>
                    <input
                      className="bl-disc-inp"
                      type="number"
                      min={0}
                      max={discountType === 'percent' ? 100 : undefined}
                      placeholder={discountType === 'percent' ? '0 %' : '0'}
                      value={discountValue === 0 ? '' : discountValue}
                      onChange={(e) => {
                        setDiscountValue(e.target.value === '' ? '' : Number(e.target.value));
                      }}
                    />
                    {manualDisc > 0 && (
                      <span style={{ fontSize: 13, color: '#2e7d32', fontWeight: 500 }}>
                        = −{fmtCur(manualDisc)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: '#8a7560',
                      marginBottom: 8,
                    }}
                  >
                    Coupon Code
                  </div>
                  {appliedCoupon ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 13px',
                        background: '#f0fdf4',
                        border: '1px solid #86efac',
                        borderRadius: 10,
                      }}
                    >
                      <Ic n="tag" s={14} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#14532d' }}>
                          {appliedCoupon.code}
                        </div>
                        <div style={{ fontSize: 11, color: '#16a34a' }}>
                          {appliedCoupon.discountType === 'percent'
                            ? `${appliedCoupon.discountValue.toString()}% off`
                            : `₹${appliedCoupon.discountValue.toString()} off`}
                          {appliedCoupon.description ? ` · ${appliedCoupon.description}` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#2e7d32' }}>
                        −{fmtCur(appliedCoupon.discountAmount)}
                      </span>
                      <button className="bl-rm-btn" onClick={removeCoupon}>
                        <Ic n="x" s={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="bl-disc-row">
                      <input
                        className="bl-disc-inp"
                        style={{ width: 160, textTransform: 'uppercase' }}
                        placeholder="Enter code"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void applyCoupon(couponCode);
                        }}
                      />
                      <button
                        className="bl-btn bl-btn-secondary bl-btn-sm"
                        disabled={couponLoading || !couponCode.trim()}
                        onClick={() => {
                          void applyCoupon(couponCode);
                        }}
                      >
                        {couponLoading ? 'Checking…' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <div style={{ fontSize: 11, color: '#c0392b', marginTop: 6 }}>
                      {couponError}
                    </div>
                  )}
                </div>
                {customer && customer.loyaltyPoints > 0 && (
                  <div
                    className={`bl-loyalty-row${redeemLoyalty ? ' on' : ''}`}
                    onClick={() => {
                      setRedeemLoyalty((r) => !r);
                    }}
                  >
                    <div className={`bl-tog${redeemLoyalty ? ' on' : ''}`}>
                      <div className="bl-tok" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#1a1208' }}>Redeem Loyalty Points</div>
                      <div style={{ fontSize: 11, color: '#8a7560', marginTop: 2 }}>
                        {customer.loyaltyPoints.toLocaleString()} pts available · max{' '}
                        {fmtCur(maxLoyalty)} redeemable
                      </div>
                    </div>
                    {redeemLoyalty && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <input
                          className="bl-loy-inp"
                          type="number"
                          min={10}
                          max={maxLoyalty}
                          step={10}
                          placeholder="pts"
                          value={loyaltyInput === 0 ? '' : loyaltyInput}
                          onChange={(e) => {
                            setLoyaltyInput(e.target.value === '' ? '' : Number(e.target.value));
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 4 · Payment */}
            <div className="bl-card">
              <div className="bl-ch">
                <div className="bl-ct">
                  <Ic n="card" s={13} />
                  Payment Method
                </div>
              </div>
              <div className="bl-cb">
                <div className="bl-pay-grid">
                  {(['cash', 'card', 'upi'] as PaymentMethod[]).map((m) => (
                    <div
                      key={m}
                      className={`bl-pay-opt${paymentMethod === m ? ' on' : ''}`}
                      onClick={() => {
                        setPaymentMethod(m);
                      }}
                    >
                      <div className="bl-pay-ico">
                        <Ic n={m === 'cash' ? 'cash' : m === 'card' ? 'card' : 'upi'} s={22} />
                      </div>
                      <div className="bl-pay-lbl">
                        {m === 'upi' ? 'UPI' : m.charAt(0).toUpperCase() + m.slice(1)}
                      </div>
                    </div>
                  ))}
                </div>
                {paymentMethod === 'upi' && (
                  <div
                    style={{
                      marginTop: 18,
                      padding: '24px',
                      borderRadius: 16,
                      background: '#fffdf5',
                      border: '1px solid #e8d8a8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                      animation: 'bl-fadeIn .25s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '.16em',
                        textTransform: 'uppercase',
                        color: '#b8860b',
                      }}
                    >
                      <Ic n="upi" s={15} />
                      Scan &amp; Pay
                    </div>
                    {total > 0 ? (
                      <img
                        src={buildUpiQrSrc(
                          total,
                          `Invoice ${editingBillId ? 'update' : 'payment'} - Velvet Salon`,
                        )}
                        alt={`Scan & Pay ₹${total.toString()} via UPI`}
                        style={{ width: 320, maxWidth: '100%', height: 'auto', display: 'block' }}
                      />
                    ) : (
                      <div style={{ fontSize: 12, color: '#8a7560', padding: '40px 0' }}>
                        Add a service to generate the payment QR
                      </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#6b5740', fontWeight: 500 }}>
                        Pay securely with Paytm / UPI
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#8a7560',
                          marginTop: 2,
                          letterSpacing: '.03em',
                        }}
                      >
                        {UPI_ID} · {total > 0 ? fmtCur(total) : '—'}
                      </div>
                    </div>
                    {total > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setUpiPaymentConfirmed((c) => !c);
                        }}
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '9px 16px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          fontFamily: "'Jost',sans-serif",
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          border: upiPaymentConfirmed ? '1px solid #86efac' : '1px solid #e0d5c0',
                          background: upiPaymentConfirmed ? '#f0fdf4' : '#fff',
                          color: upiPaymentConfirmed ? '#15803d' : '#6b5740',
                          transition: 'all .18s',
                        }}
                      >
                        <Ic n="check" s={13} />
                        {upiPaymentConfirmed ? 'Payment Confirmed' : 'Mark Payment Received'}
                      </button>
                    )}
                    {!upiPaymentConfirmed && total > 0 && (
                      <div style={{ fontSize: 10, color: '#b45309', textAlign: 'center' }}>
                        Confirm the payment has landed in your account before generating the bill.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 5 · Notes */}
            <div className="bl-card">
              <div className="bl-ch">
                <div className="bl-ct">
                  <Ic n="receipt" s={13} />
                  Notes (optional)
                </div>
              </div>
              <div className="bl-cb">
                <textarea
                  className="bl-notes-inp"
                  placeholder="Special notes, remarks for this bill…"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>

          {/* RIGHT — Summary */}
                    <div className="bl-right">
            <div className="bl-sum-hd">
              <div className="bl-sum-title">Bill Summary</div>
              <div className="bl-sum-date">
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
                        </div>

            <div className="bl-sum-scroll">
              {items.length === 0 ? (
                <div className="bl-sum-empty">
                  <Ic n="receipt" s={38} />
                  <div className="bl-sum-empty-lbl">Add services to generate a bill</div>
                </div>
              ) : (
                <>
                  {items.map((item) => (
                    <div key={item._key} className="bl-sum-line">
                      <span className="bl-sum-lbl">{item.serviceName}</span>
                      <span className="bl-sum-val">{fmtCur(item.price)}</span>
                    </div>
                  ))}
                  <div className="bl-sum-divider" />
                  <div className="bl-sum-line">
                    <span className="bl-sum-lbl">Subtotal</span>
                    <span className="bl-sum-val">{fmtCur(subtotal)}</span>
                  </div>
                  {membershipDisc > 0 && (
                    <div className="bl-sum-line bl-saving-line">
                      <span>Membership ({membershipPct}%)</span>
                      <span>−{fmtCur(membershipDisc)}</span>
                    </div>
                  )}
                  {manualDisc > 0 && (
                    <div className="bl-sum-line bl-saving-line">
                      <span>Manual Discount</span>
                      <span>−{fmtCur(manualDisc)}</span>
                    </div>
                  )}
                  {couponDisc > 0 && (
                    <div className="bl-sum-line bl-saving-line">
                      <span>Coupon ({appliedCoupon?.code})</span>
                      <span>−{fmtCur(couponDisc)}</span>
                    </div>
                  )}
                                    {loyaltyDisc > 0 && (
                    <div className="bl-sum-line bl-saving-line">
                      <span>Loyalty Points</span>
                      <span>−{fmtCur(loyaltyDisc)}</span>
                    </div>
                  )}
                  {/* ← ADD THIS BLOCK: shows the referral reward as a line-item discount */}
                  {referralDisc > 0 && (
                    <div className="bl-sum-line bl-saving-line">
                      <span>Referral Reward</span>
                      <span>−{fmtCur(referralDisc)}</span>
                    </div>
                  )}
                  {totalSavings > 0 && (
                    <>
                      <div className="bl-sum-divider" />
                      <div className="bl-sum-line" style={{ color: '#2e7d32', fontWeight: 500 }}>
                        <span>Total Savings</span>
                        <span>−{fmtCur(totalSavings)}</span>
                      </div>
                    </>
                  )}
                  <div className="bl-total-row">
                    <span className="bl-total-lbl">Total Due</span>
                    <span className="bl-total-val">{fmtCur(total)}</span>
                  </div>
                  <div className="bl-pay-info">
                    <Ic
                      n={
                        paymentMethod === 'cash'
                          ? 'cash'
                          : paymentMethod === 'card'
                            ? 'card'
                            : 'upi'
                      }
                      s={14}
                    />
                    {paymentMethod === 'upi'
                      ? 'UPI'
                      : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}
                  </div>
                                    {customer && (
                    <div className="bl-earn-info">
                      <Ic n="gift" s={12} />
                      Will earn ~{Math.floor(total / 100)} loyalty pts on this bill
                    </div>
                  )}
                                   {/* ← ADD THIS BLOCK: confirms which referral(s) will be redeemed on this bill */}
                  {selectedReferralIds.length > 0 && customer && (
                    <div
                      className="bl-earn-info"
                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}
                    >
                      <Ic n="gift" s={12} />
                      {selectedReferralIds.length} referral
                      {selectedReferralIds.length > 1 ? 's' : ''} applied — ₹{referralDisc} discount
                      on this bill, and marked converted on save
                    </div>
                  )}
                  {aggregatedConsumables.size > 0 && (
                    <div className="bl-inv-sum">
                      <div className="bl-inv-sum-hd">
                        <Ic n="box" s={11} />
                        Inventory deduction
                        {stockLoading && (
                          <div className="bl-spinner-sm" style={{ marginLeft: 'auto' }} />
                        )}
                      </div>
                      {Array.from(aggregatedConsumables.entries()).map(
                        ([name, { quantity, unit }]) => {
                          const info = stockMap.get(name.toLowerCase());
                          const dotColor = !info
                            ? '#c5b89a'
                            : info.status === 'ok'
                              ? '#15803d'
                              : info.status === 'out'
                                ? '#dc2626'
                                : '#b45309';
                          return (
                            <div key={name} className="bl-inv-sum-row">
                              <div className="bl-inv-dot" style={{ background: dotColor }} />
                              <span style={{ flex: 1, color: '#1a1208', fontSize: 11 }}>
                                {name.split(' ').slice(0, 3).join(' ')}
                              </span>
                              <span
                                style={{ color: '#8a7560', fontSize: 10, whiteSpace: 'nowrap' }}
                              >
                                −{quantity} {unit}
                              </span>
                              {info && <StockBadge name={name} />}
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </>
              )}

              {showHistory && (
                <div className="bl-hist-wrap">
                  <div className="bl-hist-hd">
                    <span>
                      <Ic n="history" s={11} />
                      &nbsp;Recent Bills
                    </span>
                    <button
                      onClick={() => {
                        void fetchRecent();
                      }}
                      title="Refresh"
                    >
                      <Ic n="refresh" s={12} />
                    </button>
                  </div>
                  {histLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 14 }}>
                      <div className="bl-spin" />
                    </div>
                  ) : recentBills.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#c5b89a', padding: '6px 0' }}>
                      No recent bills
                    </div>
                  ) : (
                    recentBills.map((b) => (
                      <div key={b._id} className="bl-hist-item">
                        <div
                          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                          onClick={() => {
                            setLastBill(b);
                            setDeductionResults([]);
                            setShowInvoice(true);
                          }}
                        >
                          <div className="bl-hist-name">{b.customer?.name ?? 'Walk-in'}</div>
                          <div className="bl-hist-meta">
                            #{b.billNumber} · {new Date(b.createdAt).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                        <span className="bl-hist-amt">{fmtCur(b.total)}</span>
                        <button
                          className="bl-rm-btn"
                          title="Edit bill"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditBill(b);
                          }}
                        >
                          <Ic n="receipt" s={12} />
                        </button>
                        <button
                          className="bl-rm-btn"
                          title="Download invoice PDF"
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadInvoicePdf(b.billNumber);
                          }}
                          disabled={downloadingInvoiceId === b.billNumber}
                        >
                          {downloadingInvoiceId === b.billNumber ? (
                            <div className="bl-spinner-sm" />
                          ) : (
                            <Ic n="print" s={12} />
                          )}
                        </button>
                        <div
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setLastBill(b);
                            setDeductionResults([]);
                            setShowInvoice(true);
                          }}
                        >
                          <Ic n="eye" s={12} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                          )}
            </div>

            <div className="bl-sum-actions">
              <button
                className="bl-btn bl-btn-primary bl-btn-lg"
                onClick={() => {
                  void saveBill('paid');
                }}
                disabled={
                  saving || items.length === 0 || (paymentMethod === 'upi' && !upiPaymentConfirmed)
                }
              >
                {saving ? (
                  <>
                    <div className="bl-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Ic n="check" s={14} />
                    Generate Bill &amp; Mark Paid
                  </>
                )}
              </button>
              <button
                className="bl-pending-btn"
                onClick={() => {
                  void saveBill('pending');
                }}
                disabled={saving || items.length === 0}
              >
                <Ic n="receipt" s={13} />
                Save as Pending
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Invoice Modal */}
      {showInvoice && lastBill && (
               <div
          className="bl-overlay"
          onClick={() => {
            setShowInvoice(false);
            setReferralReward(null);
            setAutoCoupon(null);
            setInvoiceOccasion(null);
          }}
        >
          <div
            className="bl-modal"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="bl-modal-hd">
              <div>
                <div className="bl-modal-title">Invoice</div>
                <div className="bl-modal-sub">#{lastBill.billNumber}</div>
              </div>
                           <button
                className="bl-modal-close"
                onClick={() => {
                  setShowInvoice(false);
                  setReferralReward(null);
                  setAutoCoupon(null);
                  setInvoiceOccasion(null);
                }}
              >
                <Ic n="x" s={14} />
              </button>
            </div>

            <div ref={invoiceRef}>
              <div className="inv-wrap">
                <div className="inv-hd">
                  <div>
                    <div className="inv-salon">Velvet Premium Unisex Salon</div>
                    <div className="inv-tagline">Premium Beauty &amp; Wellness</div>
                  </div>
                  <div>
                    <div className="inv-num">#{lastBill.billNumber}</div>
                    <div className="inv-date">
                      {new Date(lastBill.date ?? lastBill.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>{' '}
                  </div>
                </div>
                               <div className="inv-cust">
                  <div className="inv-cust-lbl">Bill To</div>
                  <div className="inv-cust-name">
                    {lastBill.customer?.name ?? 'Walk-in Customer'}
                  </div>
                  <div className="inv-cust-phone">{lastBill.phone}</div>
                </div>
                {invoiceOccasion && (
                  <div
                    style={{
                      marginBottom: 18,
                      padding: '10px 15px',
                      background: '#fdf2f8',
                      border: '1px solid #fbcfe8',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#9d174d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Ic n="gift" s={14} />
                    {invoiceOccasion.birthday && invoiceOccasion.anniversary
                      ? "Customer's birthday & anniversary today!"
                      : invoiceOccasion.birthday
                        ? "Customer's birthday today!"
                        : "Customer's anniversary today!"}
                  </div>
                )}
                <table className="inv-tbl">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Staff</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastBill.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.serviceName}</td>
                        <td style={{ color: '#6b5740' }}>{staffName(item.staffId)}</td>
                        <td>{fmtCur(item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="inv-totals">
                  <div className="inv-tr">
                    <span>Subtotal</span>
                    <span>{fmtCur(lastBill.subtotal)}</span>
                  </div>
                  {lastBill.membershipDiscount > 0 && (
                    <div className="inv-tr save">
                      <span>Membership Discount</span>
                      <span>−{fmtCur(lastBill.membershipDiscount)}</span>
                    </div>
                  )}
                  {lastBill.discountAmount > 0 && (
                    <div className="inv-tr save">
                      <span>Discount</span>
                      <span>−{fmtCur(lastBill.discountAmount)}</span>
                    </div>
                  )}
                                    {lastBill.loyaltyRedeemed > 0 && (
                    <div className="inv-tr save">
                      <span>Loyalty Redeemed</span>
                      <span>−{fmtCur(lastBill.loyaltyRedeemed)}</span>
                    </div>
                  )}
                  {(lastBill.referralDiscount ?? 0) > 0 && (
                    <div className="inv-tr save">
                      <span>Referral Reward</span>
                      <span>−{fmtCur(lastBill.referralDiscount ?? 0)}</span>
                    </div>
                  )}
                  <div className="inv-grand">
                    <span className="inv-grand-lbl">Total</span>
                    <span className="inv-grand-val">{fmtCur(lastBill.total)}</span>
                  </div>
                  <div className="inv-paid-badge">
                    <Ic n="check" s={11} />
                    Paid via {lastBill.paymentMethod.toUpperCase()}
                  </div>
                  {lastBill.notes && (
                    <div
                      style={{ marginTop: 11, fontSize: 12, color: '#6b5740', fontStyle: 'italic' }}
                    >
                      Note: {lastBill.notes}
                    </div>
                  )}
                </div>
                <div className="inv-footer">
                  Thank you for visiting Velvet! ✦ We look forward to seeing you again.
                </div>
              </div>
            </div>

            {/* ── Referral reward banner — shown after the invoice content, before deductions ── */}
            {referralReward?.rewarded && (
              <div className="bl-referral-banner">
                <div className="bl-referral-banner-icon">
                  <Ic n="gift" s={16} />
                </div>
                <div>
                  <div className="bl-referral-banner-title">Referral reward credited!</div>
                  <div className="bl-referral-banner-sub">
                    {referralReward.referrerName
                      ? `${referralReward.referrerName} earned +100 loyalty points for referring this customer.`
                      : '+100 loyalty points credited to the referrer.'}
                  </div>
                </div>
              </div>
            )}

            {autoCoupon && (
              <div
                className="bl-referral-banner"
                style={{ background: '#fffdf5', border: '1px solid #e8d8a8' }}
              >
                <div
                  className="bl-referral-banner-icon"
                  style={{ background: '#faf0d0', color: '#b8860b' }}
                >
                  <Ic n="tag" s={16} />
                </div>
                <div>
                  <div className="bl-referral-banner-title" style={{ color: '#7a5c1e' }}>
                    Customer earned a reward coupon!
                  </div>
                  <div className="bl-referral-banner-sub" style={{ color: '#b8860b' }}>
                    Code <strong>{autoCoupon.code}</strong> — {autoCoupon.discountValue}% off their
                    next visit, valid until{' '}
                    {new Date(autoCoupon.expiryDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    .
                  </div>
                </div>
              </div>
            )}

            {deductionResults.length > 0 && (
              <div className="bl-ded-wrap">
                <div className="bl-ded-hd">
                  <Ic n="box" s={11} />
                  Inventory Deducted
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      color: '#8a7560',
                      textTransform: 'none',
                      letterSpacing: 0,
                    }}
                  >
                    {deductionResults.filter((r) => !r.skipped).length}/{deductionResults.length}{' '}
                    products updated
                  </span>
                </div>
                {deductionResults.map((r, i) => (
                  <div key={i} className="bl-ded-row">
                    <div className={`bl-ded-icon ${r.skipped ? 'bl-ded-skip' : 'bl-ded-ok'}`}>
                      {r.skipped ? <Ic n="alert" s={11} /> : <Ic n="check" s={11} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="bl-ded-name">{r.productName}</div>
                      {r.skipped && r.reason && <div className="bl-ded-reason">{r.reason}</div>}
                    </div>
                    <div className="bl-ded-amt">
                      {r.skipped ? (
                        <span style={{ color: '#c0392b' }}>Skipped</span>
                      ) : (
                        <span style={{ color: '#15803d' }}>−{r.deducted} deducted</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="bl-inv-actions">
              <button
                className="bl-btn bl-btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  void downloadInvoicePdf(lastBill.billNumber);
                }}
                disabled={downloadingInvoiceId === lastBill.billNumber}
              >
                {downloadingInvoiceId === lastBill.billNumber ? (
                  <>
                    <div className="bl-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Ic n="print" s={14} />
                    Download PDF
                  </>
                )}
              </button>
                           <button
                className="bl-btn bl-btn-wa"
                style={{ flex: 1 }}
                disabled={sharingWa}
                               onClick={() => {
                  whatsappInvoice(lastBill);
                }}
              >
                <Ic n="whatsapp" s={14} />
                {sharingWa ? 'Preparing…' : 'WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
       {/* Amazon-style download toast */}
      {downloadToast && (
        <div className="bl-toast" style={{ position:"fixed" }}>
          <div className={`bl-toast-icon ${downloadToast.status}`}>
            {downloadToast.status === "loading" && <div className="bl-spinner-sm" style={{ borderTopColor:"#b8860b" }}/>}
            {downloadToast.status === "success" && <Ic n="check" s={17}/>}
            {downloadToast.status === "error" && <Ic n="alert" s={17}/>}
          </div>
          <div className="bl-toast-body">
            <div className="bl-toast-title">
              {downloadToast.status === "loading" && "Preparing your invoice…"}
              {downloadToast.status === "success" && "Invoice downloaded"}
              {downloadToast.status === "error"   && "Couldn't download invoice"}
            </div>
            <div className="bl-toast-sub">#{downloadToast.billNumber}</div>
            {downloadToast.status === "success" && downloadToast.blobUrl && (
              <div className="bl-toast-actions">
                <button className="bl-toast-link" onClick={() => { window.open(downloadToast.blobUrl, "_blank"); }}>
                  View PDF
                </button>
                <button className="bl-toast-link" onClick={() => { void downloadInvoicePdf(downloadToast.billNumber); }}>
                  Download again
                </button>
              </div>
            )}
            {downloadToast.status === "error" && (
              <div className="bl-toast-actions">
                <button className="bl-toast-link" onClick={() => { void downloadInvoicePdf(downloadToast.billNumber); }}>
                  Try again
                </button>
              </div>
            )}
          </div>
          {downloadToast.status !== "loading" && (
            <button className="bl-toast-close" onClick={dismissDownloadToast}><Ic n="x" s={13}/></button>
          )}
          {downloadToast.status === "success" && <div className="bl-toast-bar"/>}
        </div>
      )}
    </>
  );
}

// ─── Service Picker with Category Tabs ──────────────────────────────────────
function ServicePicker({
  staffOptions,
  staffLoading,
  onAdd,
}: {
  staffOptions: StaffMember[];
  staffLoading: boolean;
  onAdd: (svc: ServiceCatalogue, staffId: string) => void;
}) {
  const [sel, setSel] = useState<ServiceCatalogue | null>(null);
  const [staff, setStaff] = useState('');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCat] = useState('All');
  // ← ADD: custom (non-catalogue) service entry state
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState<number | ''>('');

  const allCategories = ['All', ...SERVICE_CATEGORIES];

  const filtered = SERVICES_CAT.filter((s) => {
    const matchQ = s.name.toLowerCase().includes(query.toLowerCase());
    const matchC = activeCategory === 'All' || s.category === activeCategory;
    return matchQ && matchC;
  });

  // ← ADD: turns the typed name/price into a catalogue-shaped object so it
  // flows through the exact same staff-assign + onAdd path as a real service.
 const useCustomService = () => {
  if (!customName.trim() || !customPrice) return;
  setSel({
    id: `custom-${nk()}`,
    name: customName.trim(),
    price: customPrice,
    duration: 0,
    category: 'Custom',
  } as ServiceCatalogue);
};

  return (
    <div className="bl-picker">
      <div className="bl-picker-search">
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          placeholder="Search services…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
        {/* ← MOVED HERE: fixed position, never scrolls off-screen like a tab would */}
        <button
          type="button"
          onClick={() => {
            setCustomMode((m) => !m);
            setSel(null);
          }}
          style={{
            flexShrink: 0,
            height: 26,
            padding: '0 10px',
            borderRadius: 6,
            border: customMode ? '1px solid #d4af37' : '1px solid #e0d5c0',
            background: customMode ? '#fffdf5' : '#fff',
            color: customMode ? '#b8860b' : '#6b5740',
            fontFamily: "'Jost',sans-serif",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + Custom
        </button>
      </div>
      <div className="bl-cat-tabs">
        {allCategories.map((cat) => (
          <button
            key={cat}
            className={`bl-cat-tab${activeCategory === cat ? ' on' : ''}`}
            onClick={() => {
              setActiveCat(cat);
              setSel(null);
              setCustomMode(false);
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ← ADD: when Custom is active, show a name/price form instead of the grid */}
      {customMode ? (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="bl-disc-inp"
            style={{ width: '100%' }}
            placeholder="Service name"
            value={customName}
            onChange={(e) => {
              setCustomName(e.target.value);
            }}
          />
          <input
            className="bl-disc-inp"
            style={{ width: '100%' }}
            type="number"
            min={0}
            placeholder="Price (₹)"
            value={customPrice === '' ? '' : customPrice}
            onChange={(e) => {
              setCustomPrice(e.target.value === '' ? '' : Number(e.target.value));
            }}
          />
          <button
            className="bl-btn bl-btn-secondary bl-btn-sm"
            disabled={!customName.trim() || !customPrice}
            onClick={useCustomService}
          >
            Use This Service
          </button>
        </div>
      ) : (
        <div className="bl-picker-grid">
          {filtered.map((svc) => (
            <div
              key={svc.id}
              className={`bl-picker-item${sel?.id === svc.id ? ' sel' : ''}`}
              onClick={() => {
                setSel(svc);
              }}
            >
              <div className="bl-picker-pname">{svc.name}</div>
              <div className="bl-picker-price">
                {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  maximumFractionDigits: 0,
                }).format(svc.price)}
              </div>
              <div className="bl-picker-dur">{svc.duration} min</div>
            </div>
          ))}
        </div>
      )}

      {sel && (
        <div className="bl-picker-confirm">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1208', marginBottom: 6 }}>
              {sel.name}
            </div>
            <select
              className="bl-staff-sel"
              value={staff}
              onChange={(e) => {
                setStaff(e.target.value);
              }}
              disabled={staffLoading || staffOptions.length === 0}
            >
              <option value="">
                {staffLoading
                  ? 'Loading staff…'
                  : staffOptions.length === 0
                    ? 'No active staff available'
                    : 'Assign staff…'}
              </option>
              {staffOptions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} — {s.speciality.trim() ? s.speciality : ROLE_LABEL[s.role]}
                </option>
              ))}
            </select>
          </div>
          <button
            className="bl-btn bl-btn-primary bl-btn-sm"
            disabled={!staff}
            onClick={() => {
              if (staff) {
                onAdd(sel, staff);
                setSel(null);
                setStaff('');
                setCustomMode(false); {/* ← ADD: reset back to the catalogue view after adding */}
                setCustomName('');    {/* ← ADD */}
                setCustomPrice('');   {/* ← ADD */}
              }
            }}
          >
            <Ic n="plus" s={12} />
            Add
          </button>
        </div>
      )}
    </div>
  );
}
