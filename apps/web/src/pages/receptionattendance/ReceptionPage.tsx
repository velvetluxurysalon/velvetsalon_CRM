import { useState, useMemo, useEffect, useCallback } from "react";

/**
 * ReceptionPage.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Reception-facing attendance screen — simplified version.
 * Flow: Timer ON (records time) → optional services logged → Timer OFF
 * (records time) → status calculation (Present / Late / Half Day / Absent).
 *
 * Break / tea-break tracking has been removed entirely. Working time is
 * now simply timerOffTime − timerOnTime.
 *
 * Shift picking has been removed. There is ONE fixed working-hours window
 * for everyone: 08:00 AM – 08:00 PM (see FIXED_SHIFT below). Change the
 * startTime/endTime there if the hours ever need to move.
 *
 * Staff can Timer ON again after a Timer OFF — the Timer ON control is
 * shown any time they're not currently on duty, even after they've already
 * been marked Present / Late / Half Day / Absent for the day.
 *
 * ⚠️ API CONTRACT ASSUMED — adjust paths/payloads to match your actual
 * attendance.controller.ts if they differ:
 *   GET  /api/staff-roles                       -> StaffMember[]
 *   GET  /api/shift-attendance?date=YYYY-MM-DD   -> AttendanceRecord[]
 *   POST /api/shift-attendance/timer-on          { staffId, shiftId, date }
 *   POST /api/shift-attendance/:id/timer-off     {}
 *   POST /api/shift-attendance/:id/service       { type, customer }
 * All calls include the same Bearer token pattern used across the app.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ─── Types ─────────────────────────────────────────────────────────────────────
type StaffRole = "admin" | "manager" | "senior_stylist" | "stylist" | "receptionist" | "support";
type StaffStatus = "active" | "on_leave" | "inactive";

interface StaffMember {
  _id: string;
  name: string;
  phone: string;
  role: StaffRole;
  speciality: string;
  status: StaffStatus;
}

interface Shift {
  _id: string;
  name: string;          // "Morning" | "Evening" | "Night"
  startTime: string;     // "09:00"
  endTime: string;       // "17:00"
  graceMinutes: number;  // e.g. 15
  minWorkingHours: number;    // e.g. 8
  halfDayThresholdHours: number; // e.g. 6
}

interface ServiceEntry { _id: string; type: string; customer?: string; time: string; }

type AttendanceStatus = "not_started" | "on_duty" | "present" | "late" | "half_day" | "absent";

interface AttendanceRecord {
  _id: string;
  staffId: string;
  shiftId: string;
  date: string;
  timerOnTime?: string;   // ISO
  timerOffTime?: string;  // ISO
  services: ServiceEntry[];
  totalWorkingMinutes?: number;
}

// ─── Config ────────────────────────────────────────────────────────────────────
const STAFF_API = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/staff-roles`;
const ATTENDANCE_API = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/shift-attendance`; // NOT /api/attendance — that path is already used by your salary-attendance system

// NEW: same endpoint AttendancePage.tsx's quickMark() posts to, for marking
// day-level Present/Absent/Late/etc. Posting here on Timer ON keeps the two
// pages in sync without touching AttendancePage at all.
const ATTENDANCE_MARK_API = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/attendance`;

const token = (): string => {
  try {
    return (JSON.parse(localStorage.getItem("velvet_token") ?? "{}") as { token?: string }).token ?? "";
  } catch { return ""; }
};
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

const todayStr = new Date().toISOString().slice(0, 10);

const SERVICE_TYPES = ["Hair Cut", "Facial", "Hair Color", "Massage", "Makeup", "Other"];

// Single fixed working-hours window for everyone — no more per-staff shift
// picking. Change startTime/endTime here if the hours ever need to move.
const FIXED_SHIFT: Shift = {
  _id: "689ffa10c19729de860ea01f",
  name: "Working Hours",
  startTime: "08:00",
  endTime: "20:00",
  graceMinutes: 15,
  minWorkingHours: 8,
  halfDayThresholdHours: 6,
};

const STATUS_CFG: Record<AttendanceStatus, { label: string; text: string; bg: string; dot: string }> = {
  not_started: { label: "Not Started", text: "text-[#8a7560]", bg: "bg-[#f0e8d8]", dot: "bg-[#8a7560]" },
  on_duty:     { label: "On Duty",     text: "text-[#b8860b]", bg: "bg-[#faf5e8]", dot: "bg-[#d4af37]" },
  present:     { label: "Present",     text: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  late:        { label: "Late",        text: "text-amber-700", bg: "bg-amber-50",  dot: "bg-amber-500" },
  half_day:    { label: "Half Day",    text: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-500" },
  absent:      { label: "Absent",      text: "text-red-700",   bg: "bg-red-50",    dot: "bg-red-500" },
};

// ─── Icons ─────────────────────────────────────────────────────────────────────
const Ic = ({ n, className = "w-4 h-4" }: { n: string; className?: string }) => {
  const p: Record<string, string> = {
    search:"M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    user:"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    users:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    phone:"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    calendar:"M3 4h18v18H3zM3 10h18M8 2v4M16 2v4",
    clock:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
    play:"M6 3l14 9-14 9V3z",
    stop:"M5 5h14v14H5z",
    scissors:"M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12",
    check:"M20 6L9 17l-5-5",
    x:"M18 6L6 18M6 6l12 12",
    refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    alert:"M10.29 3.86l-8.47 14.14A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3.86L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
    plus:"M12 5v14M5 12h14",
    chevL:"M15 18l-6-6 6-6",
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {p[n]?.split("M").filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
    </svg>
  );
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }) : "—";
const fmtClock = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
const fmtDateLong = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
// NEW: compact date for narrow screens — the full weekday+month string was
// forcing the header title onto its own row to make room. "20 Aug 2026"
// fits the date-nav cluster on the same line as the page title.
const fmtDateShort = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const initials = (name: string) => (name || "?").split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
const atTime = (dateStr: string, hhmm: string) => new Date(`${dateStr}T${hhmm}:00`);

// NEW: display-only — turns a stored 24h "HH:MM" string (e.g. "20:00") into
// 12h format (e.g. "8:00 PM"). Only used for on-screen text; FIXED_SHIFT's
// startTime/endTime themselves stay 24h since atTime() and all status
// calculations (computeStatus, grace deadline, etc.) depend on that format.
const fmtTime12 = (hhmm: string) => {
  const [hStr, m = "00"] = hhmm.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12)}:${m} ${period}`;
};
const minutesBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);
const fmtDuration = (mins: number) => { const h = Math.floor(mins / 60), m = Math.round(mins % 60); return `${String(h)}h ${String(m)}m`; };

// Working minutes = Timer OFF − Timer ON (no break deduction anymore).
const workingMinutes = (record: AttendanceRecord | undefined, nowIso: string) => {
  if (!record?.timerOnTime) return 0;
  const end = record.timerOffTime ?? nowIso;
  return minutesBetween(record.timerOnTime, end);
};

const computeStatus = (record: AttendanceRecord | undefined, shift: Shift | undefined, now: Date, viewedDate: string = todayStr): AttendanceStatus => {
  const nowIso = now.toISOString();
  if (!record?.timerOnTime) {
    if (shift) { const shiftEnd = atTime(record?.date ?? viewedDate, shift.endTime); if (now > shiftEnd) return "absent"; }
    return "not_started";
  }
  if (!record.timerOffTime) return "on_duty";
  const worked = record.totalWorkingMinutes ?? workingMinutes(record, nowIso);
  if (!shift) return worked > 0 ? "present" : "half_day";
  if (worked < shift.minWorkingHours * 60) return "half_day";
  const graceDeadline = new Date(atTime(record.date, shift.startTime).getTime() + shift.graceMinutes * 60000);
  return new Date(record.timerOnTime) > graceDeadline ? "late" : "present";
};

// ─── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 40 }: { name: string; size?: number }) => {
  const colors: Record<string, string> = { A: "#d4af37", B: "#8a7050", C: "#b8860b", D: "#6b5740", E: "#d4af37" };
  const col = colors[name[0]?.toUpperCase() ?? "A"] ?? "#8a7050";
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 font-['Cormorant_Garamond',serif]"
      style={{ width: size, height: size, background: col, fontSize: size * 0.35 }}
    >
      {initials(name)}
    </div>
  );
};

const StatusPill = ({ status }: { status: AttendanceStatus }) => {
  const c = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase px-2.5 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ReceptionPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AttendanceStatus>("all");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [apiError, setApiError] = useState("");
  const [now, setNow] = useState(new Date());

  const [serviceModal, setServiceModal] = useState<{ staffId: string; recordId: string } | null>(null);
const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
const [serviceCustomer, setServiceCustomer] = useState("");

// NEW: which day reception is viewing — defaults to today, can be navigated back
const [selectedDate, setSelectedDate] = useState(todayStr);
const isToday = selectedDate === todayStr;

// NEW: shift a YYYY-MM-DD string by `delta` days
// Built from local getFullYear/getMonth/getDate — NOT toISOString(), which
// converts to UTC and silently shifts the date by a day in IST (UTC+5:30).
const shiftDate = (dateStr: string, delta: number) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const goPrevDay = () => { setSelectedDate(d => shiftDate(d, -1)); };
const goNextDay = () => { setSelectedDate(d => { const n = shiftDate(d, 1); return n > todayStr ? d : n; }); }; // never past today
const goToday   = () => { setSelectedDate(todayStr); };

// live clock — drives running timers
useEffect(() => { const t = setInterval(() => { setNow(new Date()); }, 1000); return () => { clearInterval(t); }; }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true); setApiError("");
    try {
      const [staffRes, attRes] = await Promise.all([
        fetch(STAFF_API, { headers: headers() }),
        fetch(`${ATTENDANCE_API}?date=${selectedDate}`, { headers: headers() }),
      ]);
      if (staffRes.ok) setStaffList(await staffRes.json() as StaffMember[]);
      if (attRes.ok) setAttendance(await attRes.json() as AttendanceRecord[]);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to load attendance data.");
    } finally { setLoading(false); }
  }, [selectedDate]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const recordByStaff = useMemo(() => new Map(attendance.map(r => [r.staffId, r])), [attendance]);

  const rows = useMemo(() => staffList
    .filter(s => s.status === "active")
    .map(s => {
      const record = recordByStaff.get(s._id);
      return { staff: s, record, shift: FIXED_SHIFT, status: computeStatus(record, FIXED_SHIFT, now, selectedDate) };
    }), [staffList, recordByStaff, now, selectedDate]);

  const filteredRows = useMemo(() => rows.filter(r =>
    (!search || r.staff.name.toLowerCase().includes(search.toLowerCase()) || r.staff.phone.includes(search)) &&
    (statusFilter === "all" || r.status === statusFilter)
  ), [rows, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { not_started: 0, on_duty: 0, present: 0, late: 0, half_day: 0, absent: 0 };
    rows.forEach(r => { c[r.status]++; });
    return c;
  }, [rows]);

  const selectedRow = rows.find(r => r.staff._id === selectedId) ?? null;

  // ── Actions ────────────────────────────────────────────────────────────────
  const withAction = async (staffId: string, fn: () => Promise<Response>) => {
    setActionId(staffId); setApiError("");
    try {
      const res = await fn();
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json() as AttendanceRecord;
      setAttendance(prev => {
        const exists = prev.some(r => r._id === updated._id);
        return exists ? prev.map(r => r._id === updated._id ? updated : r) : [...prev, updated];
      });
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Action failed.");
      // NEW: the client's cached attendance record can drift from the real
      // server state (e.g. this staff member's timer was already closed by
      // another action/tab). Without this, the UI keeps showing "On Duty"
      // forever and every further Timer OFF click just repeats the same
      // stale error. Refetching re-syncs the row to whatever is actually
      // true on the server.
      void fetchAll();
    }
    finally { setActionId(null); }
  };

   // NEW: marks the staff member Present on the Attendance page the moment
  // they Timer ON. Fire-and-forget so it never blocks or breaks the actual
  // Timer ON action — if this call fails, reception can still clock people
  // in normally and the Attendance page can be marked manually as before.
   const markPresentOnAttendance = async (staffId: string, clockInTime: Date) => {
    // Mirror the same grace-deadline rule computeStatus() already uses, so
    // the Attendance page's status agrees with what Reception itself shows
    // instead of always writing "present".
    const graceDeadline = new Date(
      atTime(todayStr, FIXED_SHIFT.startTime).getTime() + FIXED_SHIFT.graceMinutes * 60000
    );
    const status: "present" | "late" = clockInTime > graceDeadline ? "late" : "present";
    const checkIn = `${String(clockInTime.getHours()).padStart(2, "0")}:${String(clockInTime.getMinutes()).padStart(2, "0")}`;
    try {
      await fetch(ATTENDANCE_MARK_API, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ staffId, date: todayStr, status, checkIn }),
      });
    } catch {
      // non-critical — Attendance page can still be marked manually
    }
  };

   const timerOn = (staff: StaffMember) => {
    const clockInTime = new Date();
    // Always the fixed 08:00–20:00 working-hours window — no shift picking.
    // Calling this again after a Timer OFF starts a fresh session for today.
    void withAction(staff._id, () => fetch(`${ATTENDANCE_API}/timer-on`, {
      method: "POST", headers: headers(), body: JSON.stringify({ staffId: staff._id, shiftId: FIXED_SHIFT._id, date: todayStr }),
    }));
    // NEW: also auto-mark them Present (or Late) on the Attendance page
    void markPresentOnAttendance(staff._id, clockInTime);
  };
  const timerOff = (staffId: string, recordId: string) =>
    void withAction(staffId, () => fetch(`${ATTENDANCE_API}/${recordId}/timer-off`, { method: "POST", headers: headers() }));

  const addService = () => {
    if (!serviceModal) return;
    void withAction(serviceModal.staffId, () => fetch(`${ATTENDANCE_API}/${serviceModal.recordId}/service`, {
      method: "POST", headers: headers(), body: JSON.stringify({ type: serviceType, customer: serviceCustomer }),
    })).then(() => { setServiceModal(null); setServiceCustomer(""); });
  };

  const STATUS_TABS: { id: "all" | AttendanceStatus; label: string }[] = [
    { id: "all", label: "All" }, { id: "not_started", label: "Not Started" }, { id: "on_duty", label: "On Duty" },
    { id: "present", label: "Present" }, { id: "late", label: "Late" },
    { id: "half_day", label: "Half Day" }, { id: "absent", label: "Absent" },
  ];

  return (
    <div className="min-h-screen bg-[#f5f0e8] font-['Jost',sans-serif] text-[#2c1f0e]">
      {/* Top bar — single row at every width. Title truncates and the date
          text shortens on mobile instead of the whole toolbar wrapping onto
          a second line, so the header never looks like it has an empty gap
          above a cramped controls row. */}
      <header className="min-h-[60px] bg-white border-b border-[#ede5d6] flex items-center gap-2 sm:gap-4 px-3 sm:px-7 py-2.5">
        <div className="font-['Cormorant_Garamond',serif] text-[16px] xs:text-[18px] sm:text-[22px] text-[#1a1208] truncate flex-shrink min-w-0">
          Reception · Attendance
        </div>
        <div className="flex items-center gap-1.5 sm:gap-5 ml-auto flex-shrink-0">
          {/* NEW: date navigation — view past days, Timer ON/OFF stays today-only */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={goPrevDay}
              title="Previous day"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-[#ede5d6] bg-[#faf8f4] flex items-center justify-center text-[#6b5740] hover:border-[#d4af37] transition-colors flex-shrink-0"
            >
              <Ic n="chevL" className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
            <div className="text-right leading-tight">
              <div className="text-[9px] sm:text-[11px] text-[#8a7560] whitespace-nowrap">
                <span className="sm:hidden">{isToday ? fmtDateShort(now) : fmtDateShort(new Date(`${selectedDate}T00:00:00`))}</span>
                <span className="hidden sm:inline">{isToday ? fmtDateLong(now) : new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              {isToday && (
                <div className="text-[11px] sm:text-[13px] text-[#1a1208] font-medium tabular-nums whitespace-nowrap">{fmtClock(now)}</div>
              )}
            </div>
            <button
              onClick={goNextDay}
              disabled={isToday}
              title="Next day"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-[#ede5d6] bg-[#faf8f4] flex items-center justify-center text-[#6b5740] hover:border-[#d4af37] transition-colors disabled:opacity-30 disabled:cursor-not-allowed rotate-180 flex-shrink-0"
            >
              <Ic n="chevL" className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
            {/* NEW: always-visible Today button — no longer buried as a text link */}
            <button
              onClick={goToday}
              disabled={isToday}
              title="Jump to today"
              className="h-7 sm:h-8 px-2 sm:px-3 rounded-lg text-[9px] sm:text-[11px] font-medium tracking-wider uppercase border border-[#ede5d6] bg-[#faf8f4] text-[#6b5740] hover:border-[#d4af37] hover:bg-[#fffdf5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap"
            >
              Today
            </button>
          </div>
          <button
            onClick={() => { void fetchAll(); }}
            title="Refresh"
            className="w-7 h-7 sm:h-9 sm:w-auto sm:px-4 rounded-lg text-[11px] font-medium tracking-wider uppercase border border-[#ede5d6] bg-[#faf8f4] text-[#6b5740] hover:border-[#d4af37] hover:bg-[#fffdf5] transition-colors flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            <Ic n="refresh" className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {apiError && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 sm:px-7 py-2.5 text-xs flex items-center gap-2">
          <Ic n="alert" className="w-3.5 h-3.5 flex-shrink-0" /> <span className="min-w-0 break-words">{apiError}</span>
          <button className="ml-auto flex-shrink-0" onClick={() => { setApiError(""); }}><Ic n="x" className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Status summary strip — 3 cols x 2 rows on mobile so all 6 statuses
          are visible without needing to swipe/scroll; 6 cols in one row from
          sm upward, matching the original desktop layout. */}
      <div className="bg-white border-b border-[#ede5d6] px-4 sm:px-7 py-3">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-3 sm:gap-y-0">
          {STATUS_TABS.filter(t => t.id !== "all").map((t, i) => {
            const c = STATUS_CFG[t.id as AttendanceStatus];
            const mobileBorder = i % 3 !== 0 ? "border-l border-[#ede5d6]" : "";
            const smBorder = i !== 0 ? "sm:border-l sm:border-[#ede5d6]" : "sm:border-l-0";
            return (
              <button
                key={t.id}
                onClick={() => { setStatusFilter(t.id); }}
                className={`flex flex-col gap-1 px-3 sm:px-4 text-left ${mobileBorder} ${smBorder} ${statusFilter === t.id ? "opacity-100" : "opacity-70 hover:opacity-100"} transition-opacity`}
              >
                <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-medium tracking-wider uppercase text-[#8a7560] whitespace-nowrap">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />{t.label}
                </span>
                <span className="font-['Cormorant_Garamond',serif] text-[20px] sm:text-[22px] leading-none text-[#1a1208]">
                  {statusCounts[t.id as AttendanceStatus]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] md:h-[calc(100vh-60px-64px)] md:overflow-hidden">
        {/* List panel */}
        <aside className={`bg-white md:border-r border-[#ede5d6] flex-col overflow-hidden ${selectedRow ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 flex flex-col gap-3 border-b border-[#f0e8d8]">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a7560]"><Ic n="search" className="w-3.5 h-3.5" /></span>
              <input
                className="w-full h-9 border border-[#ede5d6] rounded-lg bg-[#faf8f4] pl-8 pr-3 text-[13px] font-light text-[#2c1f0e] outline-none focus:border-[#d4af37] placeholder:text-[#c5b89a]"
                placeholder="Search name or phone…" value={search} onChange={e => { setSearch(e.target.value); }}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => { setStatusFilter("all"); }}
                className={`h-6 px-2.5 rounded-full text-[10px] font-medium tracking-wider uppercase border transition-colors ${statusFilter === "all" ? "bg-[#1a1208] text-[#d4af37] border-[#1a1208]" : "bg-[#faf8f4] text-[#8a7560] border-[#ede5d6]"}`}
              >All</button>
              {STATUS_TABS.filter(t => t.id !== "all").map(t => (
                <button
                  key={t.id}
                  onClick={() => { setStatusFilter(t.id); }}
                  className={`h-6 px-2.5 rounded-full text-[10px] font-medium tracking-wider uppercase border transition-colors ${statusFilter === t.id ? "bg-[#1a1208] text-[#d4af37] border-[#1a1208]" : "bg-[#faf8f4] text-[#8a7560] border-[#ede5d6]"}`}
                >{t.label}</button>
              ))}
            </div>
          </div>

          <div className="px-4 py-2.5 text-[11px] text-[#8a7560] tracking-wide border-b border-[#f5f0e8]">
            {filteredRows.length} staff · {statusCounts.on_duty} currently on shift
          </div>

          <div className="flex-1 overflow-y-auto max-h-[70vh] md:max-h-none">
            {loading ? (
              <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[#d4af374d] border-t-[#d4af37] rounded-full animate-spin" /></div>
            ) : filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2.5 py-10 px-5 text-[#8a7560]">
                <Ic n="users" className="w-9 h-9 opacity-30" />
                <div className="text-[13px] font-light">No staff found</div>
              </div>
            ) : filteredRows.map(({ staff, record, status }) => (
              <div
                key={staff._id}
                onClick={() => { setSelectedId(staff._id); }}
                className={`relative px-4 py-3.5 flex items-center gap-3 cursor-pointer border-b border-[#f5f0e8] hover:bg-[#faf8f4] transition-colors ${selectedId === staff._id ? "bg-[#faf5e8] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-[#d4af37] before:rounded-r" : ""}`}
              >
                <Avatar name={staff.name} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[#1a1208] leading-tight truncate">{staff.name}</div>
                  <div className="text-[11px] text-[#8a7560] mt-0.5 capitalize truncate">{staff.role.replace("_", " ")}</div>
                  <div className="mt-1.5"><StatusPill status={status} /></div>
                </div>
               {isToday && (
                  <button
                    disabled={actionId === staff._id}
                    onClick={(e) => { e.stopPropagation();
                      if (status === "on_duty" && record) { timerOff(staff._id, record._id); }
                      else timerOn(staff); // works for not_started, absent, and re-clocking in after present/late/half_day
                    }}
                    title={status === "on_duty" ? "Timer OFF" : "Timer ON"}
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 ${
                      status === "on_duty"
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-[#faf5e8] text-[#b8860b] hover:bg-[#f5ecd0]"
                    }`}
                  >
                    <Ic n={status === "on_duty" ? "stop" : "play"} className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Detail panel */}
        <div className={`flex-col overflow-hidden ${selectedRow ? "flex" : "hidden md:flex"}`}>
          {!selectedRow ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3.5 text-[#8a7560] py-16">
              <Ic n="user" className="w-16 h-16 opacity-20" />
              <div className="font-['Cormorant_Garamond',serif] text-[20px] sm:text-[22px] font-light text-[#8a7560] text-center px-6">Select a staff member to view attendance</div>
            </div>
          ) : (() => {
            const { staff, record, status } = selectedRow;
            const worked = workingMinutes(record, now.toISOString());
            const events = [
              ...(record?.timerOnTime ? [{ t: record.timerOnTime, label: "Timer ON — shift started", icon: "play" }] : []),
              ...(record?.services ?? []).map(s => ({ t: s.time, label: `${s.type}${s.customer ? ` — ${s.customer}` : ""}`, icon: "scissors" })),
              ...(record?.timerOffTime ? [{ t: record.timerOffTime, label: "Timer OFF — shift ended", icon: "stop" }] : []),
            ].sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());

            return (
              <>
                {/* Header */}
                <div className="bg-white border-b border-[#ede5d6] px-4 sm:px-7 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
                  <button
                    onClick={() => { setSelectedId(null); }}
                    className="md:hidden w-9 h-9 rounded-lg border border-[#ede5d6] bg-[#faf8f4] flex items-center justify-center text-[#6b5740] hover:border-[#d4af37] flex-shrink-0"
                    title="Back to list"
                  >
                    <Ic n="chevL" className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <Avatar name={staff.name} size={52} />
                    <div className="flex-1 min-w-0">
                      {/* Name wraps instead of truncating — this is the detail
                          view, there's room, and cutting a person's name off
                          mid-word looked broken. */}
                      <div className="font-['Cormorant_Garamond',serif] text-[20px] sm:text-[28px] leading-tight text-[#1a1208] break-words">{staff.name}</div>
                      <div className="text-[12px] sm:text-[13px] text-[#6b5740] mt-1 flex items-center gap-1.5 flex-wrap">
                        <Ic n="phone" className="w-3 h-3 flex-shrink-0" />
                        <span>{staff.phone}</span>
                        <span className="text-[#e0d5c0]">·</span>
                        <span className="capitalize">{staff.role.replace("_", " ")}</span>
                      </div>
                      <div className="mt-2"><StatusPill status={status} /></div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right text-[11px] sm:text-[12px] text-[#8a7560] flex-shrink-0 pl-[44px] sm:pl-0">
                    <div className="font-medium text-[#1a1208]">{FIXED_SHIFT.name}</div>
                    <div>{fmtTime12(FIXED_SHIFT.startTime)} – {fmtTime12(FIXED_SHIFT.endTime)}</div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-6 flex flex-col gap-5">
                  {/* Timer control card — shown whenever staff isn't currently on duty, so   */}
                  {/* Timer ON is always available again after a Timer OFF (re-clocking in). */}
                  {status !== "on_duty" && (
                    <div className="bg-white border border-[#ede5d6] rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-medium tracking-widest uppercase text-[#8a7560] mb-1">
                          {status === "not_started" || status === "absent" ? "Shift Not Started" : "Ready to Clock In Again"}
                        </div>
                        <div className="text-[13px] text-[#6b5740]">Working hours {fmtTime12(FIXED_SHIFT.startTime)} – {fmtTime12(FIXED_SHIFT.endTime)} · grace {FIXED_SHIFT.graceMinutes} min</div>
                      </div>
                      <button
                        disabled={actionId === staff._id}
                        onClick={() => { timerOn(staff); }}
                        className="h-11 px-6 rounded-lg text-[12px] font-medium tracking-widest uppercase bg-[#1a1208] text-[#d4af37] hover:bg-[#2d2010] transition-colors disabled:opacity-60 flex items-center gap-2 w-full sm:w-auto justify-center"
                      >
                        <Ic n="play" className="w-3.5 h-3.5" /> Timer ON
                      </button>
                    </div>
                  )}

                  {status === "on_duty" && record && (
                    <div className="bg-gradient-to-br from-[#1a1208] via-[#2d2010] to-[#3d2e18] rounded-2xl p-5 sm:p-7 text-[#d4af37] relative overflow-hidden">
                      <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/[0.06] pointer-events-none" />
                      <div className="text-[11px] font-medium tracking-[0.2em] uppercase opacity-70">Working Time</div>
                      <div className="font-['Cormorant_Garamond',serif] text-[38px] sm:text-[52px] font-light leading-none my-1.5 tabular-nums">
                        {fmtDuration(worked)}
                      </div>
                      <div className="text-[12px] opacity-60 mb-5">Timer ON at {fmtTime(record.timerOnTime)}</div>
                      <div className="flex gap-2.5 flex-wrap">
                        <button
                          onClick={() => { setServiceModal({ staffId: staff._id, recordId: record._id }); }}
                          className="h-9 px-4 rounded-lg text-[11px] font-medium tracking-wider uppercase bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1.5"
                        ><Ic n="scissors" className="w-3.5 h-3.5" /> Add Service</button>
                        <button
                          disabled={actionId === staff._id}
                          onClick={() => { timerOff(staff._id, record._id); }}
                          className="h-9 px-4 rounded-lg text-[11px] font-medium tracking-wider uppercase bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5 sm:ml-auto"
                        ><Ic n="stop" className="w-3.5 h-3.5" /> Timer OFF</button>
                      </div>
                    </div>
                  )}

                  {record?.timerOffTime && (
                    <div className="bg-white border border-[#ede5d6] rounded-xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="text-[10px] font-medium tracking-widest uppercase text-[#8a7560]">Working Hours</div>
                        <div className="font-['Cormorant_Garamond',serif] text-[24px] text-[#1a1208]">{fmtDuration(record.totalWorkingMinutes ?? worked)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium tracking-widest uppercase text-[#8a7560]">Timer ON / OFF</div>
                        <div className="text-[13px] text-[#1a1208] mt-1">{fmtTime(record.timerOnTime)} → {fmtTime(record.timerOffTime)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium tracking-widest uppercase text-[#8a7560]">Final Status</div>
                        <div className="mt-1"><StatusPill status={status} /></div>
                      </div>
                    </div>
                  )}

                  {/* Shift rules */}
                  <div className="bg-white border border-[#ede5d6] rounded-xl p-5">
                    <div className="text-[10px] font-medium tracking-widest uppercase text-[#8a7560] mb-3 flex items-center gap-1.5">
                      <Ic n="clock" className="w-3.5 h-3.5" /> Working Hours Rules
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-2.5 sm:gap-6 text-[13px] text-[#2c1f0e]">
                      <div><span className="text-[#8a7560]">Hours:</span> {fmtTime12(FIXED_SHIFT.startTime)} – {fmtTime12(FIXED_SHIFT.endTime)}</div>
                      <div><span className="text-[#8a7560]">Grace time:</span> {FIXED_SHIFT.graceMinutes} min</div>
                      <div><span className="text-[#8a7560]">Min hours:</span> {FIXED_SHIFT.minWorkingHours}h</div>
                      <div><span className="text-[#8a7560]">Half-day below:</span> {FIXED_SHIFT.halfDayThresholdHours}h</div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="bg-white border border-[#ede5d6] rounded-xl p-5 sm:p-6">
                    <div className="text-[10px] font-medium tracking-widest uppercase text-[#8a7560] mb-4 flex items-center gap-1.5">
                      <Ic n="calendar" className="w-3.5 h-3.5" /> Today's Timeline
                    </div>
                    {events.length === 0 ? (
                      <div className="text-[13px] text-[#8a7560] italic py-4 text-center">No activity recorded yet today.</div>
                    ) : (
                      <div className="flex flex-col">
                        {events.map((ev, i) => (
                          <div key={i} className="flex items-start gap-3 pb-4 last:pb-0 relative">
                            {i !== events.length - 1 && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-[#ede5d6]" />}
                            <span className="w-7 h-7 rounded-full bg-[#faf5e8] text-[#b8860b] flex items-center justify-center flex-shrink-0 relative z-10">
                              <Ic n={ev.icon} className="w-3.5 h-3.5" />
                            </span>
                            <div className="pt-0.5 min-w-0">
                              <div className="text-[13px] text-[#1a1208] break-words">{ev.label}</div>
                              <div className="text-[11px] text-[#8a7560] mt-0.5">{fmtTime(ev.t)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Add Service modal */}
      {serviceModal && (
        <div className="fixed inset-0 bg-[#1a1208]/55 flex items-center justify-center z-[100] p-4 sm:p-5" onClick={() => { setServiceModal(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => { e.stopPropagation(); }}>
            <div className="px-5 sm:px-6 pt-6 pb-4 flex items-start justify-between border-b border-[#f0e8d8]">
              <div className="min-w-0 pr-3">
                <div className="font-['Cormorant_Garamond',serif] text-[22px] text-[#1a1208]">Add Service</div>
                <div className="text-[12px] text-[#8a7560] mt-1">Logged against this shift's timeline</div>
              </div>
              <button onClick={() => { setServiceModal(null); }} className="w-8 h-8 rounded-lg border border-[#ede5d6] bg-[#faf8f4] flex items-center justify-center text-[#6b5740] hover:border-red-300 hover:text-red-500 flex-shrink-0">
                <Ic n="x" className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium tracking-widest uppercase text-[#6b5740]">Service Type</label>
                <select className="h-10 border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none focus:border-[#d4af37]" value={serviceType} onChange={e => { setServiceType(e.target.value); }}>
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium tracking-widest uppercase text-[#6b5740]">Customer (optional)</label>
                <input className="h-10 border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="Customer name" value={serviceCustomer} onChange={e => { setServiceCustomer(e.target.value); }} />
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => { setServiceModal(null); }} className="flex-1 h-11 rounded-lg text-[12px] font-medium tracking-wider uppercase border border-[#ede5d6] bg-[#faf8f4] text-[#6b5740] hover:border-[#d4af37]">Cancel</button>
                <button onClick={() => { addService(); }} className="flex-1 h-11 rounded-lg text-[12px] font-medium tracking-wider uppercase bg-[#1a1208] text-[#d4af37] hover:bg-[#2d2010] flex items-center justify-center gap-2">
                  <Ic n="check" className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}