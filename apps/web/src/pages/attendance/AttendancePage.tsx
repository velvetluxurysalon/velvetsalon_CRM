import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../context/AuthContext";

// ─── Import shared types & helpers from Staffrole ───────────────────────────
// AttendancePage reads staff from the SAME endpoint as Staffrole (/api/staff-roles)
// so adding/editing a member in either page is immediately visible in both.
import {
  type StaffMember,
  type StaffRole,
  type StaffStatus,
  API_STAFF,
  authHeaders,
  todayStr,
  avatarColor,
  initials,
  getRoleCfg,
} from "../staff/Staffrole";

// ─── Local types ─────────────────────────────────────────────────────────────
type AttendanceStatus = "present" | "absent" | "half-day" | "late" | "holiday";

interface AttendanceRecord {
  staffId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
}

interface SalaryCredit {
  id: string;
  staffId: string;
  amount: number;
  date: string;
  note?: string;
  period: string;
}

// NEW: Timer ON/OFF records from the Reception page's shift-attendance system
interface ShiftAttendanceRecord {
  _id: string;
  staffId: string;
  date: string;
  timerOnTime?: string;
  timerOffTime?: string;
  totalWorkingMinutes?: number;
}

interface DaySummary {
  present: number;
  absent: number;
  halfDay: number;
  late: number;
}

// NEW: minimal shapes needed for appointment + billing counts (mirrors Staffreview.tsx)
interface BillItemLite {
  serviceId: string;
  serviceName: string;
  staffId: string;
  price: number;
  duration: number;
}

interface SavedBillLite {
  _id: string;
  items: BillItemLite[];
  subtotal: number;
  total: number;
  status: "paid" | "pending";
  createdAt: string;
}

type ApptStatusLite = "confirmed" | "in-progress" | "completed" | "cancelled" | "pending" | "billed";

interface AppointmentLite {
  _id: string;
  staff: string;
  date: string;
  status: ApptStatusLite;
}

// ─── Static config ────────────────────────────────────────────────────────────
const ATT_CFG: Record<AttendanceStatus, { label: string; color: string; bg: string; short: string }> = {
  present:    { label: "Present",  color: "#15803d", bg: "#f0fdf4", short: "P"  },
  absent:     { label: "Absent",   color: "#b91c1c", bg: "#fef2f2", short: "A"  },
  "half-day": { label: "Half Day", color: "#b45309", bg: "#fffbeb", short: "H"  },
  late:       { label: "Late",     color: "#1d4ed8", bg: "#eff6ff", short: "L"  },
  holiday:    { label: "Holiday",  color: "#7c3aed", bg: "#f5f3ff", short: "HO" },
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// NEW: after this hour (24h, local time), anyone with no attendance record for
// today gets auto-marked Absent. Matches ReceptionPage's FIXED_SHIFT end time (20:00).
const AUTO_ABSENT_CUTOFF_HOUR = 20;

const SWATCH_COLORS = [
  "#d4af37","#b8860b","#8a7050","#6b5740",
  "#a0522d","#8b4513","#cd853f","#daa520",
  "#b8732b","#9c6b3c",
];

// ─── API helpers ──────────────────────────────────────────────────────────────
const APIS = {
 attendance:   `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/attendance`,
  salary:       `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/salary`,
  // NEW
  bills:        `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/bills?limit=500`,
  appointments: `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/appointments`,
  // NEW: same shift-attendance collection ReceptionPage.tsx reads/writes Timer ON/OFF to
  shiftAttendance: `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/shift-attendance`,
};

// NEW: mirrors ReceptionPage.tsx's FIXED_SHIFT — same fixed 08:00–20:00
// working-hours window/id used for every Timer ON call across the app.
const FIXED_SHIFT_ID = "689ffa10c19729de860ea01f";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: authHeaders() });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ message: res.statusText }))) as { message?: string };
    throw new Error(err.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// NEW
const fmtDuration = (mins: number) => {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return `${String(h)}h ${String(m)}m`;
};

// NEW: display-only — turns a stored 24h "HH:MM" string (e.g. "09:00") into
// 12h format (e.g. "9:00 AM"). Does not touch the stored value or the
// <input type="time"> in the edit modal, which still needs 24h "HH:MM".
const fmtTime12 = (hhmm?: string) => {
  if (!hhmm) return hhmm;
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = parts[1] ?? "00";
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12)}:${m} ${period}`;
};

// NEW: 12h clock time from a shift-attendance ISO timestamp (e.g. "5:11 PM"),
// used as a fallback checkout display when the day-level record's own
// checkOut hasn't synced yet.
const fmtIsoTime12 = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const paths: Record<string, string> = {
    calendar: "M3 4h18v18H3zM3 10h18M8 2v4M16 2v4",
    check:    "M20 6L9 17l-5-5",
    x:        "M18 6L6 18M6 6l12 12",
    chevL:    "M15 18l-6-6 6-6",
    chevR:    "M9 18l6-6-6-6",
    clock:    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
    user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    edit:     "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z",
    save:     "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
    refresh:  "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    grid:     "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    list:     "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    plus:     "M12 5v14M5 12h14",
    trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    rupee:    "M6 3h12M6 8h12M15 3a9 9 0 0 1 0 18H6M6 21l9-18",
    slash:    "M18 6L6 18",
    people:   "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    phone:    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {(paths[n] ?? "").split("M").filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
    </svg>
  );
};

// ─── Staff avatar (local, uses imported helpers) ──────────────────────────────
const StaffAvatar = ({ member, size = 32 }: { member: StaffMember; size?: number }) => (
  <div
    className="rounded-full flex items-center justify-center text-white flex-shrink-0 font-['Cormorant_Garamond']"
    style={{
      width: size, height: size, fontSize: size * 0.38,
      background: member.color || avatarColor(member.name),
      opacity: member.status === "inactive" ? 0.55 : 1,
    }}
  >
    {initials(member.name || "?")}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin"; // receptionist/staff get restricted date access below

  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode]   = useState<"calendar" | "list" | "salary">("calendar");

  // ── Core state ──
const [records, setRecords]         = useState<AttendanceRecord[]>([]);
const [staffList, setStaffList]     = useState<StaffMember[]>([]);
const [salaryCredits, setSalaryCredits] = useState<SalaryCredit[]>([]);
// NEW
const [bills, setBills]             = useState<SavedBillLite[]>([]);
const [appointments, setAppointments] = useState<AppointmentLite[]>([]);
// NEW: Timer ON/OFF records for the visible month
const [shiftRecords, setShiftRecords] = useState<ShiftAttendanceRecord[]>([]);

  const [saving, setSaving]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [staffLoading, setStaffLoading] = useState(true);
  const [apiError, setApiError]       = useState("");

  // ── Modals ──
  const [editModal, setEditModal]   = useState<{ staffId: string; record: Partial<AttendanceRecord> } | null>(null);
  const [staffModal, setStaffModal] = useState<{
    mode: "add" | "edit";
    staff: Partial<StaffMember & { terminatedDate?: string }>;
  } | null>(null);
  const [salaryModal, setSalaryModal] = useState<{ staffId: string; credit: Partial<SalaryCredit> } | null>(null);
  const [salaryDownloadRange, setSalaryDownloadRange] = useState<"monthly" | "weekly" | "yearly">("monthly");

  // ── Fetch staff from SHARED endpoint (same as Staffrole.tsx) ──────────────
  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const data = await apiFetch<StaffMember[]>(API_STAFF);
      setStaffList(data);
    } catch (e) {
      setApiError("Failed to load staff: " + (e as Error).message);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  const fetchSalary = useCallback(async () => {
  try {
    const data = await apiFetch<SalaryCredit[]>(APIS.salary);
    setSalaryCredits(data);
  } catch (e) {
    setApiError("Failed to load salary: " + (e as Error).message);
  }
}, []);

// NEW: bills (all-time, filtered by month client-side, same pattern as salary)
const fetchBills = useCallback(async () => {
  try {
    const data = await apiFetch<SavedBillLite[]>(APIS.bills);
    setBills(data);
  } catch (e) {
    setApiError("Failed to load bills: " + (e as Error).message);
  }
}, []);

// NEW: appointments for the visible month
const fetchAppointments = useCallback(async () => {
  try {
    const daysInMo = getDaysInMonth(viewYear, viewMonth);
    const from = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const to   = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(daysInMo).padStart(2, "0")}`;
    const data = await apiFetch<AppointmentLite[]>(`${APIS.appointments}?from=${from}&to=${to}`);
    setAppointments(data);
  } catch (e) {
    setApiError("Failed to load appointments: " + (e as Error).message);
  }
}, [viewYear, viewMonth]);

// NEW: Timer ON/OFF records for the visible month.
// /api/shift-attendance only accepts a single ?date=YYYY-MM-DD (same as
// ReceptionPage.tsx), so we fetch one day at a time and merge the results.
const fetchShiftRecords = useCallback(async () => {
  try {
    const daysInMo = getDaysInMonth(viewYear, viewMonth);
    const dateStrs = Array.from({ length: daysInMo }, (_, i) =>
      `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
    );
    const results = await Promise.all(
      dateStrs.map(d =>
        apiFetch<ShiftAttendanceRecord[]>(`${APIS.shiftAttendance}?date=${d}`).catch(() => [] as ShiftAttendanceRecord[])
      )
    );
    setShiftRecords(results.flat());
  } catch (e) {
    setApiError("Failed to load timer data: " + (e as Error).message);
  }
}, [viewYear, viewMonth]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const daysInMo = getDaysInMonth(viewYear, viewMonth);
      const from = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-01`;
      const to   = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(daysInMo).padStart(2, "0")}`;
      const data = await apiFetch<AttendanceRecord[]>(`${APIS.attendance}?from=${from}&to=${to}`);
      setRecords(data);
    } catch (e) {
      setApiError("Failed to load attendance: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

useEffect(() => { void fetchStaff(); void fetchSalary(); void fetchBills(); }, [fetchStaff, fetchSalary, fetchBills]);
useEffect(() => { void fetchRecords(); void fetchAppointments(); void fetchShiftRecords(); }, [fetchRecords, fetchAppointments, fetchShiftRecords]);

// NEW: auto-mark Absent for anyone with no attendance record on a day that's
// fully over — every past day in the visible month, plus today itself once
// it's past AUTO_ABSENT_CUTOFF_HOUR (8 PM). Runs against whatever month is
// currently loaded into `records`, so it backfills old blank days too.
useEffect(() => {
  if (staffLoading || loading) return;
  const now = new Date();

  // NEW: computed locally — getDaysInMonth is defined above this effect,
  // but the component's `daysInMonth` const is declared further down the
  // file, so referencing it here hits the temporal dead zone.
  const lastDayToCheck = getDaysInMonth(viewYear, viewMonth);
  for (let d = 1; d <= lastDayToCheck; d++) {
    const dStr = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    if (dStr > todayStr) break; // future day — nothing to do yet
    if (dStr === todayStr && now.getHours() < AUTO_ABSENT_CUTOFF_HOUR) break; // today, but shift not over yet

    staffList
      .filter(s => s.status === "active" && isActiveOn(s, dStr))
      .forEach(s => {
        if (!getRecord(s._id, dStr)) {
          void quickMark(s._id, dStr, "absent");
        }
      });
  }
}, [staffList, records, viewYear, viewMonth, staffLoading, loading]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  // A staff member is "active on" a date if the date is within their employment window.
  // We use joinDate / exitDate from the unified StaffMember shape.
   const isActiveOn = (s: StaffMember, date: string) => {
    if (s.joinDate && date < s.joinDate) return false;
    // exitDate is set when status === "inactive"
    if (s.status === "inactive" && s.exitDate && date > s.exitDate) return false;
    return true;
  };

  // NEW: Admins can view any date and edit any date. Receptionist/Staff can
  // view up to today (no future dates) and can only edit today — past days
  // are read-only for them. This is UI-level only: the automatic Absent
  // backfill effect calls quickMark() directly, not through these gates,
  // so it keeps working the same regardless of who's logged in.
  const canAccessDate = (date: string) => isAdmin || date <= todayStr;
  const canEditDate    = (date: string) => isAdmin || date === todayStr;

  const activeStaffForDate = (date: string) => staffList.filter(s => isActiveOn(s, date));

  const getRecord = (staffId: string, date: string) =>
    records.find(r => r.staffId === staffId && r.date === date);

  const upsertRecord = (rec: AttendanceRecord) => {
    setRecords(prev => {
      const idx = prev.findIndex(r => r.staffId === rec.staffId && r.date === rec.date);
      if (idx >= 0) { const n = [...prev]; n[idx] = rec; return n; }
      return [...prev, rec];
    });
  };

  // ── Attendance mutations ──────────────────────────────────────────────────
   // NEW: starts a Timer ON session in shift-attendance the moment someone is
  // marked Present here, so ReceptionPage shows them as on duty without a
  // separate manual clock-in. Fire-and-forget — never blocks or fails the
  // actual attendance save above it.
  const startTimerOnForPresent = async (staffId: string, date: string) => {
    try {
      await apiFetch(`${APIS.shiftAttendance}/timer-on`, {
        method: "POST",
        body: JSON.stringify({ staffId, shiftId: FIXED_SHIFT_ID, date }),
      });
    } catch {
      // non-critical — reception can still clock them in manually
    }
  };

  const quickMark = async (staffId: string, date: string, status: AttendanceStatus) => {
    const s = staffList.find(m => m._id === staffId);
    if (!s || !isActiveOn(s, date)) return;
    const key = `${staffId}-${date}`;
    setSaving(key);
   const rec: AttendanceRecord = {
  staffId, date, status,
  ...(status === "present" || status === "late" ? { checkIn: "08:00" } : {}),
  ...(status === "present" ? { checkOut: "20:00" } : {}),
};
       upsertRecord(rec);
    try {
      await apiFetch(APIS.attendance, { method: "POST", body: JSON.stringify(rec) });
    } catch (e) {
      setApiError("Failed to save: " + (e as Error).message);
    } finally {
      setSaving(null);
    }
    // NEW: only for Present, and only for TODAY. The backend always stamps
    // timerOnTime as server "now" regardless of what `date` we send — so
    // marking a PAST date Present (a backfill or manual edit) would create
    // a ShiftAttendance record keyed to that old date but "on duty" as of
    // right now, with no timerOffTime ever coming to close it out.
    if (status === "present" && date === todayStr) {
      void startTimerOnForPresent(staffId, date);
    }
  };

  const cycleStatus = (staffId: string, date: string) => {
    const s = staffList.find(m => m._id === staffId);
    if (!s || !isActiveOn(s, date)) return;
    const order: AttendanceStatus[] = ["present", "late", "half-day", "absent", "holiday"];
const cur  = getRecord(staffId, date)?.status;
const next = cur ? (order[(order.indexOf(cur) + 1) % order.length] ?? "present") : "present";
void quickMark(staffId, date, next);
  };

  const saveEdit = async () => {
    if (!editModal) return;
    const rec = editModal.record as AttendanceRecord;
    upsertRecord(rec);
    try {
      await apiFetch(APIS.attendance, { method: "POST", body: JSON.stringify(rec) });
    } catch (e) {
      setApiError("Failed to save: " + (e as Error).message);
    }
    setEditModal(null);
  };

  // ── Staff mutations — write to SHARED /api/staff-roles ───────────────────
  const saveStaffModal = async () => {
    if (!staffModal?.staff.name?.trim()) return;
    const s = staffModal.staff;
    try {
      if (staffModal.mode === "add") {
        const created = await apiFetch<StaffMember>(API_STAFF, {
          method: "POST",
          body: JSON.stringify({
            name:       (s.name ?? "").trim(),
            phone:      s.phone      ?? "",
            email:      s.email      ?? "",
            role:       s.role       ?? "stylist",
            speciality: s.speciality ?? "",
            status:     "active",
            joinDate:   s.joinDate   ?? todayStr,
            exitDate:   "",
            notes:      "",
            color:      s.color      ?? avatarColor((s.name ?? "").trim()),
            salary:     s.salary     ?? 0,
            salaryMode: s.salaryMode ?? "monthly",
          } satisfies Omit<StaffMember, "_id">),
        });
        setStaffList(prev => [...prev, created]);
     } else {
        if (!s._id) return;
        // edit — PUT to shared endpoint, preserving all existing fields
        const updated = await apiFetch<StaffMember>(`${API_STAFF}/${s._id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...s,
            color: s.color || avatarColor(s.name ?? ""),
          }),
        });
        setStaffList(prev => prev.map(x => x._id === updated._id ? updated : x));
      }
    } catch (e) {
      setApiError("Failed to save staff: " + (e as Error).message);
    }
    setStaffModal(null);
  };

  const deleteStaff = async (id: string) => {
    if (!window.confirm("Permanently delete this staff member? All attendance data will be removed.")) return;
    try {
      await apiFetch(`${API_STAFF}/${id}`, { method: "DELETE" });
      setStaffList(prev => prev.filter(s => s._id !== id));
      setRecords(prev => prev.filter(r => r.staffId !== id));
      setSalaryCredits(prev => prev.filter(c => c.staffId !== id));
    } catch (e) {
      setApiError("Failed to delete: " + (e as Error).message);
    }
  };

  // Mark inactive (terminate) via shared endpoint
  const terminateStaff = async (s: StaffMember, exitDate: string) => {
    try {
      const updated = await apiFetch<StaffMember>(`${API_STAFF}/${s._id}`, {
        method: "PUT",
        body: JSON.stringify({ ...s, status: "inactive" as StaffStatus, exitDate }),
      });
      setStaffList(prev => prev.map(x => x._id === updated._id ? updated : x));
    } catch (e) {
      setApiError("Failed to terminate: " + (e as Error).message);
    }
  };

  // ── Salary mutations ─────────────────────────────────────────────────────
  const saveSalaryModal = async () => {
    if (!salaryModal) return;
    const c = salaryModal.credit;
    if (!c.amount || !c.date) return;
    try {
      const created = await apiFetch<SalaryCredit>(APIS.salary, {
        method: "POST",
        body: JSON.stringify({
          staffId: salaryModal.staffId,
          amount:  c.amount,
          date:    c.date,
          note:    c.note ?? "",
          period:  c.period ?? `${MONTHS[viewMonth] ?? ""} ${String(viewYear)}`,
        }),
      });
      setSalaryCredits(prev => [...prev, created]);
    } catch (e) {
      setApiError("Failed to credit salary: " + (e as Error).message);
    }
    setSalaryModal(null);
  };

  const deleteSalaryCredit = async (id: string) => {
    try {
      await apiFetch(`${APIS.salary}/${id}`, { method: "DELETE" });
      setSalaryCredits(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      setApiError("Failed to delete credit: " + (e as Error).message);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalCreditedForStaff = (staffId: string) =>
    salaryCredits.filter(c => c.staffId === staffId).reduce((a, c) => a + c.amount, 0);

  const creditedThisMonth = (staffId: string) => {
    const prefix = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}`;
    return salaryCredits
      .filter(c => c.staffId === staffId && c.date.startsWith(prefix))
      .reduce((a, c) => a + c.amount, 0);
  };

  const daysInMonth     = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfMonth = getFirstDayOfMonth(viewYear, viewMonth);

  const daySummary = (date: string): DaySummary => {
    const recs = records.filter(r => r.date === date);
    return {
      present: recs.filter(r => r.status === "present").length,
      absent:  recs.filter(r => r.status === "absent").length,
      halfDay: recs.filter(r => r.status === "half-day").length,
      late:    recs.filter(r => r.status === "late").length,
    };
  };

  const staffMonthSummary = (staffId: string) => {
    const s      = staffList.find(x => x._id === staffId);
    const prefix = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}`;
    let activeDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${prefix}-${String(d).padStart(2, "0")}`;
      if (s && isActiveOn(s, dStr)) activeDays++;
    }
    const m = records.filter(r => r.staffId === staffId && r.date.startsWith(prefix));
    return {
    present:    m.filter(r => r.status === "present").length,
    absent:     m.filter(r => r.status === "absent").length,
    halfDay:    m.filter(r => r.status === "half-day").length,
    late:       m.filter(r => r.status === "late").length,
    total:      activeDays,
  };
};

// NEW: appointments done + billing revenue for a staff member, for the visible month
const staffBookingSummary = (staffId: string) => {
  const prefix = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthBills = bills.filter(b => b.createdAt.startsWith(prefix));

  let revenue = 0;
  let servicesBilled = 0;
  monthBills.forEach(b => {
    // Ratio of what the customer actually paid vs the raw subtotal —
    // captures membership discount, manual/coupon discount, and loyalty redemption together.
    const payRatio = b.subtotal > 0 ? b.total / b.subtotal : 1;
    b.items.forEach(it => {
      if (it.staffId === staffId) {
        revenue += Math.round(it.price * payRatio);
        servicesBilled += 1;
      }
    });
  });

  const apptList      = appointments.filter(a => a.staff === staffId);
  const apptTotal      = apptList.length;
  const apptCompleted  = apptList.filter(a => a.status === "completed").length;
  const apptCancelled  = apptList.filter(a => a.status === "cancelled").length;

  return { revenue, servicesBilled, apptTotal, apptCompleted, apptCancelled };
};

 // NEW: minutes worked for one Timer ON/OFF record (an open session counts up to now)
const shiftRecordMinutes = (rec: ShiftAttendanceRecord) => {
  if (!rec.timerOnTime) return 0;
  if (rec.totalWorkingMinutes != null) return rec.totalWorkingMinutes;
  const end = rec.timerOffTime ?? new Date().toISOString();
  return Math.max(0, (new Date(end).getTime() - new Date(rec.timerOnTime).getTime()) / 60000);
};

// NEW: total Timer ON/OFF hours for a staff member in the visible month
const staffTimerMinutesMonth = (staffId: string) => {
  const prefix = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}`;
  return shiftRecords
    .filter(r => r.staffId === staffId && r.date.startsWith(prefix))
    .reduce((a, r) => a + shiftRecordMinutes(r), 0);
};

// NEW: this staff member's Timer ON/OFF record for one specific day
const getShiftRecord = (staffId: string, date: string) =>
  shiftRecords.find(r => r.staffId === staffId && r.date === date);

// NEW: tooltip text for a single day's timer cell — "Timer: 08:02 AM – 05:11 PM (9h 9m)"
const shiftDayTooltip = (staffId: string, date: string) => {
  const rec = getShiftRecord(staffId, date);
  if (!rec?.timerOnTime) return null;
  const t = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const onStr  = t(rec.timerOnTime);
  const offStr = rec.timerOffTime ? t(rec.timerOffTime) : "still on duty";
  return `Timer: ${onStr} – ${offStr} (${fmtDuration(shiftRecordMinutes(rec))})`;
};

const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const selectedDayRecords = activeStaffForDate(selectedDate).map(s => ({
    staff: s,
    record: getRecord(s._id, selectedDate),
  }));

  // ── CSV export ────────────────────────────────────────────────────────────
  const downloadCSV = (range: "monthly" | "weekly" | "yearly") => {
    const rows: string[][] = [];
    const header = ["Staff","Role","Date","Status","Check In","Check Out","Notes","Salary Credited"];
    const makeRows = (from: string, to: string) => {
      staffList.forEach(s => {
        const filtered = records.filter(r => r.staffId === s._id && r.date >= from && r.date <= to);
        const credited = salaryCredits
          .filter(c => c.staffId === s._id && c.date >= from && c.date <= to)
          .reduce((a, c) => a + c.amount, 0);
        if (filtered.length === 0) {
          rows.push([s.name, s.role, `${from} to ${to}`, "-", "-", "-", "-", String(credited)]);
        } else {
          filtered.forEach((r, i) => rows.push([
            s.name, s.role, r.date, r.status,
            r.checkIn ?? "", r.checkOut ?? "", r.notes ?? "",
            i === 0 ? String(credited) : "",
          ]));
        }
      });
    };
    if (range === "monthly") {
      makeRows(
        `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-01`,
        `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`,
      );
    } else if (range === "yearly") {
      makeRows(`${String(viewYear)}-01-01`, `${String(viewYear)}-12-31`);
    } else {
      const now = new Date(); const day = now.getDay(); const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(now); mon.setDate(now.getDate() + diff);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      makeRows(mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10));
    }
    const csv  = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `attendance_${range}_${String(viewYear)}${range === "monthly" ? `_${String(viewMonth + 1).padStart(2, "0")}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Excel export (same row logic as CSV, .xlsx output) ────────────────────
  const downloadExcel = (range: "monthly" | "weekly" | "yearly") => {
    const rows: string[][] = [];
    const header = ["Staff","Role","Date","Status","Check In","Check Out","Notes","Salary Credited"];
    const makeRows = (from: string, to: string) => {
      staffList.forEach(s => {
        const filtered = records.filter(r => r.staffId === s._id && r.date >= from && r.date <= to);
        const credited = salaryCredits
          .filter(c => c.staffId === s._id && c.date >= from && c.date <= to)
          .reduce((a, c) => a + c.amount, 0);
        if (filtered.length === 0) {
          rows.push([s.name, s.role, `${from} to ${to}`, "-", "-", "-", "-", String(credited)]);
        } else {
          filtered.forEach((r, i) => rows.push([
            s.name, s.role, r.date, r.status,
            r.checkIn ?? "", r.checkOut ?? "", r.notes ?? "",
            i === 0 ? String(credited) : "",
          ]));
        }
      });
    };
    if (range === "monthly") {
      makeRows(
        `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-01`,
        `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`,
      );
    } else if (range === "yearly") {
      makeRows(`${String(viewYear)}-01-01`, `${String(viewYear)}-12-31`);
    } else {
      const now = new Date(); const day = now.getDay(); const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(now); mon.setDate(now.getDate() + diff);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      makeRows(mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10));
    }
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `attendance_${range}_${String(viewYear)}${range === "monthly" ? `_${String(viewMonth + 1).padStart(2, "0")}` : ""}.xlsx`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .at-page{display:flex;flex-direction:column;height:100%;background:#f5f0e8;font-family:'Jost',sans-serif;color:#2c1f0e;overflow:hidden}
        .at-topbar{height:60px;background:#fff;border-bottom:1px solid #ede5d6;display:flex;align-items:center;padding:0 28px;gap:14px;flex-shrink:0}
        .at-page-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208}
        .at-topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px}
        .at-err{background:#fff5f5;border-bottom:1px solid #f5c6c6;padding:9px 28px;font-size:12px;color:#c0392b;display:flex;align-items:center;gap:8px;flex-shrink:0}
        .at-err button{margin-left:auto;background:none;border:none;cursor:pointer;color:#c0392b;display:flex}
        .at-body{display:grid;grid-template-columns:1fr 320px;flex:1;overflow:hidden;min-height:0}
        .at-left{overflow-y:auto;padding:22px 20px 22px 28px;display:flex;flex-direction:column;gap:16px;min-width:0;scrollbar-width:none;-ms-overflow-style:none}
.at-left::-webkit-scrollbar{display:none}
        .at-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;overflow:hidden}
        .at-ch{padding:14px 18px;border-bottom:1px solid #f0e8d8;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
        .at-ct{font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#8a7560;display:flex;align-items:center;gap:7px}
        .at-cb{padding:18px}
        .at-btn{height:36px;padding:0 16px;border:none;border-radius:8px;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .18s}
        .at-btn-primary{background:#1a1208;color:#d4af37}.at-btn-primary:hover{background:#2d2010}
        .at-btn-secondary{background:#faf8f4;border:1px solid #ede5d6;color:#6b5740}.at-btn-secondary:hover{border-color:#d4af37;background:#fffdf5}
        .at-btn-gold{background:#d4af37;color:#1a1208}.at-btn-gold:hover{background:#c9a227}
        .at-btn-danger{background:#fef2f2;border:1px solid #fca5a5;color:#b91c1c}.at-btn-danger:hover{background:#fee2e2}
        .at-btn-sm{height:30px;padding:0 12px;font-size:10px}
        .at-icon-btn{width:30px;height:30px;border:1px solid #ede5d6;border-radius:7px;background:#faf8f4;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b5740;transition:all .15s}
        .at-icon-btn:hover{border-color:#d4af37;color:#b8860b}
        .at-icon-btn-danger{border-color:#fca5a5;color:#b91c1c}.at-icon-btn-danger:hover{border-color:#b91c1c;background:#fef2f2}
        .at-month-nav{display:flex;align-items:center;gap:10px}
        .at-month-label{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:400;color:#1a1208;min-width:180px;text-align:center}
        .at-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
        .at-cal-day-hdr{text-align:center;font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#8a7560;padding:6px 0}
        .at-cal-cell{min-height:72px;border:1px solid #f0e8d8;border-radius:8px;padding:6px;cursor:pointer;transition:all .15s}
        .at-cal-cell:hover{border-color:#d4af37;background:#fffdf5}
        .at-cal-cell.today{border-color:#d4af37;background:#fffdf5}
        .at-cal-cell.selected{border-color:#1a1208;background:#faf5e8;box-shadow:0 0 0 1px #1a1208}
        .at-cal-cell.empty{background:transparent;border-color:transparent;cursor:default}
        .at-cal-cell.empty:hover{background:transparent;border-color:transparent}
        .at-cal-date{font-size:11px;font-weight:500;color:#2c1f0e;margin-bottom:4px}
        .at-cal-cell.today .at-cal-date{color:#b8860b;font-weight:600}
        .at-cal-summary{display:flex;gap:3px;flex-wrap:wrap;margin-top:4px}
        .at-cal-mini{font-size:9px;font-weight:500;padding:1px 5px;border-radius:10px}
        .at-sum-tbl{width:100%;border-collapse:collapse}
        .at-sum-tbl th{font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#8a7560;padding:0 0 10px;text-align:left}
        .at-sum-tbl th.r,.at-sum-tbl td.r{text-align:center}
        .at-sum-tbl td{padding:10px 0;border-top:1px solid #f5f0e8;vertical-align:middle}
        .at-sum-tbl tr:first-child td{border-top:none}
        .at-staff-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:12px;color:#fff;flex-shrink:0}
        .at-pct-bar-wrap{width:80px;height:6px;background:#f0e8d8;border-radius:10px;overflow:hidden}
        .at-pct-bar{height:6px;border-radius:10px;background:#d4af37;transition:width .4s ease}
        .at-stat-badge{font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px;display:inline-block}
        .at-inactive-tag{font-size:9px;font-weight:600;padding:2px 7px;border-radius:10px;background:#f5f0e8;color:#6b5740;letter-spacing:.05em;text-transform:uppercase}
        .at-right{background:#fff;border-left:1px solid #ede5d6;display:flex;flex-direction:column;overflow:hidden;min-height:0}
        .at-rpanel-hd{padding:18px 20px 14px;border-bottom:1px solid #f0e8d8;flex-shrink:0}
        .at-rpanel-title{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:400;color:#1a1208}
        .at-rpanel-sub{font-size:11px;color:#8a7560;margin-top:2px}
       .at-rpanel-scroll{flex:1;overflow-y:auto;padding:16px 20px;scrollbar-width:none;-ms-overflow-style:none}
.at-rpanel-scroll::-webkit-scrollbar{display:none}
        .at-staff-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f5f0e8}
        .at-staff-row:last-child{border-bottom:none}
        .at-staff-info{flex:1;min-width:0}
        .at-status-cycle{display:flex;gap:5px;flex-wrap:wrap}
        .at-status-btn{height:26px;padding:0 10px;border-radius:20px;border:1.5px solid transparent;font-family:'Jost',sans-serif;font-size:10px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
        .at-cur-status{font-size:11px;font-weight:500;padding:3px 10px;border-radius:20px;letter-spacing:.05em}
        .at-day-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px}
        .at-day-stat{padding:12px 14px;border:1px solid #ede5d6;border-radius:10px;background:#faf8f4}
        .at-day-stat-val{font-family:'Cormorant Garamond',serif;font-size:28px;color:#1a1208;line-height:1}
        .at-day-stat-lbl{font-size:10px;color:#8a7560;font-weight:500;letter-spacing:.1em;text-transform:uppercase;margin-top:3px}
        .at-legend{display:flex;gap:10px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid #f0e8d8;flex-shrink:0}
        .at-legend-item{display:flex;align-items:center;gap:5px;font-size:10px;color:#6b5740;font-weight:500}
        .at-legend-dot{width:8px;height:8px;border-radius:50%}
        .at-staff-mgmt-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f5f0e8}
        .at-staff-mgmt-row:last-child{border-bottom:none}
        .at-staff-actions{display:flex;gap:6px;margin-left:auto;flex-shrink:0}
        .at-salary-row{padding:12px 0;border-bottom:1px solid #f5f0e8}
        .at-salary-row:last-child{border-bottom:none}
        .at-salary-item{display:flex;align-items:center;justify-content:space-between;padding:6px 0;font-size:12px}
        .at-overlay{position:fixed;inset:0;background:rgba(26,18,8,.5);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;animation:at-fade .2s ease}
        .at-modal{background:#fff;border-radius:14px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(26,18,8,.25);animation:at-slide .25s ease;max-height:90vh;overflow-y:auto}
        .at-modal-hd{padding:20px 24px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f0e8d8;position:sticky;top:0;background:#fff;z-index:1}
        .at-modal-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208}
        .at-modal-body{padding:18px 24px 24px;display:flex;flex-direction:column;gap:14px}
        .at-form-lbl{font-size:10px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#6b5740;margin-bottom:5px}
        .at-form-sel{height:38px;border:1px solid #e0d5c0;border-radius:8px;background:#fff;padding:0 12px;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e;outline:none;width:100%;appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;transition:border-color .2s}
        .at-form-sel:focus{border-color:#d4af37}
        .at-form-inp{height:38px;border:1px solid #e0d5c0;border-radius:8px;background:#fff;padding:0 12px;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e;outline:none;width:100%;transition:border-color .2s}
        .at-form-inp:focus{border-color:#d4af37}
        .at-modal-footer{display:flex;gap:8px;padding:0 24px 20px}
        .at-color-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
        .at-color-swatch{width:26px;height:26px;border-radius:50%;cursor:pointer;border:2.5px solid transparent;transition:all .15s}
        .at-color-swatch.sel{border-color:#1a1208;transform:scale(1.15)}
        .at-dl-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 18px;border-top:1px solid #f0e8d8;background:#faf8f4;flex-shrink:0}
        .at-spin{width:14px;height:14px;border:2px solid rgba(212,175,55,.3);border-top-color:#d4af37;border-radius:50%;animation:at-spin .7s linear infinite;flex-shrink:0}
        .at-empty{font-size:12px;color:#8a7560;text-align:center;padding:32px 0}
        .at-role-tag{font-size:9px;font-weight:600;padding:2px 7px;border-radius:10px;letter-spacing:.05em;text-transform:uppercase}
        @keyframes at-fade{from{opacity:0}to{opacity:1}}
        @keyframes at-slide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes at-spin{to{transform:rotate(360deg)}}

        /* ══════════════ RESPONSIVE ══════════════
           Layout only — no functional/behavioural changes below this line. */

        /* Tablet: keep two columns but narrow the right rail */
        @media (max-width: 1024px) {
          .at-body{grid-template-columns:1fr 260px}
          .at-left{padding:18px 16px}
        }

        /* Phone / narrow viewport: stack right panel under the main column,
           let the whole body scroll instead of two independent scroll panes. */
        @media (max-width: 780px) {
          .at-body{display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden}
          .at-left{overflow-y:visible;padding:14px 12px;gap:12px}
          .at-right{overflow-y:visible;border-left:none;border-top:1px solid #ede5d6}
          .at-rpanel-scroll{overflow-y:visible}

          .at-topbar{height:auto;min-height:52px;padding:8px 14px;flex-wrap:wrap;gap:8px}
          .at-page-title{font-size:18px}
          .at-topbar-right{width:100%;margin-left:0;flex-wrap:wrap;gap:6px}
          .at-err{padding:8px 14px;font-size:11px}

          .at-ch{padding:12px 14px}
          .at-cb{padding:12px}
          .at-ct{font-size:9px}

          .at-month-nav{gap:6px}
          .at-month-label{min-width:0;font-size:15px}

          .at-cal-grid{gap:3px}
          .at-cal-day-hdr{font-size:9px;padding:4px 0}
          .at-cal-cell{min-height:44px;padding:3px;border-radius:6px}
          .at-cal-date{font-size:9px;margin-bottom:2px}
          .at-cal-mini{font-size:7px;padding:0 3px;border-radius:8px}

          /* let wide tables scroll horizontally instead of squeezing columns */
          .at-cb{overflow-x:auto}
          .at-sum-tbl{min-width:520px}

          .at-day-stats{gap:6px;margin-bottom:12px}
          .at-day-stat{padding:9px 10px}
          .at-day-stat-val{font-size:22px}
          .at-day-stat-lbl{font-size:9px}

          .at-rpanel-hd{padding:14px 14px 10px}
          .at-rpanel-title{font-size:18px}
          .at-rpanel-scroll{padding:12px 14px}

          .at-legend{padding:10px 14px;gap:8px;justify-content:space-between}
.at-legend-item{font-size:9px;flex:1;justify-content:center}
          .at-dl-bar{padding:10px 14px}

          .at-modal-body{padding:14px 16px 20px}
          .at-modal-hd{padding:16px 16px 12px}
          .at-modal-footer{padding:0 16px 16px}

          .at-status-cycle{gap:4px;width:100%;justify-content:space-between}
.at-status-btn{height:24px;padding:0 8px;font-size:9px;flex:1;text-align:center}
        }

        /* Very small phones */
        @media (max-width: 380px) {
          .at-page-title{font-size:16px}
          .at-btn-sm{height:28px;padding:0 9px;font-size:9px}
          .at-cal-cell{min-height:38px}
          .at-day-stats{grid-template-columns:1fr 1fr}
        }
      `}</style>

      <div className="at-page">
        {/* TOPBAR */}
        <header className="at-topbar">
          <div className="at-page-title">Attendance</div>
          <div className="at-topbar-right">
            {(["calendar", "list", "salary"] as const).map(m => (
              <button key={m}
                className={`at-btn at-btn-secondary at-btn-sm${viewMode === m ? " at-btn-gold" : ""}`}
                onClick={() => { setViewMode(m); }}>
                <Ic n={m === "calendar" ? "grid" : m === "list" ? "list" : "rupee"} s={13} />
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          <button className="at-btn at-btn-secondary at-btn-sm"
  onClick={() => { void fetchRecords(); void fetchStaff(); void fetchSalary(); void fetchBills(); void fetchAppointments(); void fetchShiftRecords(); }}>
              {loading ? <div className="at-spin" /> : <Ic n="refresh" s={13} />}
            </button>
          </div>
        </header>

        {apiError && (
          <div className="at-err">⚠ {apiError}
            <button onClick={() => { setApiError(""); }}><Ic n="x" s={14} /></button>
          </div>
        )}

        <div className="at-body">
          <div className="at-left">

            {/* CALENDAR */}
            {viewMode === "calendar" && (
              <div className="at-card">
                <div className="at-ch">
                  <div className="at-ct"><Ic n="calendar" s={13} />Monthly Calendar</div>
                  <div className="at-month-nav">
                    <button className="at-icon-btn" onClick={prevMonth}><Ic n="chevL" s={14} /></button>
                    <div className="at-month-label">{MONTHS[viewMonth]} {viewYear}</div>
                    <button className="at-icon-btn" onClick={nextMonth}><Ic n="chevR" s={14} /></button>
                  </div>
                </div>
                <div className="at-cb">
                  <div className="at-cal-grid">
                    {DAYS.map(d => <div key={d} className="at-cal-day-hdr">{d}</div>)}
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
  <div key={`e${i.toString()}`} className="at-cal-cell empty" />
))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day  = i + 1;
                      const dStr = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const s    = daySummary(dStr);
                      const has  = (s.present + s.absent + s.halfDay + s.late) > 0;
                                            const selectable = canAccessDate(dStr);
                      return (
                        <div key={dStr}
                          className={`at-cal-cell${dStr === todayStr ? " today" : ""}${dStr === selectedDate ? " selected" : ""}`}
                          style={{ opacity: selectable ? 1 : 0.4, cursor: selectable ? "pointer" : "not-allowed" }}
                          onClick={() => { if (selectable) setSelectedDate(dStr); }}>
                          <div className="at-cal-date">{day}</div>
                          {has && (
                            <div className="at-cal-summary">
                              {s.present > 0 && <span className="at-cal-mini" style={{ background: "#f0fdf4", color: "#15803d" }}>{s.present}P</span>}
                              {s.late    > 0 && <span className="at-cal-mini" style={{ background: "#eff6ff", color: "#1d4ed8" }}>{s.late}L</span>}
                              {s.halfDay > 0 && <span className="at-cal-mini" style={{ background: "#fffbeb", color: "#b45309" }}>{s.halfDay}H</span>}
                              {s.absent  > 0 && <span className="at-cal-mini" style={{ background: "#fef2f2", color: "#b91c1c" }}>{s.absent}A</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* LIST */}
            {viewMode === "list" && (
              <div className="at-card">
                <div className="at-ch">
                  <div className="at-ct"><Ic n="list" s={13} />Staff Overview — {MONTHS[viewMonth]} {viewYear}</div>
                  <div className="at-month-nav">
                    <button className="at-icon-btn" onClick={prevMonth}><Ic n="chevL" s={14} /></button>
                    <span style={{ fontSize: 13, color: "#8a7560" }}>{MONTHS[viewMonth]}</span>
                    <button className="at-icon-btn" onClick={nextMonth}><Ic n="chevR" s={14} /></button>
                  </div>
                </div>
                <div className="at-cb">
                  {staffLoading ? (
                    <div className="at-empty"><div className="at-spin" style={{ margin: "0 auto" }} /></div>
                  ) : staffList.length === 0 ? (
                    <div className="at-empty">No staff found. Add members in Staff &amp; Roles to get started.</div>
                  ) : (
                    <table className="at-sum-tbl">
  <thead><tr>
    <th>Staff</th>
    <th className="r">Present</th><th className="r">Late</th>
    <th className="r">Half Day</th><th className="r">Absent</th>
    <th className="r">Attendance %</th>
    {/* NEW columns */}
   <th className="r">Appointments</th>
    <th className="r">Revenue (Bills)</th>
    <th className="r">Timer Hours</th>
  </tr></thead>
 <tbody>
  {staffList.map(s => {
    const sm  = staffMonthSummary(s._id);
    const bs  = staffBookingSummary(s._id);
    const pct = sm.total > 0
      ? Math.round(((sm.present + sm.halfDay * 0.5 + sm.late) / sm.total) * 100)
      : 0;
    const rc  = getRoleCfg(s.role);
    return (
      <tr key={s._id} style={{ opacity: s.status === "inactive" ? 0.65 : 1 }}>
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StaffAvatar member={s} size={32} />
            <div>
              <div style={{ fontSize: 13, color: "#1a1208", display: "flex", alignItems: "center", gap: 8 }}>
                {s.name}
                {s.status === "inactive" && <span className="at-inactive-tag">Left</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                <span className="at-role-tag" style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
                {s.speciality && <span style={{ fontSize: 10, color: "#8a7560" }}>{s.speciality}</span>}
              </div>
            </div>
          </div>
        </td>
        <td className="r"><span className="at-stat-badge" style={{ background: "#f0fdf4", color: "#15803d" }}>{sm.present}</span></td>
        <td className="r"><span className="at-stat-badge" style={{ background: "#eff6ff", color: "#1d4ed8" }}>{sm.late}</span></td>
        <td className="r"><span className="at-stat-badge" style={{ background: "#fffbeb", color: "#b45309" }}>{sm.halfDay}</span></td>
        <td className="r"><span className="at-stat-badge" style={{ background: "#fef2f2", color: "#b91c1c" }}>{sm.absent}</span></td>
        <td className="r">
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <div className="at-pct-bar-wrap"><div className="at-pct-bar" style={{ width: `${pct.toString()}%` }} /></div>
            <span style={{ fontSize: 12, fontWeight: 500, minWidth: 32, color: pct >= 90 ? "#15803d" : pct >= 75 ? "#b45309" : "#b91c1c" }}>{pct}%</span>
          </div>
        </td>
        <td className="r">
          <div style={{ fontSize: 12, color: "#1a1208", fontWeight: 500 }}>{bs.apptTotal}</div>
          <div style={{ fontSize: 10, color: "#8a7560" }}>{bs.apptCompleted} completed</div>
        </td>
        <td className="r">
          <div style={{ fontSize: 12, color: "#1a1208", fontWeight: 500 }}>{fmtCurrency(bs.revenue)}</div>
          <div style={{ fontSize: 10, color: "#8a7560" }}>{bs.servicesBilled} service{bs.servicesBilled !== 1 ? "s" : ""}</div>
        </td>
        <td className="r">
          <div style={{ fontSize: 12, color: "#1a1208", fontWeight: 500 }}>{fmtDuration(staffTimerMinutesMonth(s._id))}</div>
          <div style={{ fontSize: 10, color: "#8a7560" }}>Timer ON/OFF</div>
        </td>
      </tr>
    );
  })}
</tbody>
</table>
                  )}
                </div>

                {/* NEW: download bar for List view */}
                <div className="at-dl-bar">
                  <span style={{ fontSize: 11, color: "#8a7560", fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase" }}>Download CSV:</span>
                  {(["monthly", "weekly", "yearly"] as const).map(r => (
                    <button key={`list-csv-${r}`}
                      className={`at-btn at-btn-secondary at-btn-sm${salaryDownloadRange === r ? " at-btn-gold" : ""}`}
                      onClick={() => { setSalaryDownloadRange(r); downloadCSV(r); }}>
                      <Ic n="download" s={12} />{r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, color: "#8a7560", fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", marginLeft: 12 }}>Download Excel:</span>
                  {(["monthly", "weekly", "yearly"] as const).map(r => (
                    <button key={`list-xlsx-${r}`}
                      className={`at-btn at-btn-secondary at-btn-sm${salaryDownloadRange === r ? " at-btn-gold" : ""}`}
                      onClick={() => { setSalaryDownloadRange(r); downloadExcel(r); }}>
                      <Ic n="download" s={12} />{r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SALARY */}
            {viewMode === "salary" && (
              <div className="at-card">
                <div className="at-ch">
                  <div className="at-ct"><Ic n="rupee" s={13} />Salary Ledger — {MONTHS[viewMonth]} {viewYear}</div>
                  <div className="at-month-nav">
                    <button className="at-icon-btn" onClick={prevMonth}><Ic n="chevL" s={14} /></button>
                    <span style={{ fontSize: 13, color: "#8a7560" }}>{MONTHS[viewMonth]}</span>
                    <button className="at-icon-btn" onClick={nextMonth}><Ic n="chevR" s={14} /></button>
                  </div>
                </div>
                <div className="at-cb">
                  {staffLoading ? (
                    <div className="at-empty"><div className="at-spin" style={{ margin: "0 auto" }} /></div>
                  ) : staffList.length === 0 ? (
                    <div className="at-empty">No staff found.</div>
                  ) : staffList.map(s => {
                    const sm = staffMonthSummary(s._id);
                    const earned =
                      s.salaryMode === "monthly" ? s.salary
                      : s.salaryMode === "daily"   ? s.salary * (sm.present + sm.late + sm.halfDay * 0.5)
                      :                              s.salary * (sm.present + sm.late) * 8;
                    const credited    = creditedThisMonth(s._id);
                    const balance     = earned - credited;
                    const prefix      = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}`;
                    const monthCredits = salaryCredits.filter(c => c.staffId === s._id && c.date.startsWith(prefix));
                    return (
                      <div key={s._id} className="at-salary-row">
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                          <StaffAvatar member={s} size={36} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1208", display: "flex", alignItems: "center", gap: 8 }}>
                              {s.name}
                              {s.status === "inactive" && <span className="at-inactive-tag">Left</span>}
                            </div>
                            <div style={{ fontSize: 10, color: "#8a7560" }}>
                              Base: {fmtCurrency(s.salary)}/{s.salaryMode === "monthly" ? "mo" : s.salaryMode === "daily" ? "day" : "hr"}
                            </div>
                          </div>
                          <button className="at-btn at-btn-secondary at-btn-sm"
                            onClick={() => { setSalaryModal({ staffId: s._id, credit: { date: todayStr, period: `${MONTHS[viewMonth] ?? ""} ${String(viewYear)}` } }); }}>
                            <Ic n="plus" s={12} />Credit
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
                          {[
                            { label: "Earned",   val: fmtCurrency(earned),   color: "#1a1208" },
                            { label: "Credited", val: fmtCurrency(credited), color: "#15803d" },
                            { label: "Balance",  val: fmtCurrency(balance),  color: balance > 0 ? "#b45309" : "#15803d" },
                          ].map(item => (
                            <div key={item.label} style={{ background: "#faf8f4", border: "1px solid #ede5d6", borderRadius: 8, padding: "8px 10px" }}>
                              <div style={{ fontSize: 10, color: "#8a7560", fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase" }}>{item.label}</div>
                              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: item.color, fontWeight: 600, marginTop: 2 }}>{item.val}</div>
                            </div>
                          ))}
                        </div>
                        {monthCredits.length > 0 && (
                          <div style={{ borderTop: "1px solid #f5f0e8", paddingTop: 8 }}>
                            {monthCredits.map(c => (
                              <div key={c.id} className="at-salary-item">
                                <div>
                                  <div style={{ fontWeight: 500, color: "#1a1208" }}>{fmtCurrency(c.amount)}</div>
                                  <div style={{ fontSize: 10, color: "#8a7560" }}>{fmtDate(c.date)}{c.note ? ` · ${c.note}` : ""}</div>
                                </div>
                                <button className="at-icon-btn at-icon-btn-danger" onClick={() => { void deleteSalaryCredit(c.id); }}>
                                  <Ic n="trash" s={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="at-dl-bar">
                  <span style={{ fontSize: 11, color: "#8a7560", fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase" }}>Download CSV:</span>
                  {(["monthly", "weekly", "yearly"] as const).map(r => (
                    <button key={r}
                      className={`at-btn at-btn-secondary at-btn-sm${salaryDownloadRange === r ? " at-btn-gold" : ""}`}
                      onClick={() => { setSalaryDownloadRange(r); downloadCSV(r); }}>
                      <Ic n="download" s={12} />{r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, color: "#8a7560", fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", marginLeft: 12 }}>Download Excel:</span>
                  {(["monthly", "weekly", "yearly"] as const).map(r => (
                    <button key={`xlsx-${r}`}
                      className={`at-btn at-btn-secondary at-btn-sm${salaryDownloadRange === r ? " at-btn-gold" : ""}`}
                      onClick={() => { setSalaryDownloadRange(r); downloadExcel(r); }}>
                      <Ic n="download" s={12} />{r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* HEATMAP */}
            {viewMode !== "salary" && (
              <div className="at-card">
                <div className="at-ch">
                  <div className="at-ct"><Ic n="star" s={13} />Staff × Day Heatmap</div>
                  <span style={{ fontSize: 11, color: "#8a7560" }}>{MONTHS[viewMonth]} {viewYear}</span>
                </div>
                <div className="at-cb" style={{ overflowX: "auto" }}>
                  {staffLoading ? (
                    <div className="at-empty"><div className="at-spin" style={{ margin: "0 auto" }} /></div>
                  ) : (
                    <>
                      <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a7560", padding: "0 8px 8px 0", textAlign: "left", minWidth: 110 }}>Staff</th>
                           {Array.from({ length: daysInMonth }).map((_, i) => {
                              const d    = i + 1;
                              const dStr = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                              return <th key={d} style={{ fontSize: 10, color: dStr === todayStr ? "#b8860b" : "#8a7560", fontWeight: dStr === todayStr ? 600 : 400, padding: "0 2px 8px", textAlign: "center", minWidth: 26 }}>{d}</th>;
                            })}
                            {/* NEW */}
                            <th style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a7560", padding: "0 0 8px 10px", textAlign: "center", minWidth: 70 }}>Timer Hrs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffList.map(s => (
                            <tr key={s._id}>
                              <td style={{ padding: "3px 8px 3px 0", verticalAlign: "middle" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                  <StaffAvatar member={s} size={24} />
                                  <span style={{ fontSize: 12, color: "#1a1208", whiteSpace: "nowrap" }}>{s.name}</span>
                                </div>
                              </td>
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const d      = i + 1;
                                const dStr   = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                                const active = isActiveOn(s, dStr);
                                const rec    = active ? getRecord(s._id, dStr) : null;
                                const cfg    = rec ? ATT_CFG[rec.status] : null;
                                const isLoad = saving === `${s._id}-${dStr}`;
                                // NEW: this day's timer tooltip, if a Timer ON/OFF record exists
                                const timerTip = active ? shiftDayTooltip(s._id, dStr) : null;
                                const baseTip  = !active ? "Not employed" : cfg ? cfg.label : "Click to mark";
                                return (
                                                                  <td key={d} style={{ padding: "3px 2px", textAlign: "center", verticalAlign: "middle" }}>
                                    <div
                                      title={!active ? baseTip : !canEditDate(dStr) ? "Only today's attendance can be edited" : timerTip ? `${baseTip}\n${timerTip}` : baseTip}
                                      onClick={() => { if (active && canEditDate(dStr)) cycleStatus(s._id, dStr); }}
                                      style={{
                                        width: 22, height: 22, borderRadius: 5,
                                        cursor: active && canEditDate(dStr) ? "pointer" : "not-allowed",
                                        background: !active ? "#f5f0e8" : cfg ? cfg.bg : "#f5f0e8",
                                        border: `1.5px solid ${!active ? "#e0d5c430" : cfg ? cfg.color + "60" : "#e5d8c4"}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        position: "relative",
                                        fontSize: 9, fontWeight: 600,
                                        color: !active ? "#d4c9b4" : cfg ? cfg.color : "#c5b89a",
                                        transition: "all .15s", margin: "0 auto",
                                        opacity: !active ? 0.4 : 1,
                                      }}
                                    >
                                      {isLoad
                                        ? <div style={{ width: 8, height: 8, border: "1.5px solid #d4af37", borderTopColor: "transparent", borderRadius: "50%", animation: "at-spin .7s linear infinite" }} />
                                        : !active ? "—" : cfg ? cfg.short : "·"}
                                      {/* NEW: tiny gold dot marks days that have Timer ON/OFF data */}
                                      {timerTip && (
                                        <span style={{ position: "absolute", bottom: 1, right: 1, width: 4, height: 4, borderRadius: "50%", background: "#d4af37" }} />
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              {/* NEW: monthly Timer ON/OFF total for this staff member */}
                              <td style={{ padding: "3px 0 3px 10px", textAlign: "center", verticalAlign: "middle", fontSize: 11, fontWeight: 500, color: "#1a1208", whiteSpace: "nowrap" }}>
                                {fmtDuration(staffTimerMinutesMonth(s._id))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {(Object.entries(ATT_CFG) as [AttendanceStatus, typeof ATT_CFG[AttendanceStatus]][]).map(([key, cfg]) => (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#6b5740", fontWeight: 500 }}>
                            <div style={{ width: 14, height: 14, borderRadius: 3, background: cfg.bg, border: `1.5px solid ${cfg.color}60`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: cfg.color, fontWeight: 700 }}>{cfg.short}</div>
                            {cfg.label}
                          </div>
                        ))}
                        <div style={{ fontSize: 10, color: "#8a7560", marginLeft: "auto" }}>— = not employed · click to cycle</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="at-right">
            {/* Staff management panel — shows members from shared /api/staff-roles */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0e8d8", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: "#8a7560", display: "flex", alignItems: "center", gap: 6 }}>
                  <Ic n="people" s={12} />Staff Members
                </div>
                <button className="at-btn at-btn-primary at-btn-sm"
                  onClick={() => { setStaffModal({
  mode: "add",
  staff: { joinDate: todayStr, salary: 0, salaryMode: "monthly", role: "stylist", color: SWATCH_COLORS[staffList.length % SWATCH_COLORS.length] ?? "#d4af37" },
}); }}>
                  <Ic n="plus" s={12} />Add Staff
                </button>
              </div>
             <div style={{ maxHeight: 200, overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }} className="[&::-webkit-scrollbar]:hidden">
                {staffLoading ? (
                  <div style={{ textAlign: "center", padding: "16px 0" }}><div className="at-spin" style={{ margin: "0 auto" }} /></div>
                ) : staffList.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#8a7560", textAlign: "center", padding: "12px 0" }}>No staff yet. Add someone!</div>
                ) : staffList.map(s => {
                  const rc = getRoleCfg(s.role);
                  return (
                    <div key={s._id} className="at-staff-mgmt-row">
                      <StaffAvatar member={s} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#1a1208", display: "flex", alignItems: "center", gap: 6 }}>
                          {s.name}
                          {s.status === "inactive" && <span className="at-inactive-tag">Left</span>}
                        </div>
                        <span className="at-role-tag" style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
                      </div>
                      <div className="at-staff-actions">
                        <button className="at-icon-btn" title="Edit"
                          onClick={() => { setStaffModal({ mode: "edit", staff: { ...s } }); }}>
                          <Ic n="edit" s={11} />
                        </button>
                        {s.status !== "inactive" && (
                          <button className="at-icon-btn" title="Mark as Left"
                            style={{ color: "#b45309", borderColor: "#fca5a5" }}
                            onClick={() => { void terminateStaff(s, todayStr); }}>
                            <Ic n="slash" s={11} />
                          </button>
                        )}
                        <button className="at-icon-btn at-icon-btn-danger" title="Delete"
                          onClick={() => { void deleteStaff(s._id); }}>
                          <Ic n="trash" s={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day panel */}
            <div className="at-rpanel-hd">
              <div className="at-rpanel-title">{selectedDate === todayStr ? "Today" : fmtDate(selectedDate)}</div>
              <div className="at-rpanel-sub">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>

            <div className="at-rpanel-scroll">
              {(() => {
                const s = daySummary(selectedDate);
                return (
                  <div className="at-day-stats">
                    <div className="at-day-stat"><div className="at-day-stat-val" style={{ color: "#15803d" }}>{s.present}</div><div className="at-day-stat-lbl">Present</div></div>
                    <div className="at-day-stat"><div className="at-day-stat-val" style={{ color: "#b91c1c" }}>{s.absent}</div><div className="at-day-stat-lbl">Absent</div></div>
                    <div className="at-day-stat"><div className="at-day-stat-val" style={{ color: "#1d4ed8" }}>{s.late}</div><div className="at-day-stat-lbl">Late</div></div>
                    <div className="at-day-stat"><div className="at-day-stat-val" style={{ color: "#b45309" }}>{s.halfDay}</div><div className="at-day-stat-lbl">Half Day</div></div>
                  </div>
                );
              })()}

              {selectedDayRecords.length === 0 && (
                <div style={{ fontSize: 12, color: "#8a7560", textAlign: "center", padding: "20px 0" }}>No active staff on this date.</div>
              )}
              {selectedDayRecords.map(({ staff: s, record }) => {
                const cfg = record ? ATT_CFG[record.status] : null;
                return (
                  <div key={s._id} className="at-staff-row">
                    <StaffAvatar member={s} size={32} />
                    <div className="at-staff-info">
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1208" }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: "#8a7560" }}>{getRoleCfg(s.role).label}{s.speciality ? ` · ${s.speciality}` : ""}</div>
                                           {record && (
                        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                          {cfg && <span className="at-cur-status" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>}
                          {record.checkIn && (() => {
                            // NEW: prefer the day-level checkOut; if it's missing
                            // (e.g. the Reception sync call failed silently),
                            // fall back to the shift-attendance Timer OFF time
                            // for the same staff/date so an end time still shows.
                            const shiftRec = getShiftRecord(s._id, selectedDate);
                            const fallbackCheckOut = shiftRec?.timerOffTime ? fmtIsoTime12(shiftRec.timerOffTime) : null;
                            const stillOnDuty = shiftRec?.timerOnTime && !shiftRec.timerOffTime;
                            const checkOutText = record.checkOut ? fmtTime12(record.checkOut) : fallbackCheckOut;
                            return (
                              <span style={{ fontSize: 10, color: "#8a7560", display: "flex", alignItems: "center", gap: 3 }}>
                                <Ic n="clock" s={10} />
                                {fmtTime12(record.checkIn)}
                                {checkOutText ? ` – ${checkOutText}` : stillOnDuty ? " – on duty" : ""}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                                            <div className="at-status-cycle" style={{ marginTop: 6 }}>
                        {(Object.entries(ATT_CFG) as [AttendanceStatus, typeof ATT_CFG[AttendanceStatus]][]).map(([key, c]) => (
                          <button key={key}
                            className={`at-status-btn${record?.status === key ? " active" : ""}`}
                            disabled={!canEditDate(selectedDate)}
                            title={!canEditDate(selectedDate) ? "Only today's attendance can be edited" : undefined}
                            style={{
                              background: record?.status === key ? c.bg : "transparent",
                              borderColor: record?.status === key ? c.color : "#e0d5c0",
                              color: record?.status === key ? c.color : "#8a7560",
                              opacity: canEditDate(selectedDate) ? 1 : 0.4,
                              cursor: canEditDate(selectedDate) ? "pointer" : "not-allowed",
                            }}
                            onClick={() => { if (canEditDate(selectedDate)) void quickMark(s._id, selectedDate, key); }}>
                            {c.short}
                          </button>
                        ))}
                        <button className="at-icon-btn"
                          disabled={!canEditDate(selectedDate)}
                          title={!canEditDate(selectedDate) ? "Only today's attendance can be edited" : "Edit"}
                          style={{ marginLeft: 2, opacity: canEditDate(selectedDate) ? 1 : 0.4, cursor: canEditDate(selectedDate) ? "pointer" : "not-allowed" }}
                          onClick={() => { if (canEditDate(selectedDate)) setEditModal({ staffId: s._id, record: record ?? { staffId: s._id, date: selectedDate, status: "present" } }); }}>
                          <Ic n="edit" s={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="at-legend">
              {(Object.entries(ATT_CFG) as [AttendanceStatus, typeof ATT_CFG[AttendanceStatus]][]).map(([key, cfg]) => (
                <div key={key} className="at-legend-item">
                  <div className="at-legend-dot" style={{ background: cfg.color }} />{cfg.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* EDIT ATTENDANCE MODAL */}
      {editModal && (
        <div className="at-overlay" onClick={() => { setEditModal(null); }}>
          <div className="at-modal" onClick={e => { e.stopPropagation(); }}>
            <div className="at-modal-hd">
              <div className="at-modal-title">Edit Attendance — {staffList.find(s => s._id === editModal.staffId)?.name}</div>
              <button className="at-icon-btn" onClick={() => { setEditModal(null); }}><Ic n="x" s={14} /></button>
            </div>
            <div className="at-modal-body">
              <div style={{ fontSize: 12, color: "#8a7560" }}>{fmtDate(editModal.record.date ?? selectedDate)}</div>
              <div>
                <div className="at-form-lbl">Status</div>
                <select className="at-form-sel" value={editModal.record.status ?? "present"}
                  onChange={e => { setEditModal(m => m ? { ...m, record: { ...m.record, status: e.target.value as AttendanceStatus } } : m); }}>
                  {(Object.entries(ATT_CFG) as [AttendanceStatus, typeof ATT_CFG[AttendanceStatus]][]).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="at-form-lbl">Check In</div>
                  <input type="time" className="at-form-inp" value={editModal.record.checkIn ?? ""}
                    onChange={e => { setEditModal(m => m ? { ...m, record: { ...m.record, checkIn: e.target.value } } : m); }} />
                </div>
                <div>
                  <div className="at-form-lbl">Check Out</div>
                  <input type="time" className="at-form-inp" value={editModal.record.checkOut ?? ""}
                    onChange={e => { setEditModal(m => m ? { ...m, record: { ...m.record, checkOut: e.target.value } } : m); }} />
                </div>
              </div>
              <div>
                <div className="at-form-lbl">Notes</div>
                <input type="text" className="at-form-inp" placeholder="Optional note…" value={editModal.record.notes ?? ""}
                  onChange={e => { setEditModal(m => m ? { ...m, record: { ...m.record, notes: e.target.value } } : m); }} />
              </div>
            </div>
            <div className="at-modal-footer">
              <button className="at-btn at-btn-secondary" style={{ flex: 1 }} onClick={() => { setEditModal(null); }}>Cancel</button>
              <button className="at-btn at-btn-primary"   style={{ flex: 1 }} onClick={() => { void saveEdit(); }}><Ic n="save" s={13} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT STAFF MODAL */}
      {staffModal && (
        <div className="at-overlay" onClick={() => { setStaffModal(null); }}>
          <div className="at-modal" onClick={e => { e.stopPropagation(); }}>
            <div className="at-modal-hd">
              <div className="at-modal-title">{staffModal.mode === "add" ? "Add Staff Member" : "Edit Staff Member"}</div>
              <button className="at-icon-btn" onClick={() => { setStaffModal(null); }}><Ic n="x" s={14} /></button>
            </div>
            <div className="at-modal-body">
              <div>
                <div className="at-form-lbl">Full Name *</div>
                <input type="text" className="at-form-inp" placeholder="e.g. Priya K."
                  value={staffModal.staff.name ?? ""}
                  onChange={e => { setStaffModal(m => m ? { ...m, staff: { ...m.staff, name: e.target.value } } : m); }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="at-form-lbl">Mobile</div>
                  <input type="text" className="at-form-inp" placeholder="10-digit"
                    value={staffModal.staff.phone ?? ""}
                    onChange={e => { setStaffModal(m => m ? { ...m, staff: { ...m.staff, phone: e.target.value } } : m); }} />
                </div>
                <div>
                  <div className="at-form-lbl">Role</div>
                  <select className="at-form-sel"
                    value={staffModal.staff.role ?? "stylist"}
                    onChange={e => { setStaffModal(m => m ? { ...m, staff: { ...m.staff, role: e.target.value as StaffRole } } : m); }}>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="senior_stylist">Senior Stylist</option>
                    <option value="stylist">Stylist</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="support">Support Staff</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="at-form-lbl">Speciality</div>
                  <input type="text" className="at-form-inp" placeholder="e.g. Hair & Colour"
                    value={staffModal.staff.speciality ?? ""}
                    onChange={e => { setStaffModal(m => m ? { ...m, staff: { ...m.staff, speciality: e.target.value } } : m); }} />
                </div>
                <div>
                  <div className="at-form-lbl">Joining Date</div>
                  <input type="date" className="at-form-inp" value={staffModal.staff.joinDate ?? todayStr}
                    onChange={e => { setStaffModal(m => m ? { ...m, staff: { ...m.staff, joinDate: e.target.value } } : m); }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="at-form-lbl">Base Salary (₹)</div>
                  <input type="number" className="at-form-inp" placeholder="0"
                    value={staffModal.staff.salary ?? ""}
                    onChange={e => { setStaffModal(m => m ? { ...m, staff: { ...m.staff, salary: Number(e.target.value) } } : m); }} />
                </div>
                <div>
                  <div className="at-form-lbl">Pay Mode</div>
                  <select className="at-form-sel"
                    value={staffModal.staff.salaryMode ?? "monthly"}
                    onChange={e => { setStaffModal(m => m ? { ...m, staff: { ...m.staff, salaryMode: e.target.value as StaffMember["salaryMode"] } } : m); }}>
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="at-form-lbl">Avatar Colour</div>
                <div className="at-color-row">
                  {SWATCH_COLORS.map(c => (
                    <div key={c}
                      className={`at-color-swatch${staffModal.staff.color === c ? " sel" : ""}`}
                      style={{ background: c }}
                      onClick={() => { setStaffModal(m => m ? { ...m, staff: { ...m.staff, color: c } } : m); }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="at-modal-footer">
              <button className="at-btn at-btn-secondary" style={{ flex: 1 }} onClick={() => { setStaffModal(null); }}>Cancel</button>
              <button className="at-btn at-btn-primary"   style={{ flex: 1 }} onClick={() => { void saveStaffModal(); }}>
                <Ic n="save" s={13} /> {staffModal.mode === "add" ? "Add Staff" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SALARY CREDIT MODAL */}
      {salaryModal && (
        <div className="at-overlay" onClick={() => { setSalaryModal(null); }}>
          <div className="at-modal" onClick={e => { e.stopPropagation(); }}>
            <div className="at-modal-hd">
              <div className="at-modal-title">Credit Salary — {staffList.find(s => s._id === salaryModal.staffId)?.name}</div>
              <button className="at-icon-btn" onClick={() => { setSalaryModal(null); }}><Ic n="x" s={14} /></button>
            </div>
            <div className="at-modal-body">
              <div>
                <div className="at-form-lbl">Amount (₹) *</div>
                <input type="number" className="at-form-inp" placeholder="Enter amount"
                  value={salaryModal.credit.amount ?? ""}
                  onChange={e => { setSalaryModal(m => m ? { ...m, credit: { ...m.credit, amount: Number(e.target.value) } } : m); }} />
              </div>
              <div>
                <div className="at-form-lbl">Credit Date *</div>
                <input type="date" className="at-form-inp" value={salaryModal.credit.date ?? todayStr}
                  onChange={e => { setSalaryModal(m => m ? { ...m, credit: { ...m.credit, date: e.target.value } } : m); }} />
              </div>
              <div>
                <div className="at-form-lbl">Period</div>
                <input type="text" className="at-form-inp" placeholder={`${MONTHS[viewMonth] ?? ""} ${String(viewYear)}`}
                  value={salaryModal.credit.period ?? ""}
                  onChange={e => { setSalaryModal(m => m ? { ...m, credit: { ...m.credit, period: e.target.value } } : m); }} />
              </div>
              <div>
                <div className="at-form-lbl">Note (optional)</div>
                <input type="text" className="at-form-inp" placeholder="e.g. Advance, Bonus…"
                  value={salaryModal.credit.note ?? ""}
                  onChange={e => { setSalaryModal(m => m ? { ...m, credit: { ...m.credit, note: e.target.value } } : m); }} />
              </div>
              <div style={{ background: "#faf8f4", border: "1px solid #ede5d6", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "#8a7560", fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase" }}>Total Credited (All Time)</div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: "#15803d", fontWeight: 600, marginTop: 2 }}>
                  {fmtCurrency(totalCreditedForStaff(salaryModal.staffId))}
                </div>
              </div>
            </div>
            <div className="at-modal-footer">
              <button className="at-btn at-btn-secondary" style={{ flex: 1 }} onClick={() => { setSalaryModal(null); }}>Cancel</button>
              <button className="at-btn at-btn-primary"   style={{ flex: 1 }} onClick={() => { void saveSalaryModal(); }}><Ic n="check" s={13} /> Credit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}