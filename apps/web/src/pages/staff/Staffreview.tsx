import { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

// ─── Types ───────────────────────────────────────────────────────────────────
type StaffRole =
  | "admin"
  | "manager"
  | "senior_stylist"
  | "stylist"
  | "receptionist"
  | "support";

type StaffStatus = "active" | "on_leave" | "inactive";

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

type AttendanceStatus = "present" | "absent" | "half-day" | "late" | "holiday";

interface AttendanceRecord {
  staffId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
}

// NEW: Timer ON/OFF records from the Reception page's shift-attendance system
interface ShiftAttendanceRecord {
  staffId: string;
  date: string;
  timerOnTime?: string;
  timerOffTime?: string;
  totalWorkingMinutes?: number;
}
interface SalaryCredit {
  id: string;
  staffId: string;
  amount: number;
  date: string;
  note?: string;
  period: string;
}

interface BillItem {
  serviceId: string;
  serviceName: string;
  staffId: string;
  price: number;
  duration: number;
}

interface SavedBill {
  _id: string;
  billNumber: string;
  customer: { name: string; phone: string } | null;
  phone: string;
  items: BillItem[];
  subtotal: number;
  total: number;
  paymentMethod: "cash" | "card" | "upi";
  status: "paid" | "pending";
  createdAt: string;
  notes: string;
  staffRating?: number;
}

type ApptStatus = "confirmed" | "in-progress" | "completed" | "cancelled" | "pending" | "billed";

interface Appointment {
  _id: string;
  customer: string;
  phone: string;
  service: string;
  staff: string;
  date: string;
  time: string;
  duration: number;
  status: ApptStatus;
  isWalkIn: boolean;
  notes: string;
  staffRating?: number;
}

type SortKey = "name" | "attendance" | "joinDate" | "role" | "revenue" | "appointments" | "performance" | "rating";
type SortDir = "asc" | "desc";

type PerfBand = "excellent" | "good" | "average" | "needs_improvement" | "no_data";

interface PerfBreakdown {
  score: number | null;
  band: PerfBand;
  attendanceScore: number | null;
  completionScore: number | null;
  revenueScore: number | null;
  cancellationScore: number | null;
  ratingScore: number | null;
  hasApptData: boolean;
  hasRevenueBaseline: boolean;
  hasRatingData: boolean;
}

interface RatingRecord {
  key: string;
  source: "appointment" | "bill";
  customerName: string;
  serviceLabel: string;
  date: string;
  rating: number;
  billNumber?: string;
}

// ─── Static config ────────────────────────────────────────────────────────────
const ROLE_CFG: Record<StaffRole, { label: string; color: string; bg: string }> = {
  admin:          { label: "Admin",          color: "#7c3aed", bg: "#f5f3ff" },
  manager:        { label: "Manager",        color: "#b8860b", bg: "#fefce8" },
  senior_stylist: { label: "Senior Stylist", color: "#0f766e", bg: "#f0fdfa" },
  stylist:        { label: "Stylist",        color: "#2563eb", bg: "#eff6ff" },
  receptionist:   { label: "Receptionist",   color: "#db2777", bg: "#fdf2f8" },
  support:        { label: "Support Staff",  color: "#6b7280", bg: "#f9fafb" },
};

const STATUS_CFG: Record<StaffStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:   { label: "Active",   color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
  on_leave: { label: "On Leave", color: "#b45309", bg: "#fffbeb", dot: "#f59e0b" },
  inactive: { label: "Left",     color: "#6b5740", bg: "#f5f0e8", dot: "#c5b89a" },
};

const ATT_CFG: Record<AttendanceStatus, { label: string; color: string; bg: string; short: string }> = {
  present:    { label: "Present",  color: "#15803d", bg: "#f0fdf4", short: "P"  },
  absent:     { label: "Absent",   color: "#b91c1c", bg: "#fef2f2", short: "A"  },
  "half-day": { label: "Half Day", color: "#b45309", bg: "#fffbeb", short: "H"  },
  late:       { label: "Late",     color: "#1d4ed8", bg: "#eff6ff", short: "L"  },
  holiday:    { label: "Holiday",  color: "#7c3aed", bg: "#f5f3ff", short: "HO" },
};

const APPT_STATUS_CFG: Record<ApptStatus, { label: string; color: string; bg: string; dot: string }> = {
  confirmed:     { label: "Confirmed",   color: "#3b6d11", bg: "#eaf3de", dot: "#5a9e2f" },
  "in-progress": { label: "In Progress", color: "#633806", bg: "#faeeda", dot: "#d4711f" },
  completed:     { label: "Completed",   color: "#444444", bg: "#f0f0f0", dot: "#999999" },
  cancelled:     { label: "Cancelled",   color: "#a32d2d", bg: "#fcebeb", dot: "#c0392b" },
  pending:       { label: "Pending",     color: "#5f5e5a", bg: "#f1efe8", dot: "#999999" },
  billed:        { label: "Billed",      color: "#3730a3", bg: "#eef2ff", dot: "#6366f1" },
};

const PERF_CFG: Record<PerfBand, { label: string; color: string; bg: string; dot: string }> = {
  excellent:         { label: "Excellent",         color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
  good:              { label: "Good",              color: "#0f766e", bg: "#f0fdfa", dot: "#14b8a6" },
  average:           { label: "Average",           color: "#b45309", bg: "#fffbeb", dot: "#f59e0b" },
  needs_improvement: { label: "Needs Improvement", color: "#b91c1c", bg: "#fef2f2", dot: "#ef4444" },
  no_data:           { label: "Not Enough Data",   color: "#8a7560", bg: "#f5f0e8", dot: "#c5b89a" },
};

const MIN_ACTIVE_DAYS_FOR_RATING = 5;

const PERF_WEIGHTS = {
  attendance: 0.30,
  completion: 0.30,
  revenue: 0.25,
  cancellation: 0.15,
  rating: 0.15,
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const AVATAR_COLORS = [
  "#d4af37","#8a7050","#b8860b","#6b5740",
  "#0f766e","#7c3aed","#db2777","#2563eb",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const token = (): string => {
  try {
    return (JSON.parse(localStorage.getItem("velvet_token") ?? "{}") as { token?: string }).token ?? "";
  } catch { return ""; }
};

const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token()}`,
});
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

const fmtDate = (d: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

// NEW: display-only — turns a stored 24h "HH:MM" string (e.g. "20:00") into
// 12h format (e.g. "8:00 PM"). Only used for on-screen text; the underlying
// AttendanceRecord.checkIn/checkOut values stay 24h since they're plain
// strings with no computation depending on this component's formatting.
const fmtTime12 = (hhmm?: string) => {
  if (!hhmm) return hhmm;
  const [hStr, m = "00"] = hhmm.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12)}:${m} ${period}`;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const initials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

const avatarColor = (name: string) => {
  const code = name ? name.charCodeAt(0) : 65;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const getRoleCfg = (role: StaffRole | undefined | null) =>
  (role && ROLE_CFG[role]) ?? { label: "Unknown", color: "#6b5740", bg: "#f5f0e8" };

const getStatusCfg = (status: StaffStatus | undefined | null) =>
  (status && STATUS_CFG[status]) ?? { label: "Unknown", color: "#6b5740", bg: "#f5f0e8", dot: "#c5b89a" };

const getPerfCfg = (band: PerfBand) => PERF_CFG[band];

const tenureLabel = (joinDate: string): string => {
  if (!joinDate) return "—";
  const start = new Date(joinDate + "T00:00:00");
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) return "< 1 month";
if (months < 12) return `${String(months)} mo`;
const yrs = Math.floor(months / 12);
const rem = months % 12;
return rem > 0 ? `${String(yrs)}y ${String(rem)}mo` : `${String(yrs)} yr${yrs > 1 ? "s" : ""}`;
};

const monthPrefixOf = (isoOrDate: string) => (isoOrDate || "").slice(0, 7);

const perfBandFromScore = (score: number): PerfBand => {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "average";
  return "needs_improvement";
};

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const paths: Record<string, string> = {
    user:      "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    users:     "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    search:    "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    refresh:   "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    calendar:  "M3 4h18v18H3zM3 10h18M8 2v4M16 2v4",
    chevL:     "M15 18l-6-6 6-6",
    chevR:     "M9 18l6-6-6-6",
    chevD:     "M6 9l6 6 6-6",
    chevU:     "M18 15l-6-6-6 6",
    x:         "M18 6L6 18M6 6l12 12",
    briefcase: "M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",
    rupee:     "M6 3h12M6 8h12M15 3a9 9 0 0 1 0 18H6M6 21l9-18",
    phone:     "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    mail:      "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
    star:      "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    award:     "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12",
    shield:    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    sort:      "M3 6h18M7 12h10M11 18h2",
    clock:     "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
    check:     "M20 6L9 17l-5-5",
    info:      "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01",
    download:  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    eye:       "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    scissors:  "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12",
    receipt:   "M4 2h16a1 1 0 0 1 1 1v19l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 0 1 1-1zM8 8h8M8 12h8M8 16h4",
    cal2:      "M3 4h18v18H3zM3 10h18M8 2v4M16 2v4M8 14h2M14 14h2",
    walkin:    "M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM6 20h4l1-4 2 2v4h2v-5l-2-2 1-3a9 9 0 0 0 4 2v-2a7 7 0 0 1-3-1l-1-2a1 1 0 0 0-1 0l-3 3L6 14H4v2h2zM4 8h7",
    gauge:     "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 5a8 8 0 0 0-6.32 12.9M19 9.6A8 8 0 0 1 19 14",
    tag:       "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {paths[n]?.split("M").filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
    </svg>
  );
};

const StarIcon = ({ filled, s = 13 }: { filled: boolean; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"
    fill={filled ? "#d4af37" : "none"}
    stroke={filled ? "#d4af37" : "#c5b89a"}
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const Avatar = ({ name, size = 40, status }: { name: string; size?: number; status?: StaffStatus }) => (
  <div className="rounded-full flex items-center justify-center text-white font-medium relative flex-shrink-0 font-['Cormorant_Garamond']"
    style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(name), opacity: status === "inactive" ? 0.45 : 1 }}>
    {initials(name || "?")}
    {status && status !== "active" && (
      <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"
        style={{ width: 12, height: 12, background: getStatusCfg(status).dot }} />
    )}
  </div>
);

const AttBar = ({ pct }: { pct: number }) => (
  <div className="flex items-center gap-2">
    <div className="w-20 h-1.5 bg-[#f0e8d8] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${String(pct)}%`, background: pct >= 90 ? "#15803d" : pct >= 75 ? "#d4af37" : "#b91c1c" }} />
    </div>
    <span className="text-[12px] font-medium min-w-[32px]"
      style={{ color: pct >= 90 ? "#15803d" : pct >= 75 ? "#b8860b" : "#b91c1c" }}>{pct}%</span>
  </div>
);

const RatingCell = ({ avg, count }: { avg: number | null; count: number }) => {
  if (avg === null || count === 0) {
    return <span className="text-[11px] text-[#c5b89a] font-light">No reviews yet</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <StarIcon filled s={13} />
      <span className="text-[12px] font-medium text-[#1a1208]">{avg.toFixed(1)}</span>
      <span className="text-[10px] text-[#8a7560]">({count} review{count !== 1 ? "s" : ""})</span>
    </div>
  );
};

const PerfBadge = ({ perf, size = "sm" }: { perf: PerfBreakdown; size?: "sm" | "lg" }) => {
  const cfg = getPerfCfg(perf.band);
  if (perf.score === null) {
    return (
      <span className="text-[9px] font-medium tracking-[0.1em] uppercase px-2 py-1 rounded-full flex items-center gap-1 w-fit"
        style={{ background: cfg.bg, color: cfg.color }}>
        <Ic n="gauge" s={10} /> {cfg.label}
      </span>
    );
  }
  if (size === "lg") {
    return (
      <div className="flex items-center gap-2.5">
        <div className="font-['Cormorant_Garamond'] text-2xl font-light" style={{ color: cfg.color }}>{perf.score}</div>
        <span className="text-[9px] font-medium tracking-[0.12em] uppercase px-2.5 py-1 rounded-full flex items-center gap-1"
          style={{ background: cfg.bg, color: cfg.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
          {cfg.label}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] font-medium min-w-[24px]" style={{ color: cfg.color }}>{perf.score}</span>
      <span className="text-[9px] font-medium tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
    </div>
  );
};

interface StaffStats {
  member: StaffMember;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  activeDays: number;
  attPct: number;
  // NEW: attendance % based on Timer ON/OFF records rather than manual status marks
  timerDays: number;
  timerAttPct: number;
  totalCredited: number;
  monthCredited: number;
  servicesBilled: number;
  revenue: number;
  billItems: Array<{ billNumber: string; serviceName: string; price: number; createdAt: string; status: "paid" | "pending" }>;
  apptTotal: number;
  apptConfirmed: number;
  apptCompleted: number;
  apptCancelled: number;
  apptPending: number;
  apptInProgress: number;
  apptWalkIns: number;
  apptList: Appointment[];
  ratingAvg: number | null;
  ratingCount: number;
  ratedAppts: Appointment[];
  allRatings: RatingRecord[];
  perf: PerfBreakdown;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StaffreviewPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [salaryCredits, setSalaryCredits] = useState<SalaryCredit[]>([]);
  const [bills, setBills] = useState<SavedBill[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // NEW: Timer ON/OFF records for the visible month
  const [shiftRecords, setShiftRecords] = useState<ShiftAttendanceRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<StaffRole | "all">("all");
  const [filterStatus, setFilterStatus] = useState<StaffStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected, setSelected] = useState<StaffStats | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"attendance" | "billing" | "appointments" | "reviews">("attendance");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const daysInMonth = getDaysInMonth(viewYear, viewMonth);
      const from = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-01`;
      const to = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

          const [staffRes, salaryRes, attRes, billsRes, apptRes] = await Promise.all([
        fetch(`${API_BASE}/api/staff-roles`, { headers: hdrs() }),
        fetch(`${API_BASE}/api/salary`, { headers: hdrs() }),
        fetch(`${API_BASE}/api/attendance?from=${from}&to=${to}`, { headers: hdrs() }),
        fetch(`${API_BASE}/api/bills?limit=500`, { headers: hdrs() }),
        fetch(`${API_BASE}/api/appointments?from=${from}&to=${to}`, { headers: hdrs() }),
      ]);

      // NEW: shift-attendance (Timer ON/OFF) only supports ?date=, so fetch per day
      const shiftDayResults = await Promise.all(
        Array.from({ length: daysInMonth }, (_, i) => {
          const dStr = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          return fetch(`${API_BASE}/api/shift-attendance?date=${dStr}`, { headers: hdrs() })
            .then((r) => (r.ok ? r.json() as Promise<ShiftAttendanceRecord[]> : Promise.resolve([])))
            .catch(() => [] as ShiftAttendanceRecord[]);
        })
      );
      setShiftRecords(shiftDayResults.flat());

      if (!staffRes.ok) throw new Error(await staffRes.text());
      if (!salaryRes.ok) throw new Error(await salaryRes.text());
      if (!attRes.ok) throw new Error(await attRes.text());

      const staffData = await staffRes.json() as StaffMember[];
      const salaryData = await salaryRes.json() as SalaryCredit[];
      const attData = await attRes.json() as AttendanceRecord[];

      let billsData: SavedBill[] = [];
      if (billsRes.ok) { try { billsData = await billsRes.json() as SavedBill[]; } catch { billsData = []; } }

      let apptData: Appointment[] = [];
      if (apptRes.ok) {
        try { apptData = await apptRes.json() as Appointment[]; } catch { apptData = []; }
      } else {
        try {
          const days = await Promise.all(
            Array.from({ length: daysInMonth }, (_, i) => {
              const dStr = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
              return fetch(`${API_BASE}/api/appointments?date=${dStr}`, { headers: hdrs() })
                .then((r) => (r.ok ? r.json() as Promise<Appointment[]> : Promise.resolve([]))).catch(() => []);
            })
          );
          apptData = days.flat();
        } catch { apptData = []; }
      }

      setStaff(staffData);
      setRecords(attData);
      setSalaryCredits(salaryData);
      setBills(billsData);
      setAppointments(apptData);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const statsMap = useMemo<Map<string, StaffStats>>(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
const prefix = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}`;
    const map = new Map<string, StaffStats>();

    const monthBills = bills.filter((b) => monthPrefixOf(b.createdAt) === prefix);
    const monthAppts = appointments.filter((a) => monthPrefixOf(a.date) === prefix);
    const ratedMonthBills = monthBills.filter((b) => b.status === "paid" && typeof b.staffRating === "number");

    type BaseStats = Omit<StaffStats, "perf">;
    const baseList: BaseStats[] = staff.map((s) => {
      let activeDays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${prefix}-${String(d).padStart(2, "0")}`;
        const afterJoin = !s.joinDate || dStr >= s.joinDate;
        const beforeExit = !s.exitDate || dStr <= s.exitDate;
        if (afterJoin && beforeExit) activeDays++;
      }

            const monthRecs = records.filter((r) => r.staffId === s._id && r.date.startsWith(prefix));
      const present = monthRecs.filter((r) => r.status === "present").length;
      const late    = monthRecs.filter((r) => r.status === "late").length;
      const halfDay = monthRecs.filter((r) => r.status === "half-day").length;
      const absent  = monthRecs.filter((r) => r.status === "absent").length;
      const attPct  = activeDays > 0 ? Math.round(((present + late + halfDay * 0.5) / activeDays) * 100) : 0;

      // NEW: attendance % based on Timer ON/OFF — any day with a recorded Timer ON counts as worked
      const timerDays = shiftRecords.filter((r) => r.staffId === s._id && r.date.startsWith(prefix) && !!r.timerOnTime).length;
      const timerAttPct = activeDays > 0 ? Math.round((timerDays / activeDays) * 100) : 0;

      const totalCredited = salaryCredits.filter((c) => c.staffId === s._id).reduce((acc, c) => acc + c.amount, 0);
      const monthCredited = salaryCredits.filter((c) => c.staffId === s._id && c.date.startsWith(prefix)).reduce((acc, c) => acc + c.amount, 0);

     const billItems: StaffStats["billItems"] = [];
for (const bill of monthBills) {
  // item.price is already stored net-of-discount (matches bill.total),
  // so it's used as-is — no ratio re-application needed.
  for (const item of bill.items) {
    if (item.staffId === s._id) {
      billItems.push({ billNumber: bill.billNumber, serviceName: item.serviceName, price: item.price, createdAt: bill.createdAt, status: bill.status });
    }
  }
}
      const servicesBilled = billItems.length;
      const revenue = billItems.reduce((acc, i) => acc + i.price, 0);

      const apptList = monthAppts.filter((a) => a.staff === s._id);
      const apptTotal      = apptList.length;
      const apptConfirmed  = apptList.filter((a) => a.status === "confirmed").length;
      const apptCompleted  = apptList.filter((a) => a.status === "completed").length;
      const apptCancelled  = apptList.filter((a) => a.status === "cancelled").length;
      const apptPending    = apptList.filter((a) => a.status === "pending").length;
      const apptInProgress = apptList.filter((a) => a.status === "in-progress").length;
      const apptWalkIns    = apptList.filter((a) => a.isWalkIn).length;

      const ratedAppts = apptList.filter((a) => a.status === "completed" && typeof a.staffRating === "number");

      const staffBillIds = new Set(
        monthBills.filter((b) => b.items.some((it) => it.staffId === s._id)).map((b) => b._id)
      );
      const ratedBillsForStaff = ratedMonthBills.filter((b) => staffBillIds.has(b._id));

      const allRatings: RatingRecord[] = [
        ...ratedAppts.map((a): RatingRecord => ({
          key: `appt-${a._id}`, source: "appointment", customerName: a.customer,
          serviceLabel: a.service, date: a.date, rating: a.staffRating as number,
        })),
        ...ratedBillsForStaff.map((b): RatingRecord => {
          const myItems = b.items.filter((it) => it.staffId === s._id).map((it) => it.serviceName).filter(Boolean).join(", ");
          return {
            key: `bill-${b._id}`, source: "bill", customerName: b.customer?.name ?? (b.phone || "Guest"),
            serviceLabel: myItems || "Bill visit", date: b.createdAt.slice(0, 10),
            rating: b.staffRating as number, billNumber: b.billNumber,
          };
        }),
      ].sort((a, b) => b.date.localeCompare(a.date));

      const ratingCount = allRatings.length;
      const ratingAvg = ratingCount > 0 ? allRatings.reduce((acc, r) => acc + r.rating, 0) / ratingCount : null;

      return { member: s, present, late, halfDay, absent, activeDays, attPct, timerDays, timerAttPct, totalCredited, monthCredited,
        servicesBilled, revenue, billItems, apptTotal, apptConfirmed, apptCompleted, apptCancelled,
        apptPending, apptInProgress, apptWalkIns, apptList, ratingAvg, ratingCount, ratedAppts, allRatings };
    });

    const roleRevenueTotals = new Map<StaffRole, { sum: number; count: number }>();
    baseList.forEach((b) => {
      if (b.activeDays < MIN_ACTIVE_DAYS_FOR_RATING || b.revenue <= 0) return;
      const cur = roleRevenueTotals.get(b.member.role) ?? { sum: 0, count: 0 };
      cur.sum += b.revenue; cur.count += 1;
      roleRevenueTotals.set(b.member.role, cur);
    });
    const roleAvgRevenue = new Map<StaffRole, number>();
    roleRevenueTotals.forEach((v, role) => roleAvgRevenue.set(role, v.sum / v.count));

    baseList.forEach((b) => {
      const perf = computePerf(b, roleAvgRevenue.get(b.member.role));
      map.set(b.member._id, { ...b, perf });
    });

    return map;
  }, [staff, records, shiftRecords, salaryCredits, bills, appointments, viewYear, viewMonth]);

  const summary = useMemo(() => {
    const active = staff.filter((s) => s.status === "active").length;
    const onLeave = staff.filter((s) => s.status === "on_leave").length;
    const allStats = Array.from(statsMap.values());
    const avgAtt = allStats.length > 0 ? Math.round(allStats.reduce((a, s) => a + s.attPct, 0) / allStats.length) : 0;
    const totalSalaryCredited = allStats.reduce((a, s) => a + s.monthCredited, 0);
    const totalRevenue = allStats.reduce((a, s) => a + s.revenue, 0);
    const totalAppts = allStats.reduce((a, s) => a + s.apptTotal, 0);
    const rated = allStats.filter((s): s is StaffStats & { perf: { score: number } } => s.perf.score !== null);
const avgPerf = rated.length > 0 ? Math.round(rated.reduce((a, s) => a + s.perf.score, 0) / rated.length) : null;
    const totalReviews = allStats.reduce((a, s) => a + s.ratingCount, 0);
    const ratingSum = allStats.reduce((a, s) => a + (s.ratingAvg !== null ? s.ratingAvg * s.ratingCount : 0), 0);
    const avgRating = totalReviews > 0 ? ratingSum / totalReviews : null;
    return { total: staff.length, active, onLeave, avgAtt, totalSalaryCredited, totalRevenue, totalAppts, avgPerf, avgRating, totalReviews };
  }, [staff, statsMap]);

  const displayed = useMemo(() => {
    let list = Array.from(statsMap.values());
    if (search) list = list.filter((s) =>
      s.member.name.toLowerCase().includes(search.toLowerCase()) ||
      s.member.phone.includes(search) ||
      s.member.speciality.toLowerCase().includes(search.toLowerCase()));
    if (filterRole !== "all") list = list.filter((s) => s.member.role === filterRole);
    if (filterStatus !== "all") list = list.filter((s) => s.member.status === filterStatus);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.member.name.localeCompare(b.member.name);
      else if (sortKey === "attendance") cmp = a.attPct - b.attPct;
      else if (sortKey === "joinDate") cmp = a.member.joinDate.localeCompare(b.member.joinDate);
      else if (sortKey === "role") cmp = a.member.role.localeCompare(b.member.role);
      else if (sortKey === "revenue") cmp = a.revenue - b.revenue;
      else if (sortKey === "appointments") cmp = a.apptTotal - b.apptTotal;
      else if (sortKey === "rating") {
        const av = a.ratingAvg, bv = b.ratingAvg;
        if (av === null && bv === null) cmp = 0;
        else if (av === null) return 1;
        else if (bv === null) return -1;
        else cmp = av - bv;
      } else {
        const av = a.perf.score, bv = b.perf.score;
        if (av === null && bv === null) cmp = 0;
        else if (av === null) return 1;
        else if (bv === null) return -1;
        else cmp = av - bv;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [statsMap, search, filterRole, filterStatus, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const openDrawer = (stats: StaffStats) => {
    setSelected(stats);
    setDrawerTab("attendance");
    setDrawerOpen(true);
  };

  // NEW: Excel export of the currently displayed (filtered/sorted) staff review table
  const downloadExcel = () => {
     const header = [
      "Staff", "Phone", "Role", "Status",
      "Attendance %", "Timer Attendance %", "Timer Days", "Present", "Late", "Half Day", "Absent", /* NEW: 2 timer columns added */
      "Performance Score", "Performance Band",
      "Avg Rating", "Review Count",
      "Revenue", "Services Billed",
      "Appointments", "Completed", "Confirmed", "Pending", "In Progress", "Cancelled", "Walk-ins",
      "Salary (Month)", "Salary (All Time)",
    ];
    const rows = displayed.map((s) => [
      s.member.name,
      s.member.phone || "",
      getRoleCfg(s.member.role).label,
      getStatusCfg(s.member.status).label,
           s.attPct,
      s.timerAttPct, /* NEW */
      s.timerDays,   /* NEW */
      s.present,
      s.late,
      s.halfDay,
      s.absent,
      s.perf.score ?? "",
      getPerfCfg(s.perf.band).label,
      s.ratingAvg !== null ? s.ratingAvg.toFixed(1) : "",
      s.ratingCount,
      s.revenue,
      s.servicesBilled,
      s.apptTotal,
      s.apptCompleted,
      s.apptConfirmed,
      s.apptPending,
      s.apptInProgress,
      s.apptCancelled,
      s.apptWalkIns,
      s.monthCredited,
      s.totalCredited,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff Review");
    const monthLabel: string = MONTHS[viewMonth] ?? "";
XLSX.writeFile(wb, `staff_review_${monthLabel}_${String(viewYear)}.xlsx`);
  };

  const drawerDailyRecords = useMemo(() => {
    if (!selected) return [];
    const prefix = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}`;
    return records.filter((r) => r.staffId === selected.member._id && r.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selected, records, viewYear, viewMonth]);

  const drawerBillItems = useMemo(() => {
    if (!selected) return [];
    return [...selected.billItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [selected]);

  const drawerAppts = useMemo(() => {
    if (!selected) return [];
    return [...selected.apptList].sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      return d !== 0 ? d : a.time.localeCompare(b.time);
    });
  }, [selected]);

  const drawerReviews = selected?.allRatings ?? [];
  const drawerApptRatingCount = drawerReviews.filter((r) => r.source === "appointment").length;
  const drawerBillRatingCount = drawerReviews.filter((r) => r.source === "bill").length;

  return (
    <div className="min-h-screen bg-[#f5f0e8] font-['Jost'] text-[#2c1f0e]" style={{ overflow: drawerOpen ? "hidden" : undefined }}>
     <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500&display=swap');
        .scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── TOPBAR ── */}
      <header className="min-h-[60px] bg-white border-b border-[#ede5d6] flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-7 py-2.5">
        <h1 className="font-['Cormorant_Garamond'] text-[20px] sm:text-[22px] font-normal text-[#1a1208]">Staff Review</h1>
        <div className="flex items-center gap-2 sm:ml-4">
          <button onClick={prevMonth}
            className="w-8 h-8 border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] hover:border-[#d4af37] transition-all">
            <Ic n="chevL" s={13} />
          </button>
          <span className="font-['Cormorant_Garamond'] text-[16px] text-[#1a1208] min-w-[120px] sm:min-w-[140px] text-center">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth}
            className="w-8 h-8 border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] hover:border-[#d4af37] transition-all">
            <Ic n="chevR" s={13} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={downloadExcel}
  className="h-9 px-3 sm:px-4 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[11px] font-medium tracking-[0.12em] uppercase text-[#6b5740] hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all flex items-center gap-1.5">
  <Ic n="download" s={13} /> <span className="hidden xs:inline">Excel</span>
</button>
          <button onClick={() => { void fetchAll(); }}
  className="h-9 px-3 sm:px-4 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[11px] font-medium tracking-[0.12em] uppercase text-[#6b5740] hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all flex items-center gap-1.5">
  <Ic n="refresh" s={13} /> <span className="hidden xs:inline">Refresh</span>
</button>
        </div>
      </header>

      {apiError && (
        <div className="bg-[#fff5f5] border-b border-[#f5c6c6] px-4 sm:px-7 py-2.5 text-[12px] text-[#c0392b] flex items-center gap-2">
          ⚠ {apiError}
          <button className="ml-auto" onClick={() => { setApiError(""); }}><Ic n="x" s={14} /></button>
        </div>
      )}

      {/* ── SUMMARY CARDS ── */}
      <div className="px-4 sm:px-7 py-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3 sm:gap-4">
        {[
          { label: "Total Staff",       value: summary.total,                                                          color: "#1a1208" },
          { label: "Active",            value: summary.active,                                                         color: "#15803d" },
          { label: "On Leave",          value: summary.onLeave,                                                        color: "#b45309" },
         { label: "Avg Attendance",    value: `${String(summary.avgAtt)}%`,                                            color: summary.avgAtt >= 80 ? "#15803d" : "#b45309" },
          { label: "Avg Performance",   value: summary.avgPerf === null ? "—" : summary.avgPerf,                       color: summary.avgPerf === null ? "#8a7560" : summary.avgPerf >= 70 ? "#15803d" : "#b45309" },
          { label: "Avg Rating",        value: summary.avgRating === null ? "—" : `${summary.avgRating.toFixed(1)}★`,  color: summary.avgRating === null ? "#8a7560" : "#b8860b" },
          { label: "Salary Disbursed",  value: fmtCurrency(summary.totalSalaryCredited),                               color: "#7c3aed" },
          { label: "Revenue Generated", value: fmtCurrency(summary.totalRevenue),                                      color: "#b8860b" },
          { label: "Appointments",      value: summary.totalAppts,                                                     color: "#2563eb" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#ede5d6] rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 min-w-0">
            <div className="font-['Cormorant_Garamond'] text-2xl sm:text-3xl font-light leading-none truncate" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mt-1.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="px-4 sm:px-7 pb-4 flex flex-wrap gap-3 items-center">
        <div className="relative w-full sm:w-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7560]"><Ic n="search" s={14} /></span>
          <input className="h-9 w-full sm:w-56 border border-[#ede5d6] rounded-lg bg-white pl-9 pr-3 text-[13px] font-light text-[#2c1f0e] outline-none focus:border-[#d4af37] placeholder:text-[#c5b89a] transition-all"
            placeholder="Name, phone, speciality…" value={search} onChange={(e) => { setSearch(e.target.value); }} />
        </div>
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          <button onClick={() => { setFilterRole("all"); }}
            className={`h-8 px-3 rounded-full text-[10px] font-medium tracking-[0.08em] uppercase border transition-all ${filterRole === "all" ? "bg-[#1a1208] text-[#d4af37] border-[#1a1208]" : "bg-white text-[#8a7560] border-[#ede5d6] hover:border-[#d4af37]"}`}>
            All Roles
          </button>
          {(Object.keys(ROLE_CFG) as StaffRole[]).map((r) => (
            <button key={r} onClick={() => { setFilterRole(r); }}
              className={`h-8 px-3 rounded-full text-[10px] font-medium tracking-[0.08em] uppercase border transition-all flex items-center gap-1.5 ${filterRole === r ? "bg-[#1a1208] text-[#d4af37] border-[#1a1208]" : "bg-white text-[#8a7560] border-[#ede5d6] hover:border-[#d4af37]"}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ROLE_CFG[r].color }} />
              {ROLE_CFG[r].label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto sm:ml-auto">
          {(["all", "active", "on_leave", "inactive"] as const).map((st) => (
            <button key={st} onClick={() => { setFilterStatus(st); }}
              className={`h-8 px-3 rounded-full text-[10px] font-medium tracking-[0.08em] uppercase border transition-all ${filterStatus === st ? "bg-[#1a1208] text-[#d4af37] border-[#1a1208]" : "bg-white text-[#8a7560] border-[#ede5d6] hover:border-[#d4af37]"}`}>
              {st === "all" ? "All Status" : STATUS_CFG[st as StaffStatus].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABLE (desktop / tablet) ── */}
      <div className="px-4 sm:px-7 pb-10">
<div className="hidden md:block bg-white border border-[#ede5d6] rounded-2xl overflow-hidden overflow-x-auto scrollbar-hide">
                        <div className="min-w-[1620px] px-5 py-3 border-b border-[#f0e8d8] bg-[#faf8f4] grid grid-cols-[2fr_1fr_0.9fr_0.9fr_0.8fr_1.1fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_40px] gap-3 items-center">
            {[
              { key: "name" as SortKey,        label: "Staff Member" },
              { key: "role" as SortKey,        label: "Role" },
              { key: "attendance" as SortKey,  label: "Attendance" },
              { key: null,                     label: "Timer Attendance" }, /* NEW */
              { key: "performance" as SortKey, label: "Performance" },
              { key: "rating" as SortKey,      label: "Customer Rating" },
              { key: null,                     label: "P / L / H / A" },
              { key: "revenue" as SortKey,     label: "Revenue (Bills)" },
              { key: "appointments" as SortKey,label: "Appointments" },
              { key: null,                     label: "Salary (Month)" },
              { key: null,                     label: "Status" },
            ].map(({ key, label }) => (
              <button key={label} onClick={key ? () => { toggleSort(key); } : undefined}
                className={`text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] text-left flex items-center gap-1 ${key ? "hover:text-[#1a1208] transition-colors cursor-pointer" : "cursor-default"}`}>
                {label}
                {key && sortKey === key && <Ic n={sortDir === "asc" ? "chevU" : "chevD"} s={11} />}
              </button>
            ))}
            <div />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <span className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8a7560]">
              <Ic n="users" s={36} />
              <span className="text-[13px] font-light">No staff match the current filters</span>
            </div>
          ) : (
            displayed.map((stats) => {
                           const { member, present, late, halfDay, absent, attPct, timerAttPct, timerDays, monthCredited, revenue, servicesBilled, apptTotal, apptCompleted, perf, ratingAvg, ratingCount } = stats;
              const rc = getRoleCfg(member.role);
              const sc = getStatusCfg(member.status);
              return (
                <div key={member._id}
                  className="min-w-[1620px] px-5 py-3.5 border-b border-[#f5f0e8] last:border-b-0 grid grid-cols-[2fr_1fr_0.9fr_0.9fr_0.8fr_1.1fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_40px] gap-3 items-center hover:bg-[#faf8f4] transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={member.name} size={36} status={member.status} />
                    <div className="min-w-0">
                      <div className="text-[13px] text-[#1a1208] truncate">{member.name}</div>
                      <div className="text-[11px] text-[#8a7560] flex items-center gap-1 mt-0.5">
                        <Ic n="phone" s={10} />{member.phone || "—"}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-medium tracking-[0.1em] uppercase px-2 py-1 rounded-full w-fit"
                    style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
                  <AttBar pct={attPct} />
                  {/* NEW: Timer ON/OFF-based attendance */}
                  <div>
                    <AttBar pct={timerAttPct} />
                    <div className="text-[9px] text-[#8a7560] mt-0.5">{timerDays} timer day{timerDays !== 1 ? "s" : ""}</div>
                  </div>
                  <PerfBadge perf={perf} size="sm" />
                  <RatingCell avg={ratingAvg} count={ratingCount} />
                  <div className="flex gap-1.5 flex-wrap">
                    {[{ v: present, color: "#15803d", bg: "#f0fdf4" }, { v: late, color: "#1d4ed8", bg: "#eff6ff" },
                      { v: halfDay, color: "#b45309", bg: "#fffbeb" }, { v: absent, color: "#b91c1c", bg: "#fef2f2" }
                    ].map((b, i) => (
                      <span key={i} className="text-[10px] font-medium w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: b.bg, color: b.color }}>{b.v}</span>
                    ))}
                  </div>
                  <div>
                    <div className="text-[12px] text-[#1a1208] font-medium">{fmtCurrency(revenue)}</div>
                    <div className="text-[10px] text-[#8a7560] mt-0.5">{servicesBilled} service{servicesBilled !== 1 ? "s" : ""}</div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#1a1208] font-medium">{apptTotal}</div>
                    <div className="text-[10px] text-[#8a7560] mt-0.5">{apptCompleted} completed</div>
                  </div>
                  <div className="text-[12px] text-[#1a1208] font-medium">{fmtCurrency(monthCredited)}</div>
                  <span className="text-[9px] font-medium tracking-[0.1em] uppercase px-2 py-1 rounded-full flex items-center gap-1 w-fit"
                    style={{ background: sc.bg, color: sc.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />{sc.label}
                  </span>
                  <button onClick={() => { openDrawer(stats); }}
                    className="w-8 h-8 border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] opacity-0 group-hover:opacity-100 hover:border-[#d4af37] hover:text-[#b8860b] transition-all"
                    title="View detail"><Ic n="eye" s={13} /></button>
                </div>
              );
            })
          )}
          {!loading && displayed.length > 0 && (
            <div className="min-w-[1480px] px-5 py-2.5 bg-[#faf8f4] border-t border-[#f0e8d8] text-[11px] text-[#8a7560] tracking-[0.06em]">
              {displayed.length} member{displayed.length !== 1 ? "s" : ""}
              {(search || filterRole !== "all" || filterStatus !== "all") && ` (filtered from ${String(staff.length)})`}
            </div>
          )}
        </div>

        {/* ── STAFF LIST (mobile cards) ── */}
        <div className="md:hidden flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <span className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8a7560] bg-white border border-[#ede5d6] rounded-2xl">
              <Ic n="users" s={36} />
              <span className="text-[13px] font-light">No staff match the current filters</span>
            </div>
          ) : (
            displayed.map((stats) => {
              const { member, present, late, halfDay, absent, attPct, revenue, servicesBilled, apptTotal, apptCompleted, perf, ratingAvg, ratingCount } = stats;
              const rc = getRoleCfg(member.role);
              const sc = getStatusCfg(member.status);
              return (
                <button key={member._id} onClick={() => { openDrawer(stats); }}
                  className="text-left bg-white border border-[#ede5d6] rounded-2xl p-4 flex flex-col gap-3 active:bg-[#faf8f4] transition-colors">
                  <div className="flex items-start gap-3">
                    <Avatar name={member.name} size={40} status={member.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] text-[#1a1208]">{member.name}</span>
                        <span className="text-[9px] font-medium tracking-[0.1em] uppercase px-2 py-0.5 rounded-full"
                          style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
                      </div>
                      <div className="text-[11px] text-[#8a7560] flex items-center gap-1 mt-1">
                        <Ic n="phone" s={10} />{member.phone || "—"}
                      </div>
                    </div>
                    <span className="text-[9px] font-medium tracking-[0.1em] uppercase px-2 py-1 rounded-full flex items-center gap-1 w-fit flex-shrink-0"
                      style={{ background: sc.bg, color: sc.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />{sc.label}
                    </span>
                  </div>

                                    <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560]">Attendance</span>
                      <AttBar pct={attPct} />
                    </div>
                    {/* NEW */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560]">Timer Attendance</span>
                      <AttBar pct={stats.timerAttPct} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560]">Performance</span>
                      <PerfBadge perf={perf} size="sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560]">Rating</span>
                      <RatingCell avg={ratingAvg} count={ratingCount} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560]">Revenue</span>
                      <div className="text-[12px] text-[#1a1208] font-medium">{fmtCurrency(revenue)}</div>
                      <div className="text-[10px] text-[#8a7560]">{servicesBilled} service{servicesBilled !== 1 ? "s" : ""}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#f5f0e8] pt-2.5">
                    <div className="flex gap-1.5">
                      {[{ v: present, color: "#15803d", bg: "#f0fdf4" }, { v: late, color: "#1d4ed8", bg: "#eff6ff" },
                        { v: halfDay, color: "#b45309", bg: "#fffbeb" }, { v: absent, color: "#b91c1c", bg: "#fef2f2" }
                      ].map((b, i) => (
                        <span key={i} className="text-[10px] font-medium w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ background: b.bg, color: b.color }}>{b.v}</span>
                      ))}
                    </div>
                    <span className="text-[11px] text-[#8a7560]">{apptTotal} appt · {apptCompleted} done</span>
                  </div>
                </button>
              );
            })
          )}
          {!loading && displayed.length > 0 && (
            <div className="px-1 py-1 text-[11px] text-[#8a7560] tracking-[0.06em]">
              {displayed.length} member{displayed.length !== 1 ? "s" : ""}
              {(search || filterRole !== "all" || filterStatus !== "all") && ` (filtered from ${String(staff.length)})`}
            </div>
          )}
        </div>
      </div>

      {/* ── DETAIL DRAWER ── */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-[100] flex justify-end" style={{ background: "rgba(26,18,8,0.45)" }}
          onClick={() => { setDrawerOpen(false); }}>
          {/* Drawer: fixed height = full viewport, flex column so header+tabs are fixed and body scrolls */}
          <div className="bg-white w-full max-w-full sm:max-w-[480px] h-full flex flex-col shadow-2xl"
            onClick={(e) => { e.stopPropagation(); }}>

            {/* ── DRAWER HEADER (fixed) ── */}
            <div className="px-5 sm:px-7 pt-6 pb-5 border-b border-[#f0e8d8] flex items-start gap-4 flex-shrink-0">
              <Avatar name={selected.member.name} size={52} status={selected.member.status} />
              <div className="flex-1 min-w-0">
                <div className="font-['Cormorant_Garamond'] text-[22px] sm:text-[26px] text-[#1a1208] leading-tight">{selected.member.name}</div>
                <div className="text-[12px] text-[#6b5740] mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <Ic n="phone" s={11} /> {selected.member.phone || "—"}
                  {selected.member.email && (<><span className="text-[#e0d5c0]">·</span><Ic n="mail" s={11} /> {selected.member.email}</>)}
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-medium tracking-[0.12em] uppercase px-2.5 py-1 rounded-full"
                    style={{ background: getRoleCfg(selected.member.role).bg, color: getRoleCfg(selected.member.role).color }}>
                    {getRoleCfg(selected.member.role).label}
                  </span>
                  <span className="text-[9px] font-medium tracking-[0.12em] uppercase px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: getStatusCfg(selected.member.status).bg, color: getStatusCfg(selected.member.status).color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: getStatusCfg(selected.member.status).dot }} />
                    {getStatusCfg(selected.member.status).label}
                  </span>
                </div>
              </div>
              <button onClick={() => { setDrawerOpen(false); }}
                className="w-8 h-8 border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] hover:border-[#e74c3c] hover:text-[#e74c3c] transition-all flex-shrink-0">
                <Ic n="x" s={14} />
              </button>
            </div>

            {/* ── PERFORMANCE BANNER (fixed) ── */}
            <div className="px-5 sm:px-7 py-3 border-b border-[#f0e8d8] flex items-center justify-between gap-4 bg-[#faf8f4] flex-shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560]">
                <Ic n="gauge" s={13} /> Performance — {MONTHS[viewMonth]} {viewYear}
              </div>
              <PerfBadge perf={selected.perf} size="lg" />
            </div>

            {/* ── QUICK STATS STRIP (fixed) ── */}
                        <div className="px-5 sm:px-7 py-3 border-b border-[#f0e8d8] grid grid-cols-2 sm:grid-cols-5 gap-2 flex-shrink-0">
              <div className="bg-[#fffdf5] border border-[#f0e4c0] rounded-lg p-2.5 text-center">
                <div className="font-['Cormorant_Garamond'] text-lg text-[#b8860b] leading-none">{fmtCurrency(selected.revenue)}</div>
                <div className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560] mt-0.5">Revenue</div>
              </div>
              <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-2.5 text-center">
                <div className="font-['Cormorant_Garamond'] text-lg text-[#2563eb] leading-none">{selected.apptTotal}</div>
                <div className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560] mt-0.5">Appointments</div>
              </div>
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-2.5 text-center">
                <div className="font-['Cormorant_Garamond'] text-lg text-[#15803d] leading-none">{selected.attPct}%</div>
                <div className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560] mt-0.5">Attendance</div>
              </div>
              {/* NEW */}
              <div className="bg-[#f5f3ff] border border-[#ddd6fe] rounded-lg p-2.5 text-center">
                <div className="font-['Cormorant_Garamond'] text-lg text-[#7c3aed] leading-none">{selected.timerAttPct}%</div>
                <div className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560] mt-0.5">Timer Attendance</div>
              </div>
              <div className="bg-[#fdf8ed] border border-[#f0e0b0] rounded-lg p-2.5 text-center">
                <div className="font-['Cormorant_Garamond'] text-lg text-[#b8860b] leading-none flex items-center justify-center gap-0.5">
                  {selected.ratingAvg !== null ? selected.ratingAvg.toFixed(1) : "—"}
                  {selected.ratingAvg !== null && <StarIcon filled s={12} />}
                </div>
                <div className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#8a7560] mt-0.5">
                  {selected.ratingCount} review{selected.ratingCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            {/* ── TABS (fixed) ── */}
           <div className="px-5 sm:px-7 flex gap-0 border-b border-[#f0e8d8] bg-white flex-shrink-0 overflow-x-auto scrollbar-hide">
              {([
                { key: "attendance" as const,   label: "Attendance",   icon: "calendar" },
                { key: "billing" as const,      label: "Billing",      icon: "receipt" },
                { key: "appointments" as const, label: "Appointments", icon: "cal2" },
                { key: "reviews" as const,      label: "Reviews",      icon: "star" },
              ]).map((t) => (
                <button key={t.key} onClick={() => { setDrawerTab(t.key); }}
                  className={`pb-3 pt-3 px-3 text-[11px] font-medium tracking-[0.1em] uppercase flex items-center gap-1.5 border-b-2 transition-all -mb-px whitespace-nowrap ${
                    drawerTab === t.key ? "border-[#d4af37] text-[#1a1208]" : "border-transparent text-[#8a7560] hover:text-[#6b5740]"}`}>
                  <Ic n={t.icon} s={12} /> {t.label}
                  {t.key === "reviews" && selected.ratingCount > 0 && (
                    <span className="text-[9px] bg-[#f0e4c0] text-[#b8860b] rounded-full px-1.5 py-0.5">{selected.ratingCount}</span>
                  )}
                </button>
              ))}
            </div>

            {/* ── SCROLLABLE BODY ── */}
           <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="px-5 sm:px-7 py-5 flex flex-col gap-5">

                {/* ── ATTENDANCE TAB ── */}
                {drawerTab === "attendance" && (
                  <>
                    {/* Counts */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Present",  value: selected.present,  color: "#15803d", bg: "#f0fdf4" },
                        { label: "Late",     value: selected.late,     color: "#1d4ed8", bg: "#eff6ff" },
                        { label: "Half Day", value: selected.halfDay,  color: "#b45309", bg: "#fffbeb" },
                        { label: "Absent",   value: selected.absent,   color: "#b91c1c", bg: "#fef2f2" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl p-3 text-center border" style={{ background: s.bg, borderColor: `${s.color}30` }}>
                          <div className="font-['Cormorant_Garamond'] text-2xl font-light" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-[9px] font-medium tracking-[0.1em] uppercase mt-1" style={{ color: s.color }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                                       {/* Overall attendance % */}
                    <div className="bg-[#faf8f4] border border-[#f0e8d8] rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[12px] text-[#6b5740]">Overall ({selected.activeDays} working days)</span>
                      <AttBar pct={selected.attPct} />
                    </div>

                    {/* NEW: Timer ON/OFF-based attendance % */}
                    <div className="bg-[#f5f3ff] border border-[#ddd6fe] rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[12px] text-[#6b5740]">Timer-based ({selected.timerDays} of {selected.activeDays} days with Timer ON)</span>
                      <AttBar pct={selected.timerAttPct} />
                    </div>

                    {/* Daily records */}
                    {drawerDailyRecords.length > 0 ? (
                      <div className="border border-[#f0e8d8] rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-[#faf8f4] border-b border-[#f0e8d8] text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560]">
                          Daily Records
                        </div>
                        <div className="divide-y divide-[#f5f0e8]">
                          {drawerDailyRecords.map((r) => {
                            const cfg = ATT_CFG[r.status];
                            return (
                              <div key={r.date} className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[12px] text-[#2c1f0e]">{fmtDate(r.date)}</span>
                                                                <div className="flex items-center gap-3">
                                  {r.checkIn && (
                                    <span className="text-[11px] text-[#8a7560] flex items-center gap-1">
                                      <Ic n="clock" s={10} />{fmtTime12(r.checkIn)}{r.checkOut && ` – ${fmtTime12(r.checkOut) ?? ""}`}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-medium tracking-[0.08em] uppercase px-2 py-0.5 rounded-full"
                                    style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 gap-2 text-[#8a7560]">
                        <Ic n="calendar" s={28} />
                        <span className="text-[12px] font-light">No attendance records this month</span>
                      </div>
                    )}

                    {/* Salary */}
                    <div>
                      <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mb-3 flex items-center gap-2">
                        <Ic n="rupee" s={13} /> Salary
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "This Month", value: fmtCurrency(selected.monthCredited), color: "#15803d", bg: "#f0fdf4" },
                          { label: "All Time",   value: fmtCurrency(selected.totalCredited), color: "#7c3aed", bg: "#f5f3ff" },
                        ].map((s) => (
                          <div key={s.label} className="rounded-xl p-4 border" style={{ background: s.bg, borderColor: `${s.color}30` }}>
                            <div className="text-[10px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: s.color, opacity: 0.7 }}>{s.label}</div>
                            <div className="font-['Cormorant_Garamond'] text-2xl font-light" style={{ color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Performance breakdown */}
                    <div className="bg-[#faf8f4] border border-[#f0e8d8] rounded-xl p-5">
                      <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mb-4 flex items-center gap-2">
                        <Ic n="gauge" s={13} /> Performance Breakdown
                      </div>
                      {selected.perf.score === null ? (
                        <div className="text-[12px] text-[#8a7560] font-light py-2">
                          Not enough working days this month ({selected.activeDays} of {MIN_ACTIVE_DAYS_FOR_RATING} minimum) to calculate a reliable score.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {[
                            { label: "Attendance",               weight: PERF_WEIGHTS.attendance,   value: selected.perf.attendanceScore,   color: "#15803d" },
                            { label: "Appointment Completion",   weight: PERF_WEIGHTS.completion,   value: selected.perf.completionScore,   color: "#2563eb",  note: !selected.perf.hasApptData ? "no appointment data" : undefined },
                            { label: "Customer Rating",          weight: PERF_WEIGHTS.rating,       value: selected.perf.ratingScore,       color: "#b8860b",  note: !selected.perf.hasRatingData ? "no reviews yet" : undefined },
                            { label: "Revenue vs. Role Average", weight: PERF_WEIGHTS.revenue,      value: selected.perf.revenueScore,      color: "#7c3aed",  note: !selected.perf.hasRevenueBaseline ? "no role baseline" : undefined },
                            { label: "Cancellation Rate",        weight: PERF_WEIGHTS.cancellation, value: selected.perf.cancellationScore, color: "#0f766e",  note: !selected.perf.hasApptData ? "no appointment data" : undefined },
                          ].map((row) => (
                            <div key={row.label}>
                              <div className="flex items-center justify-between mb-1 gap-2">
                                <span className="text-[11px] text-[#4a3820]">
                                  {row.label}
                                  <span className="text-[9px] text-[#b3a589] ml-1.5">({Math.round(row.weight * 100)}% weight)</span>
                                </span>
                                <span className="text-[11px] font-medium text-[#1a1208] whitespace-nowrap">
  {row.value === null
    ? <span className="text-[#b3a589] font-normal">{row.note ?? "excluded"}</span>
    : String(row.value)}
</span>
</div>
{row.value !== null && (
  <div className="w-full h-1.5 bg-[#f0e8d8] rounded-full overflow-hidden">
    <div className="h-full rounded-full transition-all duration-500"
      style={{ width: `${String(row.value)}%`, background: row.color }} />
  </div>
)}
                            </div>
                          ))}
                          <p className="text-[10px] text-[#b3a589] font-light pt-1">
                            Weights are re-normalized across whichever factors have data this month, so missing inputs don&apos;t penalize the score.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Employment */}
                    <div className="bg-[#faf8f4] border border-[#f0e8d8] rounded-xl p-5">
                      <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mb-4 flex items-center gap-2">
                        <Ic n="briefcase" s={13} /> Employment
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Speciality", value: selected.member.speciality || "—" },
                          { label: "Tenure",     value: tenureLabel(selected.member.joinDate) },
                          { label: "Joined",     value: fmtDate(selected.member.joinDate) },
                          { label: "Left On",    value: selected.member.status === "inactive" ? fmtDate(selected.member.exitDate) : "—" },
                        ].map((r) => (
                          <div key={r.label}>
                            <div className="text-[10px] text-[#8a7560] font-medium tracking-[0.1em] uppercase mb-0.5">{r.label}</div>
                            <div className="text-[13px] text-[#1a1208]">{r.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selected.member.notes && (
                      <div className="bg-[#faf5e8] border border-[#f0e4c0] rounded-xl px-5 py-4">
                        <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mb-2 flex items-center gap-2">
                          <Ic n="info" s={13} /> Notes
                        </div>
                        <p className="text-[13px] text-[#4a3820] leading-relaxed">{selected.member.notes}</p>
                      </div>
                    )}
                  </>
                )}

                {/* ── BILLING TAB ── */}
                {drawerTab === "billing" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl p-4 border bg-[#fffdf5]" style={{ borderColor: "#f0e4c060" }}>
                        <div className="text-[10px] font-medium tracking-[0.12em] uppercase mb-1 text-[#b8860b] opacity-70">Total Revenue</div>
                        <div className="font-['Cormorant_Garamond'] text-2xl font-light text-[#b8860b]">{fmtCurrency(selected.revenue)}</div>
                      </div>
                      <div className="rounded-xl p-4 border bg-[#faf8f4]" style={{ borderColor: "#ede5d6" }}>
                        <div className="text-[10px] font-medium tracking-[0.12em] uppercase mb-1 text-[#6b5740] opacity-70">Services Performed</div>
                        <div className="font-['Cormorant_Garamond'] text-2xl font-light text-[#1a1208]">{selected.servicesBilled}</div>
                      </div>
                    </div>

                    {drawerBillItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#8a7560]">
                        <Ic n="receipt" s={32} />
                        <span className="text-[13px] font-light">No billed services this month</span>
                        <span className="text-[11px] text-[#c5b89a] font-light text-center max-w-[260px]">
                          Services appear here once they are added to a bill assigned to this staff member.
                        </span>
                      </div>
                    ) : (
                      <div className="border border-[#f0e8d8] rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-[#faf8f4] border-b border-[#f0e8d8] text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560]">
                          Line Items ({drawerBillItems.length})
                        </div>
                        <div className="divide-y divide-[#f5f0e8]">
                          {drawerBillItems.map((item, i) => (
                            <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[12px] text-[#1a1208] truncate">{item.serviceName}</div>
                                <div className="text-[10px] text-[#8a7560] mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  #{item.billNumber} · {fmtDate(item.createdAt.slice(0, 10))}
                                  <span className="text-[9px] font-medium uppercase px-1.5 py-0.5 rounded-full"
                                    style={{ background: item.status === "paid" ? "#f0fdf4" : "#fffbeb", color: item.status === "paid" ? "#15803d" : "#b45309" }}>
                                    {item.status}
                                  </span>
                                </div>
                              </div>
                              <div className="text-[13px] font-medium text-[#1a1208] whitespace-nowrap">{fmtCurrency(item.price)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── APPOINTMENTS TAB ── */}
                {drawerTab === "appointments" && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: selected.apptConfirmed,  ...APPT_STATUS_CFG.confirmed },
                        { value: selected.apptCompleted,  ...APPT_STATUS_CFG.completed },
                        { value: selected.apptPending,    ...APPT_STATUS_CFG.pending },
                        { value: selected.apptInProgress, ...APPT_STATUS_CFG["in-progress"] },
                        { value: selected.apptCancelled,  ...APPT_STATUS_CFG.cancelled },
                        { value: selected.apptWalkIns,    label: "Walk-ins", color: "#633806", bg: "#faeeda", dot: "#d4711f" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl p-3 text-center border" style={{ background: s.bg, borderColor: `${s.color}30` }}>
                          <div className="font-['Cormorant_Garamond'] text-2xl font-light" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-[9px] font-medium tracking-[0.08em] uppercase mt-0.5" style={{ color: s.color }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {drawerAppts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#8a7560]">
                        <Ic n="cal2" s={32} />
                        <span className="text-[13px] font-light">No appointments assigned this month</span>
                        <span className="text-[11px] text-[#c5b89a] font-light text-center max-w-[260px]">
                          Appointments will appear here once they are assigned to this staff member.
                        </span>
                      </div>
                    ) : (
                      <div className="border border-[#f0e8d8] rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-[#faf8f4] border-b border-[#f0e8d8] text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560]">
                          Schedule ({drawerAppts.length})
                        </div>
                        <div className="divide-y divide-[#f5f0e8]">
                          {drawerAppts.map((a) => {
  const ac = APPT_STATUS_CFG[a.status];
  return (
                              <div key={a._id} className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                  <div className="text-[12px] text-[#1a1208] flex items-center gap-1.5 flex-wrap">
                                    {a.customer}
                                    {a.isWalkIn && (
                                      <span className="text-[8px] font-medium uppercase px-1.5 py-0.5 rounded-full bg-[#faeeda] text-[#633806] flex items-center gap-0.5">
                                        <Ic n="walkin" s={8} /> Walk-in
                                      </span>
                                    )}
                                    {a.status === "completed" && typeof a.staffRating === "number" && (
                                      <span className="flex items-center gap-0.5">
                                        <StarIcon filled s={10} />
                                        <span className="text-[9px] text-[#b8860b] font-medium">{a.staffRating}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[#8a7560] mt-0.5">{a.service} · {fmtDate(a.date)} · {a.time}</div>
                                </div>
                                <span className="text-[9px] font-medium uppercase px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap"
                                  style={{ background: ac.bg, color: ac.color }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ac.dot }} />{ac.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── REVIEWS TAB ── */}
                {drawerTab === "reviews" && (
                  <>
                    {selected.ratingCount > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-[9px] font-medium tracking-[0.1em] uppercase px-2.5 py-1 rounded-full bg-[#faf5e8] border border-[#f0e4c0] text-[#b8860b] flex items-center gap-1.5">
                          <Ic n="cal2" s={9} /> {drawerApptRatingCount} from appointments
                        </span>
                        <span className="text-[9px] font-medium tracking-[0.1em] uppercase px-2.5 py-1 rounded-full bg-[#f5f0e8] border border-[#ede5d6] text-[#6b5740] flex items-center gap-1.5">
                          <Ic n="receipt" s={9} /> {drawerBillRatingCount} from bills
                        </span>
                      </div>
                    )}

                    {/* Rating distribution */}
                    {selected.ratingCount > 0 && (
                      <div className="bg-[#faf8f4] border border-[#f0e8d8] rounded-xl p-4">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="text-center">
                            <div className="font-['Cormorant_Garamond'] text-3xl text-[#b8860b] leading-none">
                              {selected.ratingAvg !== null ? selected.ratingAvg.toFixed(1) : "—"}
                            </div>
                            <div className="flex items-center justify-center gap-0.5 mt-1">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <StarIcon key={n} filled={n <= Math.round(selected.ratingAvg ?? 0)} s={11} />
                              ))}
                            </div>
                            <div className="text-[9px] text-[#8a7560] mt-1 uppercase tracking-[0.08em]">
                              {selected.ratingCount} review{selected.ratingCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col gap-1.5 min-w-[160px]">
                            {[5, 4, 3, 2, 1].map((star) => {
                              const countAtStar = selected.allRatings.filter((r) => r.rating === star).length;
                              const pct = selected.ratingCount > 0 ? Math.round((countAtStar / selected.ratingCount) * 100) : 0;
return (
  <div key={star} className="flex items-center gap-2">
    <span className="text-[9px] text-[#8a7560] w-3 text-right">{star}</span>
    <StarIcon filled s={9} />
    <div className="flex-1 h-1.5 bg-[#f0e8d8] rounded-full overflow-hidden">
      <div className="h-full rounded-full bg-[#d4af37] transition-all duration-500" style={{ width: `${String(pct)}%` }} />
    </div>
    <span className="text-[9px] text-[#8a7560] w-4">{countAtStar}</span>
  </div>
);
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {drawerReviews.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#8a7560]">
                        <Ic n="star" s={32} />
                        <span className="text-[13px] font-light">No customer reviews this month</span>
                        <span className="text-[11px] text-[#c5b89a] font-light text-center max-w-[260px]">
                          Reviews appear once a customer rates a completed appointment or a paid bill from the booking portal.
                        </span>
                      </div>
                    ) : (
                      <div className="border border-[#f0e8d8] rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-[#faf8f4] border-b border-[#f0e8d8] text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560]">
                          Individual Ratings ({drawerReviews.length})
                        </div>
                        <div className="divide-y divide-[#f5f0e8]">
                          {drawerReviews.map((r) => (
                            <div key={r.key} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[12px] text-[#1a1208]">{r.customerName}</span>
                                  <span className="text-[8px] font-medium uppercase px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                                    style={r.source === "bill" ? { background: "#f5f0e8", color: "#6b5740" } : { background: "#faf5e8", color: "#b8860b" }}>
                                    {r.source === "bill"
                                      ? <><Ic n="receipt" s={7} /> Bill{r.billNumber ? ` #${r.billNumber}` : ""}</>
                                      : <><Ic n="cal2" s={7} /> Appointment</>}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#8a7560] mt-0.5 truncate">{r.serviceLabel} · {fmtDate(r.date)}</div>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {[1, 2, 3, 4, 5].map((n) => <StarIcon key={n} filled={n <= r.rating} s={13} />)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {/* End scrollable body */}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Performance score calculation ─────────────────────────────────────────
function computePerf(
  base: {
    activeDays: number;
    attPct: number;
    apptTotal: number;
    apptCompleted: number;
    apptCancelled: number;
    revenue: number;
    ratingAvg: number | null;
    ratingCount: number;
  },
  roleAvgRevenue: number | undefined
): PerfBreakdown {
  if (base.activeDays < MIN_ACTIVE_DAYS_FOR_RATING) {
    return {
      score: null, band: "no_data",
      attendanceScore: null, completionScore: null, revenueScore: null, cancellationScore: null, ratingScore: null,
      hasApptData: base.apptTotal > 0, hasRevenueBaseline: !!roleAvgRevenue, hasRatingData: base.ratingCount > 0,
    };
  }

  const attendanceScore = base.attPct;
  const hasApptData = base.apptTotal > 0;
  const nonCancelled = base.apptTotal - base.apptCancelled;
  const completionScore = hasApptData && nonCancelled > 0 ? Math.round((base.apptCompleted / nonCancelled) * 100) : null;
  const cancellationScore = hasApptData ? Math.round(100 - (base.apptCancelled / base.apptTotal) * 100) : null;
  const hasRevenueBaseline = !!roleAvgRevenue && roleAvgRevenue > 0;
  const revenueScore = hasRevenueBaseline ? Math.min(100, Math.round((base.revenue / (roleAvgRevenue)) * 100)) : null;
  const hasRatingData = base.ratingCount > 0 && base.ratingAvg !== null;
  const ratingScore = hasRatingData ? Math.round(((base.ratingAvg as number) - 1) / 4 * 100) : null;

  const factors: Array<{ value: number | null; weight: number }> = [
    { value: attendanceScore,   weight: PERF_WEIGHTS.attendance },
    { value: completionScore,   weight: PERF_WEIGHTS.completion },
    { value: revenueScore,      weight: PERF_WEIGHTS.revenue },
    { value: cancellationScore, weight: PERF_WEIGHTS.cancellation },
    { value: ratingScore,       weight: PERF_WEIGHTS.rating },
  ];
  const availableWeight = factors.filter((f) => f.value !== null).reduce((acc, f) => acc + f.weight, 0);
  const score = availableWeight > 0
    ? Math.round(factors.reduce((acc, f) => acc + (f.value !== null ? (f.value * f.weight) / availableWeight : 0), 0))
    : null;

  return {
    score, band: score !== null ? perfBandFromScore(score) : "no_data",
    attendanceScore, completionScore, revenueScore, cancellationScore, ratingScore,
    hasApptData, hasRevenueBaseline, hasRatingData,
  };
}