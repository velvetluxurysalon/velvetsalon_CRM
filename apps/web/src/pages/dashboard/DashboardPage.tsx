import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { useAuth, type Role } from "../../context/AuthContext";
import Sidebar, { Icon, roleLabel } from "../../components/layout/Sidebar";
import { SERVICES_CAT } from "../../db/services";
import * as XLSX from "xlsx";
// ─── Types (mirrors AppointmentsPage / Staffrole / Billing shapes) ───────────
type ApptStatus = "confirmed" | "in-progress" | "completed" | "cancelled" | "pending" | "billed";

interface Appointment {
  _id: string;
  customer: string;
  phone: string;
  service: string;
  staff: string;        // staffId
  date: string;
  time: string;
  duration: number;
  status: ApptStatus;
  isWalkIn: boolean;
  notes: string;
  staffRating?: number;
}

interface BillItem {
  serviceId?: string;
  serviceName: string;
  staffId: string;
  price: number;
  duration?: number;
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

interface StaffMember {
  _id: string;
  name: string;
  role: string;
  status: "active" | "on_leave" | "inactive";
  color?: string;
}

// Extended with everything the notifications engine needs.
// anniversaryDate is optional — not every backend schema will have it yet.
interface CustomerLite {
  _id: string;
  name: string;
  phone: string;
  joinDate: string;
  dob?: string;
  membershipTier?: "none" | "silver" | "gold" | "platinum";
  membershipExpiry?: string;
  lastVisit?: string;
  anniversary?: string;
}

type AttendanceStatus = "present" | "absent" | "half-day" | "late" | "holiday";
interface AttendanceRecord {
  staffId: string;
  date: string;
  status: AttendanceStatus;
}

// ─── API helpers ──────────────────────────────────────────────────────────────
const token = () => {
  try { return (JSON.parse(localStorage.getItem("velvet_token") ?? "{}") as { token?: string }).token ?? ""; }
  catch { return ""; }
};
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

const dateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${String(y)}-${m}-${day}`;
};
const todayStr = dateStr(new Date());
// Shifts a "YYYY-MM-DD" string by `delta` days — used to walk selectedDate
// backward/forward without touching the real system date.
const addDays = (ds: string, delta: number) => {
  const d = new Date(ds + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return dateStr(d);
};

// NEW: Display-only conversion of stored 24h "HH:mm" time into 12h "h:mm AM/PM".
// Mirrors fmtTime12 in AppointmentsPage.tsx — used only for display here.
const fmtTime12 = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12)}:${String(m).padStart(2, "0")} ${ampm}`;
};

const AVATAR_COLORS = ["#d4af37", "#8a7050", "#b8860b", "#6b5740", "#0f766e", "#7c3aed", "#db2777", "#2563eb"];
const avatarColor = (name: string) => {
  const code = name[0]?.toUpperCase().charCodeAt(0) ?? 65;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
};

// Look up each service's real category from the shared catalogue (services.ts)
// instead of guessing from keywords. Falls back to "Other" only for a
// service name that no longer exists in the catalogue.
const SERVICE_CATEGORY_BY_NAME = new Map(SERVICES_CAT.map(s => [s.name, s.category]));

// Chart labels need to stay short — map the full catalogue category names
// (e.g. "Men's Hair & Grooming") down to compact chart-friendly labels
// without changing the underlying category data itself.
const CATEGORY_SHORT_LABEL: Record<string, string> = {
  "Signature Combos": "Combos",
  "Men's Hair & Grooming": "Men's Hair",
  "Men's Massage Services": "Massage",
  "Men's Hair Treatments": "Hair Treat.",
  "Men's Facial Collection": "Facial",
  "Men's Grooming Packages": "Grooming",
  "Women's Threading": "Threading",
  "Women's Hair Cuts": "Hair Cuts",
  "Women's Hair Styling": "Styling",
  "Women's Hair Treatments": "Hair Treat.",
  "Women's Advanced Hair Services": "Adv. Hair",
  "Women's Waxing": "Waxing",
  "Women's Bleach": "Bleach",
  "Women's Facial Collection": "Facial",
  "Women's Manicure & Pedicure": "Mani/Pedi",
  "Bridal & Makeup": "Bridal",
};

const categorize = (service: string) => {
  const category = SERVICE_CATEGORY_BY_NAME.get(service);
  if (!category) return "Other";
  return CATEGORY_SHORT_LABEL[category] ?? category;
};

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${String(Math.round(n))}%`;
const fmtDelta = (n: number) => `${n > 0 ? "+" : ""}${String(n)}`;
const fmtCur = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// ─── Notification engine config ──────────────────────────────────────────────
const BIRTHDAY_WINDOW_DAYS = 7;
const ANNIVERSARY_WINDOW_DAYS = 7;
const MEMBERSHIP_EXPIRY_WINDOW_DAYS = 15;
const REBOOKING_DUE_MIN_DAYS = 21;
const REBOOKING_DUE_MAX_DAYS = 59;
const INACTIVE_DAYS_THRESHOLD = 60;
const INACTIVE_NEW_CUSTOMER_GRACE_DAYS = 30;

type NotifCategory = "birthdays" | "anniversaries" | "membership" | "inactive" | "rebooking";

interface NotifItem {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  detail: string;   // e.g. "Turns 32 · in 3 days" or "Expired 4 days ago"
  urgent: boolean;  // e.g. expiring within 3 days, or already expired
  sortKey: number;  // smaller = more urgent / sooner
}

// Days until the next occurrence of a recurring month/day date (birthday, anniversary).
// Returns null if the date string is missing/invalid.
const daysUntilAnnual = (isoDate: string | undefined): number | null => {
  if (!isoDate) return null;
  const d = new Date(isoDate.slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  thisYear.setHours(0, 0, 0, 0);
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let diff = Math.round((thisYear.getTime() - todayMid.getTime()) / 86400000);
  if (diff < 0) {
    const nextYear = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
    diff = Math.round((nextYear.getTime() - todayMid.getTime()) / 86400000);
  }
  return diff;
};

const daysBetween = (isoDate: string | undefined): number | null => {
  if (!isoDate) return null;
  const d = new Date(isoDate.slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((todayMid.getTime() - d.getTime()) / 86400000);
};

const ageFromDob = (dob: string): number | null => {
  const d = new Date(dob.slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() >= d.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
};

// ─── Status badge config (expanded to cover all real appointment statuses) ──
const statusStyle: Record<ApptStatus, { bg: string; color: string; label: string }> = {
  confirmed:     { bg: "#eaf3de", color: "#3b6d11", label: "Confirmed"   },
  "in-progress": { bg: "#faeeda", color: "#633806", label: "In Progress" },
  pending:       { bg: "#f1efe8", color: "#5f5e5a", label: "Pending"     },
  completed:     { bg: "#f0f0f0", color: "#444444", label: "Completed"   },
  cancelled:     { bg: "#fcebeb", color: "#a32d2d", label: "Cancelled"   },
  billed:        { bg: "#eef2ff", color: "#3730a3", label: "Billed"      },
};

// ─── Notification category config ────────────────────────────────────────────
const NOTIF_CFG: Record<NotifCategory, { label: string; icon: string; color: string; bg: string }> = {
  birthdays:     { label: "Upcoming Birthdays",      icon: "cake",   color: "#db2777", bg: "#fdf2f8" },
  anniversaries: { label: "Upcoming Anniversaries",  icon: "heart",  color: "#e11d48", bg: "#fff1f2" },
  membership:    { label: "Membership Expiry",       icon: "crown",  color: "#b8860b", bg: "#fefce8" },
  inactive:      { label: "Inactive Customers",      icon: "moon",   color: "#6b7280", bg: "#f9fafb" },
  rebooking:     { label: "Rebooking Due",           icon: "repeat", color: "#0f766e", bg: "#f0fdfa" },
};
const NOTIF_ORDER: NotifCategory[] = ["birthdays", "anniversaries", "membership", "rebooking", "inactive"];

// ─── Staff role display config (mirrors ROLE_CFG in Staffrole.tsx, dashboard-local) ──
const STAFF_ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  admin:          { label: "Admin",          color: "#7c3aed", bg: "#f5f3ff" },
  manager:        { label: "Manager",        color: "#b8860b", bg: "#fefce8" },
  senior_stylist: { label: "Senior Stylist", color: "#0f766e", bg: "#f0fdfa" },
  stylist:        { label: "Stylist",        color: "#2563eb", bg: "#eff6ff" },
  receptionist:   { label: "Receptionist",   color: "#db2777", bg: "#fdf2f8" },
  support:        { label: "Support Staff",  color: "#6b7280", bg: "#f9fafb" },
};
const getStaffRoleCfg = (role: string) =>
  STAFF_ROLE_CFG[role] ?? { label: role, color: "#6b5740", bg: "#f5f0e8" };

// ─── Role badge colors (topbar pill) ─────────────────────────────────────────
const roleBadgeClasses: Record<Role, string> = {
  admin:        "bg-[#faf5e8] text-[#b8860b] border border-[#e8d98a]",
  receptionist: "bg-[#edf5fa] text-[#1a6b8a] border border-[#8acde8]",
  staff:        "bg-[#f1efe8] text-[#5f5e5a] border border-[#d4cfc4]",
};

// ─── Custom tooltip (unchanged behavior, Tailwind styled) ────────────────────
interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
}
interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[#d4af37]/30 bg-[#1a1208] px-3.5 py-2.5 font-['Jost',sans-serif]">
      <p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-[#d4af37]">{label}</p>
      {payload.map((p, i) => (
        <p key={p.name ?? i} className="my-0.5 text-[13px] text-[#f5ecd4]">
          ₹{Number(p.value ?? 0).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, isAdmin, isReceptionist } = useAuth();
  const [chartMode, setChartMode]   = useState<"weekly" | "monthly">("weekly");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Selected date (defaults to today, can be navigated backward) ────────
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;
  const goPrevDay = () => { setSelectedDate((d) => addDays(d, -1)); };
  const goNextDay = () => { setSelectedDate((d) => (d < todayStr ? addDays(d, 1) : d)); };

  const role = user?.role ?? "staff";

  // ── Live data state ─────────────────────────────────────────────────────
  const [staff, setStaff]                 = useState<StaffMember[]>([]);
  const [bills, setBills]                 = useState<SavedBill[]>([]);
  const [appointments, setAppointments]   = useState<Appointment[]>([]);
  const [customers, setCustomers]         = useState<CustomerLite[]>([]);
  const [attendance, setAttendance]       = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [apiError, setApiError]           = useState("");
  const [lastUpdated, setLastUpdated]     = useState<Date | null>(null);

  // ── Notifications panel state ───────────────────────────────────────────
  const [notifOpen, setNotifOpen]       = useState(false);
  const [notifTab, setNotifTab]         = useState<NotifCategory>("birthdays");
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("mousedown", onClick); };
  }, [notifOpen]);

  // ── Fetch everything the dashboard needs ────────────────────────────────
  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (isBackground) setRefreshing(true); else setLoading(true);
    setApiError("");
    try {
      const apptFrom = addDays(selectedDate, -7);
      const apptTo   = selectedDate;

     const [staffRes, billsRes, apptRes, custRes, attRes] = await Promise.all([
        fetch(`${API_BASE}/api/staff-roles`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/bills?limit=1000`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/appointments?from=${apptFrom}&to=${apptTo}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/customers?limit=1000`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/attendance?from=${selectedDate}&to=${selectedDate}`, { headers: authHeaders() }),
      ]);

      const staffData = staffRes.ok ? ((await staffRes.json().catch(() => [])) as StaffMember[]) : [];
      const billsData = billsRes.ok ? ((await billsRes.json().catch(() => [])) as SavedBill[]) : [];
      const attData = attRes.ok ? ((await attRes.json().catch(() => [])) as AttendanceRecord[]) : [];
      let apptData: Appointment[] = [];
      if (apptRes.ok) {
        apptData = (await apptRes.json().catch(() => [])) as Appointment[];
      } else {
        try {
          const r = await fetch(`${API_BASE}/api/appointments?date=${selectedDate}`, { headers: authHeaders() });
          apptData = r.ok ? ((await r.json()) as Appointment[]) : [];
        } catch { apptData = []; }
      }

      const custData = custRes.ok ? ((await custRes.json().catch(() => [])) as CustomerLite[]) : [];

      setStaff(staffData);
      setBills(billsData);
      setAppointments(apptData);
      setCustomers(custData);
      setAttendance(attData);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => { void fetchDashboardData(); }, [fetchDashboardData]);

  // ── Auto-refresh every 60s for a "live" dashboard feel ──────────────────
  useEffect(() => {
    const id = setInterval(() => { void fetchDashboardData(true); }, 60000);
    return () => { clearInterval(id); };
  }, [fetchDashboardData]);

  // ── Derived stats (computed client-side from live data) ─────────────────
  const derived = useMemo(() => {
    const yesterdayStr = addDays(selectedDate, -1);
    const paidBills = bills.filter(b => b.status === "paid");
    const billsOn = (d: string) => paidBills.filter(b => b.createdAt.slice(0, 10) === d);
   const sumTotal = (arr: SavedBill[]) => arr.reduce((s, b) => s + b.total, 0);

    const billsToday = billsOn(selectedDate);
    const billsYesterday = billsOn(yesterdayStr);
    const todayRevenue = sumTotal(billsToday);
    const yesterdayRevenue = sumTotal(billsYesterday);
    const revenueChangePct = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : (todayRevenue > 0 ? 100 : 0);

    const apptToday = appointments.filter(a => a.date === selectedDate);
    const apptYesterday = appointments.filter(a => a.date === yesterdayStr);
    const apptChange = apptToday.length - apptYesterday.length;

    const newCustToday = customers.filter(c => c.joinDate === selectedDate).length;
    const newCustYesterday = customers.filter(c => c.joinDate === yesterdayStr).length;
    const newCustChange = newCustToday - newCustYesterday;

    const avgBillToday = billsToday.length ? todayRevenue / billsToday.length : 0;
    const avgBillYesterday = billsYesterday.length ? yesterdayRevenue / billsYesterday.length : 0;
    const avgBillChangePct = avgBillYesterday > 0
      ? ((avgBillToday - avgBillYesterday) / avgBillYesterday) * 100
      : (avgBillToday > 0 ? 100 : 0);

    // Weekly revenue chart — 7 days ending on the selected date
    const weekly = Array.from({ length: 7 }, (_, i) => {
  const ds = addDays(selectedDate, -(6 - i));
  const d = new Date(ds + "T00:00:00");
  return { label: DAYS_SHORT[d.getDay()], revenue: sumTotal(billsOn(ds)) };
});

    // Monthly revenue chart — last 6 months
    const monthly = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
  const prefix = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const revenue = paidBills.filter(b => b.createdAt.slice(0, 7) === prefix).reduce((s, b) => s + b.total, 0);
  return { label: MONTHS_SHORT[d.getMonth()], revenue };
});

    // Service mix — today's appointments grouped by category
    const mixMap = new Map<string, number>();
    apptToday.forEach(a => {
      const cat = categorize(a.service);
      mixMap.set(cat, (mixMap.get(cat) ?? 0) + 1);
    });
    const serviceMix = Array.from(mixMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top staff — month of the selected date, ranked by billed revenue
    const monthPrefix = selectedDate.slice(0, 7);
    const monthBills = paidBills.filter(b => b.createdAt.slice(0, 7) === monthPrefix);
    const monthAppts = appointments.filter(a => a.date.slice(0, 7) === monthPrefix);

    const topStaff = staff
      .filter(s => s.status !== "inactive")
      .map(s => {
        let revenue = 0;
        let servicesCount = 0;
        monthBills.forEach(b => { b.items.forEach(it => {
          if (it.staffId === s._id) { revenue += it.price; servicesCount += 1; }
        }); });
        const ratings: number[] = [];
        monthAppts.forEach(a => {
          if (a.staff === s._id && a.status === "completed" && typeof a.staffRating === "number") ratings.push(a.staffRating);
        });
        monthBills.forEach(b => {
          if (typeof b.staffRating === "number" && b.items.some(it => it.staffId === s._id)) ratings.push(b.staffRating);
        });
        const ratingAvg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        return { id: s._id, name: s.name, color: s.color || avatarColor(s.name), revenue, servicesCount, ratingAvg };
      })
      .filter(s => s.revenue > 0 || s.servicesCount > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4);

    return {
      todayRevenue, revenueChangePct, apptToday, apptChange,
      newCustToday, newCustChange, avgBillToday, avgBillChangePct,
      weekly, monthly, serviceMix, topStaff,
    };
  }, [bills, appointments, customers, staff, selectedDate]);

  // ── Attendance summary for selected date ─────────────────────────────────
  const attendanceSummary = useMemo(() => {
    const activeStaff = staff.filter(s => s.status !== "inactive");
    const todays = attendance.filter(r => r.date === selectedDate);
    const present = todays.filter(r => r.status === "present").length;
    const late    = todays.filter(r => r.status === "late").length;
    const halfDay = todays.filter(r => r.status === "half-day").length;
    const absent  = todays.filter(r => r.status === "absent").length;
    const marked  = new Set(todays.map(r => r.staffId));
    const notMarked = activeStaff.filter(s => !marked.has(s._id)).length;
    return { present, late, halfDay, absent, notMarked };
  }, [staff, attendance, selectedDate]);

  // ── Staff role breakdown ──────────────────────────────────────────────────
  const roleSummary = useMemo(() => {
    const activeStaff = staff.filter(s => s.status !== "inactive");
    const counts = new Map<string, number>();
    activeStaff.forEach(s => { counts.set(s.role, (counts.get(s.role) ?? 0) + 1); });
    return Array.from(counts.entries())
      .map(([role, count]) => ({ role, count, ...getStaffRoleCfg(role) }))
      .sort((a, b) => b.count - a.count);
  }, [staff]);

  // ── CRM Notifications engine ─────────────────────────────────────────────
  const notifications = useMemo<Record<NotifCategory, NotifItem[]>>(() => {
    const birthdays: NotifItem[] = [];
    const anniversaries: NotifItem[] = [];
    const membership: NotifItem[] = [];
    const inactive: NotifItem[] = [];
    const rebooking: NotifItem[] = [];

    customers.forEach(c => {
      // ── Birthdays ──
      const bdayIn = daysUntilAnnual(c.dob);
      if (bdayIn !== null && bdayIn <= BIRTHDAY_WINDOW_DAYS) {
        const age = c.dob ? ageFromDob(c.dob) : null;
        const detail = bdayIn === 0
          ? `Today${age !== null ? ` · turns ${String(age + 1)}` : ""}`
          : `In ${String(bdayIn)} day${bdayIn !== 1 ? "s" : ""}${age !== null ? ` · turns ${String(age + 1)}` : ""}`;
        birthdays.push({
          id: `bday-${c._id}`, customerId: c._id, name: c.name, phone: c.phone,
          detail, urgent: bdayIn <= 1, sortKey: bdayIn,
        });
      }

            // ── Anniversaries (only if backend provides anniversary) ──
      const annivIn = daysUntilAnnual(c.anniversary);
      if (annivIn !== null && annivIn <= ANNIVERSARY_WINDOW_DAYS) {
        const detail = annivIn === 0 ? "Today" : `In ${String(annivIn)} day${annivIn !== 1 ? "s" : ""}`;
        anniversaries.push({
          id: `anniv-${c._id}`, customerId: c._id, name: c.name, phone: c.phone,
          detail, urgent: annivIn <= 1, sortKey: annivIn,
        });
      }

      // ── Membership expiry ──
      if (c.membershipTier && c.membershipTier !== "none" && c.membershipExpiry) {
        const expDays = daysBetween(c.membershipExpiry); // positive = already expired N days ago
        if (expDays !== null) {
          if (expDays > 0) {
            membership.push({
              id: `mem-${c._id}`, customerId: c._id, name: c.name, phone: c.phone,
              detail: `Expired ${String(expDays)} day${expDays !== 1 ? "s" : ""} ago`,
              urgent: true, sortKey: -1000 + expDays, // expired items float to top
            });
          } else {
            const daysLeft = -expDays;
            if (daysLeft <= MEMBERSHIP_EXPIRY_WINDOW_DAYS) {
              membership.push({
                id: `mem-${c._id}`, customerId: c._id, name: c.name, phone: c.phone,
                detail: daysLeft === 0 ? "Expires today" : `Expires in ${String(daysLeft)} day${daysLeft !== 1 ? "s" : ""}`,
                urgent: daysLeft <= 3, sortKey: daysLeft,
              });
            }
          }
        }
      }

      // ── Rebooking due / Inactive (based on lastVisit) ──
      const sinceVisit = daysBetween(c.lastVisit);
      const sinceJoin = daysBetween(c.joinDate);

      if (sinceVisit !== null) {
        if (sinceVisit >= REBOOKING_DUE_MIN_DAYS && sinceVisit <= REBOOKING_DUE_MAX_DAYS) {
          rebooking.push({
            id: `rebook-${c._id}`, customerId: c._id, name: c.name, phone: c.phone,
            detail: `Last visit ${String(sinceVisit)} days ago`,
            urgent: sinceVisit >= REBOOKING_DUE_MAX_DAYS - 10, sortKey: sinceVisit,
          });
        } else if (sinceVisit >= INACTIVE_DAYS_THRESHOLD) {
          inactive.push({
            id: `inactive-${c._id}`, customerId: c._id, name: c.name, phone: c.phone,
            detail: `No visit in ${String(sinceVisit)} days`,
            urgent: sinceVisit >= 120, sortKey: -sinceVisit, // most inactive first
          });
        }
      } else if (sinceJoin !== null && sinceJoin >= INACTIVE_NEW_CUSTOMER_GRACE_DAYS) {
        inactive.push({
          id: `inactive-${c._id}`, customerId: c._id, name: c.name, phone: c.phone,
          detail: `Never visited · joined ${String(sinceJoin)} days ago`,
          urgent: true, sortKey: -sinceJoin,
        });
      }
    });

    birthdays.sort((a, b) => a.sortKey - b.sortKey);
    anniversaries.sort((a, b) => a.sortKey - b.sortKey);
    membership.sort((a, b) => a.sortKey - b.sortKey);
    rebooking.sort((a, b) => b.sortKey - a.sortKey);
    inactive.sort((a, b) => a.sortKey - b.sortKey);

    return { birthdays, anniversaries, membership, inactive, rebooking };
  }, [customers]);

  const notifTotal = NOTIF_ORDER.reduce((acc, key) => acc + notifications[key].length, 0);
  const notifUrgentTotal = NOTIF_ORDER.reduce(
    (acc, key) => acc + notifications[key].filter(n => n.urgent).length, 0
  );

  // ── KPI cards (dynamic values, same shape as before) ────────────────────
  const kpis = useMemo(() => ([
    {
      label: "Today's Revenue", icon: "rupee", roles: ["admin", "receptionist"],
      value: loading ? "…" : fmtCur(derived.todayRevenue),
      change: fmtPct(derived.revenueChangePct), up: derived.revenueChangePct >= 0,
    },
    {
      label: "Appointments Today", icon: "calendar", roles: ["admin", "receptionist", "staff"],
      value: loading ? "…" : String(derived.apptToday.length),
      change: fmtDelta(derived.apptChange), up: derived.apptChange >= 0,
    },
    {
      label: "New Customers", icon: "users", roles: ["admin", "receptionist"],
      value: loading ? "…" : String(derived.newCustToday),
      change: fmtDelta(derived.newCustChange), up: derived.newCustChange >= 0,
    },
    {
      label: "Avg. Bill Value", icon: "receipt", roles: ["admin", "receptionist"],
      value: loading ? "…" : fmtCur(derived.avgBillToday),
      change: fmtPct(derived.avgBillChangePct), up: derived.avgBillChangePct >= 0,
    },
  ]), [loading, derived]);

  // Filter KPIs by role (unchanged)
  const visibleKpis = kpis.filter(k => k.roles.includes(role));

  // Resolve staff id -> name for the appointments table
  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach(s => map.set(s._id, s.name));
    return map;
  }, [staff]);

  const resolvedApptToday = useMemo(() =>
    derived.apptToday
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(a => ({ ...a, staffName: staffNameById.get(a.staff) ?? a.staff })),
    [derived.apptToday, staffNameById]
  );

  // Staff sees only their own appointments; admin/receptionist see all
  const visibleAppointments = (isAdmin || isReceptionist)
    ? resolvedApptToday
    : resolvedApptToday.filter(a => a.staffName === user?.name);

 const chartData = chartMode === "weekly" ? derived.weekly : derived.monthly;
const chartKey  = "label";

 // Notifications are shown to admin/receptionist only (CRM-facing roles)
  const showNotifications = isAdmin || isReceptionist;

  // ── Excel export: KPIs + today's appointments + attendance + top staff ──
  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();

    const kpiRows = visibleKpis.map(k => [k.label, k.value, k.change]);
    const kpiSheet = XLSX.utils.aoa_to_sheet([["Metric", "Value", "Change"], ...kpiRows]);
    XLSX.utils.book_append_sheet(wb, kpiSheet, "KPIs");

    const apptHeader = ["Customer", "Service", "Time", "Staff", "Status"];
    const apptRows = visibleAppointments.map(a => [
      a.customer, a.service, fmtTime12(a.time), a.staffName, statusStyle[a.status].label,
    ]);
    const apptSheet = XLSX.utils.aoa_to_sheet([apptHeader, ...apptRows]);
    XLSX.utils.book_append_sheet(wb, apptSheet, "Appointments");

    if (isAdmin || isReceptionist) {
      const attSheet = XLSX.utils.aoa_to_sheet([
        ["Status", "Count"],
        ["Present", attendanceSummary.present],
        ["Late", attendanceSummary.late],
        ["Half Day", attendanceSummary.halfDay],
        ["Absent", attendanceSummary.absent],
        ["Not Marked", attendanceSummary.notMarked],
      ]);
      XLSX.utils.book_append_sheet(wb, attSheet, "Attendance");
    }

    if (isAdmin && derived.topStaff.length > 0) {
      const topHeader = ["Staff", "Services", "Revenue", "Avg Rating"];
      const topRows = derived.topStaff.map(s => [
        s.name, s.servicesCount, s.revenue, s.ratingAvg !== null ? s.ratingAvg.toFixed(1) : "—",
      ]);
      const topSheet = XLSX.utils.aoa_to_sheet([topHeader, ...topRows]);
      XLSX.utils.book_append_sheet(wb, topSheet, "Top Staff");
    }

    XLSX.writeFile(wb, `dashboard_${selectedDate}.xlsx`);
  };

  // ── Word export: a single readable summary document (.doc, opens in Word) ──
  const downloadWord = () => {
    const dateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const kpiRowsHtml = visibleKpis.map(k =>
      `<tr><td>${k.label}</td><td>${k.value}</td><td>${k.change}</td></tr>`
    ).join("");

    const apptRowsHtml = visibleAppointments.map(a =>
      `<tr><td>${a.customer}</td><td>${a.service}</td><td>${fmtTime12(a.time)}</td><td>${a.staffName}</td><td>${statusStyle[a.status].label}</td></tr>`
    ).join("");

    const attHtml = (isAdmin || isReceptionist) ? `
      <h2>Staff Attendance</h2>
      <table border="1" cellpadding="6" cellspacing="0">
        <tr><th>Present</th><th>Late</th><th>Half Day</th><th>Absent</th><th>Not Marked</th></tr>
        <tr>
          <td>${String(attendanceSummary.present)}</td>
          <td>${String(attendanceSummary.late)}</td>
          <td>${String(attendanceSummary.halfDay)}</td>
          <td>${String(attendanceSummary.absent)}</td>
          <td>${String(attendanceSummary.notMarked)}</td>
        </tr>
      </table>` : "";

    const topStaffHtml = (isAdmin && derived.topStaff.length > 0) ? `
      <h2>Top Staff (This Month)</h2>
      <table border="1" cellpadding="6" cellspacing="0">
        <tr><th>Staff</th><th>Services</th><th>Revenue</th><th>Avg Rating</th></tr>
        ${derived.topStaff.map(s =>
          `<tr><td>${s.name}</td><td>${String(s.servicesCount)}</td><td>${fmtCur(s.revenue)}</td><td>${s.ratingAvg !== null ? s.ratingAvg.toFixed(1) : "—"}</td></tr>`
        ).join("")}
      </table>` : "";

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Dashboard Report</title></head>
      <body style="font-family:Calibri,Arial,sans-serif;">
        <h1>Velvet CRM — Dashboard Report</h1>
        <p>${dateLabel}</p>

        <h2>Key Metrics</h2>
        <table border="1" cellpadding="6" cellspacing="0">
          <tr><th>Metric</th><th>Value</th><th>Change</th></tr>
          ${kpiRowsHtml}
        </table>

        <h2>${isAdmin || isReceptionist ? "Today's Appointments" : "My Appointments Today"}</h2>
        <table border="1" cellpadding="6" cellspacing="0">
          <tr><th>Customer</th><th>Service</th><th>Time</th><th>Staff</th><th>Status</th></tr>
          ${apptRowsHtml || "<tr><td colspan=\"5\">No appointments</td></tr>"}
        </table>

        ${attHtml}
        ${topStaffHtml}
      </body>
      </html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard_${selectedDate}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Google Fonts (kept as a plain @import — Tailwind can't load external font files) */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500&display=swap');`}</style>

      <div className="flex h-screen overflow-hidden bg-[#f5f0e8] text-[#2c1f0e] font-['Jost',sans-serif]">
       {/* ── Sidebar (separate component) ── */}
        <Sidebar open={sidebarOpen} onClose={() => { setSidebarOpen(false); }} />

        {/* ── Main content ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Topbar */}
          <header className="relative flex h-auto min-h-[60px] flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#ede5d6] bg-white px-3 py-2 sm:h-[60px] sm:flex-nowrap sm:px-7 sm:py-0">
            <button
              className="flex rounded-md border-none bg-transparent p-1.5 text-[#8a7560] transition-colors hover:bg-[#f5f0e8] hover:text-[#1a1208]"
              onClick={() => { setSidebarOpen((v) => !v); }}
              aria-label="Toggle sidebar"
            >
              <Icon name="menu" size={18} />
            </button>

            <div className="hidden items-center gap-2 text-[13px] tracking-[0.04em] text-[#8a7560] sm:flex">
              Velvet CRM &nbsp;/&nbsp; <strong className="font-medium text-[#2c1f0e]">Dashboard</strong>
            </div>
            <div className="flex items-center text-[13px] tracking-[0.04em] text-[#2c1f0e] sm:hidden">
              <strong className="font-medium">Dashboard</strong>
            </div>

            {/* Role badge */}
            <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-[10px] font-medium uppercase tracking-[0.1em] ${roleBadgeClasses[role]}`}>
              {roleLabel[role]}
            </span>

           <div className="ml-auto flex max-w-full items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden sm:gap-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {lastUpdated && (
                <span className="hidden items-center gap-[5px] whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a7560] md:flex">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5a9e2f]" />
                  Live · updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <button
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#ede5d6] bg-[#faf8f4] text-[15px] leading-none text-[#6b5740] transition-colors hover:border-[#d4af37] hover:bg-[#f0e8d8]"
                  onClick={goPrevDay}
                  title="Previous day"
                  aria-label="Previous day"
                >
                  ‹
                </button>
                <span className="min-w-[110px] whitespace-nowrap text-center text-xs font-light tracking-[0.04em] text-[#8a7560] lg:min-w-[150px]">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                    weekday: "short", day: "numeric", month: "short", year: "numeric",
                  })}
                  {isToday && <span className="ml-1.5 rounded-full bg-[#eaf3de] px-1.5 py-px text-[9px] font-medium uppercase tracking-[0.08em] text-[#3b6d11]">Today</span>}
                </span>
                <button
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#ede5d6] bg-[#faf8f4] text-[15px] leading-none text-[#6b5740] transition-colors hover:border-[#d4af37] hover:bg-[#f0e8d8] disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={goNextDay}
                  disabled={isToday}
                  title="Next day"
                  aria-label="Next day"
                >
                  ›
                </button>
              </div>
              <button
                className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-[#ede5d6] bg-[#faf8f4] px-2.5 text-[#6b5740] transition-colors hover:border-[#d4af37] hover:bg-[#f0e8d8]"
                onClick={downloadExcel}
                title="Download Excel report"
                aria-label="Download Excel report"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
                <span className="hidden text-[10px] font-medium uppercase tracking-[0.08em] sm:inline">Excel</span>
              </button>
              <button
                className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-[#ede5d6] bg-[#faf8f4] px-2.5 text-[#6b5740] transition-colors hover:border-[#d4af37] hover:bg-[#f0e8d8]"
                onClick={downloadWord}
                title="Download Word report"
                aria-label="Download Word report"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
                <span className="hidden text-[10px] font-medium uppercase tracking-[0.08em] sm:inline">Word</span>
              </button>
              <button
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#ede5d6] bg-[#faf8f4] text-[#6b5740] transition-colors hover:border-[#d4af37] hover:bg-[#f0e8d8]"
                onClick={() => { void fetchDashboardData(true); }}
                title="Refresh data"
                aria-label="Refresh data"
              >
                <span className={refreshing ? "animate-spin [animation-duration:0.9s]" : ""}>
                  <Icon name="refresh" size={16} />
                </span>
              </button>

              {/* ── CRM Notifications bell (dashboard-only) ── */}
              {showNotifications && (
                <div className="relative" ref={notifRef}>
                  <button
                    className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#ede5d6] bg-[#faf8f4] text-[#6b5740] transition-colors hover:border-[#d4af37] hover:bg-[#f0e8d8]"
                    onClick={() => { setNotifOpen(v => !v); }}
                    title="CRM Notifications"
                    aria-label="CRM Notifications"
                  >
                    <Icon name="bell" size={16} />
                    {notifTotal > 0 && (
                      <span
                        className={`absolute -right-[5px] -top-[5px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-white px-1 text-[9px] font-semibold text-white ${
                          notifUrgentTotal === 0 ? "bg-[#d4af37]" : "bg-[#c0392b]"
                        }`}
                      >
                        {notifTotal > 99 ? "99+" : notifTotal}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                   <div className="fixed left-3 right-3 top-[104px] z-[200] overflow-hidden rounded-2xl border border-[#ede5d6] bg-white shadow-[0_16px_48px_rgba(26,18,8,0.18)] sm:left-auto sm:right-5 sm:top-[64px] sm:w-[380px] sm:max-w-[calc(100vw-40px)]">
                      <div className="flex items-center justify-between border-b border-[#f0e8d8] px-[18px] pb-3 pt-4">
                        <div>
                          <div className="font-['Cormorant_Garamond',serif] text-[19px] text-[#1a1208]">CRM Notifications</div>
                          <div className="mt-0.5 text-[11px] text-[#8a7560]">
                            {loading ? "Loading…" : `${String(notifTotal)} item${notifTotal !== 1 ? "s" : ""} need attention`}
                          </div>
                        </div>
                      </div>

                                            <div
                        className="flex gap-1 overflow-x-auto border-b border-[#f0e8d8] px-3.5 py-2.5 [&::-webkit-scrollbar]:hidden"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                      >
                        {NOTIF_ORDER.map((key) => {
                          const cfg = NOTIF_CFG[key];
                          const count = notifications[key].length;
                          const active = notifTab === key;
                          return (
                            <button
                              key={key}
                              className={`flex flex-shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[10px] font-medium tracking-[0.04em] transition-all ${
                                active ? "border-transparent" : "border-[#ede5d6] bg-[#faf8f4] text-[#6b5740]"
                              }`}
                              style={active ? { background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}40` } : undefined}
                              onClick={() => { setNotifTab(key); }}
                            >
                              <Icon name={cfg.icon} size={12} />
                              {cfg.label.replace("Upcoming ", "")}
                              <span
                                className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-black/[0.06] px-1 text-[9px] font-semibold"
                                style={active ? { background: `${cfg.color}20`, color: cfg.color } : undefined}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="max-h-80 overflow-y-auto px-2 py-1.5">
                        {notifications[notifTab].length === 0 ? (
                          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center text-xs font-light text-[#8a7560]">
                            <span className="opacity-35"><Icon name={NOTIF_CFG[notifTab].icon} size={26} /></span>
                            <span>No {NOTIF_CFG[notifTab].label.toLowerCase()} right now.</span>
                            {notifTab === "anniversaries" && (
                              <span className="text-[10.5px] text-[#c5b89a]">
                                Add an anniversary date field to customer records to populate this.
                              </span>
                            )}
                          </div>
                        ) : (
                          notifications[notifTab].map((n) => (
                            <div key={n.id} className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] transition-colors hover:bg-[#faf8f4]">
                              <div
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-['Cormorant_Garamond',serif] text-[11px] font-medium text-white"
                                style={{ background: avatarColor(n.name) }}
                              >
                                {n.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[12.5px] font-normal text-[#1a1208]">{n.name}</div>
                                <div className={`mt-px text-[10.5px] ${n.urgent ? "font-medium text-[#c0392b]" : "text-[#8a7560]"}`}>
                                  {n.detail}
                                </div>
                              </div>
                              {n.phone && (
                                <a
                                  className="ml-auto flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[7px] border border-[#ede5d6] bg-[#faf5e8] text-[#8a7560] no-underline"
                                  href={`tel:${n.phone}`}
                                  title={`Call ${n.phone}`}
                                  onClick={(e) => { e.stopPropagation(); }}
                                >
                                  <Icon name="phone" size={12} />
                                </a>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!showNotifications && (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#ede5d6] bg-[#faf8f4] text-[#6b5740]">
                  <Icon name="bell" size={16} />
                </div>
              )}

              {/* Receptionist and admin can create bookings */}
              {/* {(isAdmin || isReceptionist) && (
                <button className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border-none bg-[#1a1208] px-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#d4af37] transition-colors hover:bg-[#2d2010] sm:px-4">
                  <Icon name="plus" size={14} />
                  <span className="hidden sm:inline">New Booking</span>
                </button>
              )} */}
            </div>
          </header>

          {apiError && (
            <div className="flex flex-shrink-0 items-center gap-2 border-b border-[#f5c6c6] bg-[#fff5f5] px-4 py-2.5 text-xs text-[#c0392b] sm:px-7">
              ⚠ {apiError}
              <button className="ml-auto border-none bg-transparent text-[#c0392b]" onClick={() => { setApiError(""); }}>
                <Icon name="down" size={12} />
              </button>
            </div>
          )}

          {/* Scrollable content */}
          <main className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-7 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>

            {/* ── Staff-only welcome banner ── */}
            {!isAdmin && !isReceptionist && (
              <div className="flex flex-col items-start gap-4 rounded-xl border border-[#d4af37]/20 bg-gradient-to-br from-[#1a1208] to-[#2d2010] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div>
                  <h3 className="mb-1 font-['Cormorant_Garamond',serif] text-2xl font-light text-[#f5ecd4]">
                    Good day, <em className="italic text-[#d4af37]">{user?.name.split(" ")[0]}</em>
                  </h3>
                  <p className="text-[13px] font-light tracking-[0.04em] text-[#f5ecd4]/50">
                    Here are your appointments for today.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="font-['Cormorant_Garamond',serif] text-[40px] font-light leading-none text-[#d4af37]">
                    {loading ? "…" : visibleAppointments.length}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.1em] text-[#f5ecd4]/40">Your Bookings</div>
                </div>
              </div>
            )}

            {/* ── KPI Cards ── */}
            {visibleKpis.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4">
                {visibleKpis.map((k) => (
                  <div
                    key={k.label}
                    className="flex flex-col gap-3 rounded-xl border border-[#ede5d6] bg-white px-4 py-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(44,31,14,0.08)] sm:px-[22px] sm:py-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[#ede5d6] bg-[#faf5e8] text-[#b8860b]">
                        <Icon name={k.icon} size={18} />
                      </div>
                      <span className={`flex items-center gap-[3px] rounded-full px-2 py-[3px] text-xs font-medium ${
                        k.up ? "bg-[#eaf3de] text-[#3b6d11]" : "bg-[#fcebeb] text-[#a32d2d]"
                      }`}>
                        <Icon name={k.up ? "up" : "down"} size={10} />
                        {k.change}
                      </span>
                    </div>
                    <div className="font-['Cormorant_Garamond',serif] text-[28px] font-normal leading-none text-[#1a1208] sm:text-[32px]">
                      {k.value}
                    </div>
                    <div className="text-xs font-light uppercase tracking-[0.06em] text-[#8a7560]">
                      {k.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Revenue Charts — admin & receptionist only ── */}
            {(isAdmin || isReceptionist) && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">

                {/* Revenue chart */}
                <div className="rounded-xl border border-[#ede5d6] bg-white px-4 py-4 sm:px-6 sm:py-[22px]">
                  <div className="mb-5 flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
                    <div>
                      <div className="font-['Cormorant_Garamond',serif] text-xl font-normal text-[#1a1208]">Revenue Overview</div>
                      <div className="mt-0.5 text-xs font-light tracking-[0.04em] text-[#8a7560]">
                        {chartMode === "weekly" ? "Last 7 days" : "Last 6 months"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className={`rounded-md border px-3.5 py-[5px] text-[11px] font-medium uppercase tracking-[0.08em] transition-all ${
                          chartMode === "weekly" ? "border-[#1a1208] bg-[#1a1208] text-[#d4af37]" : "border-[#ede5d6] bg-[#faf8f4] text-[#8a7560]"
                        }`}
                        onClick={() => { setChartMode("weekly"); }}
                      >Weekly</button>
                      <button
                        className={`rounded-md border px-3.5 py-[5px] text-[11px] font-medium uppercase tracking-[0.08em] transition-all ${
                          chartMode === "monthly" ? "border-[#1a1208] bg-[#1a1208] text-[#d4af37]" : "border-[#ede5d6] bg-[#faf8f4] text-[#8a7560]"
                        }`}
                        onClick={() => { setChartMode("monthly"); }}
                      >Monthly</button>
                    </div>
                  </div>
                  {loading ? (
                    <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">Loading revenue…</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#d4af37" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#f0ead8" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey={chartKey}
                          tick={{ fontSize: 11, fill: "#8a7560", fontFamily: "'Jost', sans-serif" }}
                          axisLine={false} tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#8a7560", fontFamily: "'Jost', sans-serif" }}
                          axisLine={false} tickLine={false}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                          width={48}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone" dataKey="revenue"
                          stroke="#d4af37" strokeWidth={2}
                          fill="url(#revenueGrad)"
                          dot={{ r: 3, fill: "#d4af37", strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: "#b8860b", strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Service mix bar chart */}
                <div className="rounded-xl border border-[#ede5d6] bg-white px-4 py-4 sm:px-6 sm:py-[22px]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="font-['Cormorant_Garamond',serif] text-xl font-normal text-[#1a1208]">Service Mix</div>
                      <div className="mt-0.5 text-xs font-light tracking-[0.04em] text-[#8a7560]">Today's bookings</div>
                    </div>
                  </div>
                  {loading ? (
                    <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">Loading…</div>
                  ) : derived.serviceMix.length === 0 ? (
                    <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">No bookings today yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        layout="vertical"
                        data={derived.serviceMix}
                        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid stroke="#f0ead8" strokeDasharray="3 3" horizontal={false} />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "#8a7560", fontFamily: "'Jost', sans-serif" }}
                          axisLine={false} tickLine={false}
                        />
                        <YAxis
                          type="category" dataKey="name" width={52}
                          tick={{ fontSize: 12, fill: "#6b5740", fontFamily: "'Jost', sans-serif" }}
                          axisLine={false} tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(212,175,55,0.06)" }}
                          contentStyle={{
                            background: "#1a1208", border: "1px solid rgba(212,175,55,0.3)",
                            borderRadius: 8, fontFamily: "'Jost', sans-serif",
                            fontSize: 13, color: "#f5ecd4",
                          }}
                          labelStyle={{ color: "#d4af37", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}
                        />
                        <Bar dataKey="count" fill="#d4af37" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

           {/* ── Bottom Row ── */}
            <div className={`grid gap-4 ${isAdmin ? "grid-cols-1 lg:grid-cols-[1fr_320px]" : "grid-cols-1"}`}>

              {/* Today's appointments */}
              <div className="rounded-xl border border-[#ede5d6] bg-white px-4 py-4 sm:px-6 sm:py-[22px]">
                <div className="mb-5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-['Cormorant_Garamond',serif] text-xl font-normal text-[#1a1208]">
                      {isAdmin || isReceptionist ? "Today's Appointments" : "My Appointments Today"}
                    </div>
                    <div className="mt-0.5 text-xs font-light tracking-[0.04em] text-[#8a7560]">
                      {loading ? "Loading…" : `${String(visibleAppointments.length)} bookings`}
                    </div>
                  </div>
                  {(isAdmin || isReceptionist) && (
                    <Link
                      to="/appointments"
                      className="flex-shrink-0 text-xs font-normal tracking-[0.06em] text-[#b8860b] no-underline"
                    >
                      View all →
                    </Link>
                  )}
                </div>

                {loading ? (
                  <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">Loading appointments…</div>
                ) : visibleAppointments.length === 0 ? (
                  <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">No appointments scheduled for today.</div>
                ) : (
                  <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[480px] border-collapse">
                    <thead>
                      <tr>
                        <th className="border-b border-[#ede5d6] px-3 pb-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#8a7560]">Customer</th>
                        <th className="border-b border-[#ede5d6] px-3 pb-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#8a7560]">Time</th>
                        {(isAdmin || isReceptionist) && (
                          <th className="border-b border-[#ede5d6] px-3 pb-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#8a7560]">Staff</th>
                        )}
                        <th className="border-b border-[#ede5d6] px-3 pb-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#8a7560]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAppointments.map((a) => {
                        const s = statusStyle[a.status];
                        return (
                          <tr key={a._id} className="group">
                            <td className="border-b border-[#f5f0e8] px-3 py-3 align-middle group-hover:bg-[#fdfbf7]">
                              <div className="text-[13px] font-normal text-[#2c1f0e]">{a.customer}</div>
                              <div className="mt-0.5 text-xs text-[#8a7560]">{a.service}</div>
                            </td>
                            <td className="whitespace-nowrap border-b border-[#f5f0e8] px-3 py-3 align-middle text-[13px] font-normal text-[#2c1f0e] group-hover:bg-[#fdfbf7]">
                              {fmtTime12(a.time)}
                            </td>
                            {(isAdmin || isReceptionist) && (
                              <td className="border-b border-[#f5f0e8] px-3 py-3 align-middle text-[13px] font-light text-[#6b5740] group-hover:bg-[#fdfbf7]">
                                {a.staffName}
                              </td>
                            )}
                            <td className="border-b border-[#f5f0e8] px-3 py-3 align-middle group-hover:bg-[#fdfbf7]">
                              <span
                                className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-normal tracking-[0.04em]"
                                style={{ background: s.bg, color: s.color }}
                              >
                                {s.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>

              {/* Top staff — admin only */}
              {isAdmin && (
                <div className="rounded-xl border border-[#ede5d6] bg-white px-4 py-4 sm:px-6 sm:py-[22px]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="font-['Cormorant_Garamond',serif] text-xl font-normal text-[#1a1208]">Top Staff</div>
                      <div className="mt-0.5 text-xs font-light tracking-[0.04em] text-[#8a7560]">This month</div>
                    </div>
                  </div>
                  {loading ? (
                    <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">Loading…</div>
                  ) : derived.topStaff.length === 0 ? (
                    <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">No billed services yet this month.</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {derived.topStaff.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-[10px] border border-[#f0e8d8] bg-[#fdfbf7] p-3 transition-colors hover:border-[#d4af37]">
                          <div
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#ede5d6] text-xs font-medium tracking-[0.05em]"
                           style={{ background: `${String(s.color)}22`, color: s.color }}
                          >
                            {s.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-normal text-[#1a1208]">
                              {i === 0 && (
                                <span className="mr-1.5 rounded-full border border-[#ede5d6] bg-[#faf5e8] px-1.5 py-px text-[9px] font-medium uppercase tracking-[0.1em] text-[#b8860b]">
                                  Top
                                </span>
                              )}
                              {s.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#8a7560]">{String(s.servicesCount)} service{s.servicesCount !== 1 ? "s" : ""}</div>
                          </div>
                          <div className="ml-auto flex-shrink-0 text-right">
                            <div className="text-[13px] font-medium text-[#1a1208]">{fmtCur(s.revenue)}</div>
                            <div className="mt-0.5 flex items-center justify-end gap-[3px] text-[11px] text-[#b8860b]">
                              <Icon name="star" size={11} />
                              {s.ratingAvg !== null ? s.ratingAvg.toFixed(1) : "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Staff Attendance + Staff Roles — admin & receptionist only ── */}
            {(isAdmin || isReceptionist) && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                {/* Staff Attendance */}
                <div className="rounded-xl border border-[#ede5d6] bg-white px-4 py-4 sm:px-6 sm:py-[22px]">
                  <div className="mb-5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-['Cormorant_Garamond',serif] text-xl font-normal text-[#1a1208]">Staff Attendance</div>
                      <div className="mt-0.5 text-xs font-light tracking-[0.04em] text-[#8a7560]">
                        {isToday
                          ? "Today"
                          : new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                    <Link
                      to="/staff"
                      className="flex-shrink-0 text-xs font-normal tracking-[0.06em] text-[#b8860b] no-underline"
                    >
                      View all →
                    </Link>
                  </div>
                  {loading ? (
                    <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">Loading attendance…</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          { label: "Present",  value: attendanceSummary.present, color: "#15803d", bg: "#f0fdf4" },
                          { label: "Late",     value: attendanceSummary.late,    color: "#1d4ed8", bg: "#eff6ff" },
                          { label: "Half Day", value: attendanceSummary.halfDay, color: "#b45309", bg: "#fffbeb" },
                          { label: "Absent",   value: attendanceSummary.absent,  color: "#b91c1c", bg: "#fef2f2" },
                        ].map((s) => (
                          <div key={s.label} className="rounded-lg px-3 py-3 text-center" style={{ background: s.bg }}>
                            <div className="font-['Cormorant_Garamond',serif] text-2xl font-normal" style={{ color: s.color }}>
                              {s.value}
                            </div>
                            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: s.color }}>
                              {s.label}
                            </div>
                          </div>
                        ))}
                      </div>
                      {attendanceSummary.notMarked > 0 && (
                        <div className="mt-3 text-[11px] font-light tracking-[0.03em] text-[#8a7560]">
                          {attendanceSummary.notMarked} staff not yet marked
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Staff Roles */}
                <div className="rounded-xl border border-[#ede5d6] bg-white px-4 py-4 sm:px-6 sm:py-[22px]">
                  <div className="mb-5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-['Cormorant_Garamond',serif] text-xl font-normal text-[#1a1208]">Staff Roles</div>
                      <div className="mt-0.5 text-xs font-light tracking-[0.04em] text-[#8a7560]">Active team members</div>
                    </div>
                    <Link
                      to="/roles"
                      className="flex-shrink-0 text-xs font-normal tracking-[0.06em] text-[#b8860b] no-underline"
                    >
                      View all →
                    </Link>
                  </div>
                  {loading ? (
                    <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">Loading roles…</div>
                  ) : roleSummary.length === 0 ? (
                    <div className="p-8 text-center text-[13px] font-light tracking-[0.04em] text-[#8a7560]">No active staff yet.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {roleSummary.map((r) => (
                        <div
                          key={r.role}
                          className="flex items-center gap-2 rounded-full px-3 py-1.5"
                          style={{ background: r.bg }}
                        >
                          <span className="text-[11px] font-medium tracking-[0.04em]" style={{ color: r.color }}>
                            {r.label}
                          </span>
                          <span
                            className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                            style={{ background: r.color }}
                          >
                            {r.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}