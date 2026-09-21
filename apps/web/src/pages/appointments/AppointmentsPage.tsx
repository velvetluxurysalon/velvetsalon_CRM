import { useState, useMemo, useEffect, useCallback, Fragment, useRef } from "react";
import { useNavigate } from "react-router-dom";          // ← ADD THIS LINE
import { SERVICES_CAT } from "../../db/services";
import * as XLSX from "xlsx";

// Daily report target — kept as a constant so it's easy to change later.
const DAILY_REPORT_PHONE = "+919994119336";
const DAILY_REPORT_HOUR = 21; // 9 PM, 24h format

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = "confirmed" | "in-progress" | "completed" | "cancelled" | "pending" | "billed";
type ViewMode = "calendar" | "list";

interface Appointment {
  _id: string;
  customer: string;
  phone: string;
  service: string;
  staff: string;
  date: string;
  time: string;
  duration: number;
  status: Status;
  isWalkIn: boolean;
  notes: string;
}

interface StaffMember {
  id: string;
  name: string;
  initials: string;
  speciality: string;
  color: string;
}

/** Shape returned by GET /api/staff-roles (admin endpoint, same one StaffPage.tsx uses). */
interface StaffRoleApiRecord {
  _id: string;
  name: string;
  speciality: string;
  status: "active" | "on_leave" | "inactive";
}

/** Minimal shape we need from GET /api/customers?q=... (same endpoint CustomersPage.tsx uses). */
interface CustomerLookupRecord {
  _id: string;
  name: string;
  phone: string;
}

interface CalendarDot { date: string; count: number; }

// ─── Static config ────────────────────────────────────────────────────────────
// NOTE: Stylists are no longer hardcoded. They're fetched live from
// GET /api/staff-roles (filtered to status=active client-side) so that
// updates made on the Staff & Roles admin page show up here automatically.

const STAFF_AVATAR_COLORS = ["#d4af37", "#b8860b", "#8a7050", "#6b5740", "#0f766e", "#7c3aed", "#db2777", "#2563eb"];

const initialsOf = (name: string) =>
  name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
const colorFor = (name: string) => {
  const code = name[0]?.toUpperCase().charCodeAt(0) ?? 65;
  return STAFF_AVATAR_COLORS[code % STAFF_AVATAR_COLORS.length] ?? "#8a7050";
};



const TIME_SLOTS = [
  "08:00","08:30",
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30",
];

// NEW: mirrors ContactPage.tsx's getAvailableSlots — when the modal's date is
// today, hide slots already in the past so the admin can't book a time that's
// already gone. For any other date, every slot is still offered.
const getAvailableSlots = (date: string): string[] => {
  if (date !== todayStr) return TIME_SLOTS;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  return TIME_SLOTS.filter(t => {
    const [h = 0, m = 0] = t.split(":").map(Number);
    return h * 60 + m > nowMinutes;
  });
};

const STATUS_CFG: Record<Status, { label:string; bg:string; color:string; dot:string }> = {
  confirmed:     { label:"Confirmed",   bg:"#eaf3de", color:"#3b6d11", dot:"#5a9e2f" },
  "in-progress": { label:"In Progress", bg:"#faeeda", color:"#633806", dot:"#d4711f" },
  completed:     { label:"Completed",   bg:"#f0f0f0", color:"#444",    dot:"#999"    },
  cancelled:     { label:"Cancelled",   bg:"#fcebeb", color:"#a32d2d", dot:"#c0392b" },
  pending:       { label:"Pending",     bg:"#f1efe8", color:"#5f5e5a", dot:"#999"    },
  billed:        { label:"Billed",      bg:"#eef2ff", color:"#3730a3", dot:"#6366f1" },   // ← ADD THIS LINE
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const today    = new Date();
const todayStr = today.toISOString().slice(0, 10);
const dateStrOf = (d: Date) => d.toISOString().slice(0, 10);

// ─── API helpers ──────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
const API = `${API_BASE}/api/appointments`;
const STAFF_API = `${API_BASE}/api/staff-roles`;
const token = (): string => {
  try {
    const parsed = JSON.parse(localStorage.getItem("velvet_token") ?? "{}") as { token?: string };
    return parsed.token ?? "";
  } catch {
    return "";
  }
};
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

// ── Excel export helpers ────────────────────────────────────────────────────
// Builds a worksheet from any Appointment[] and triggers a browser download.
// staffNameById resolves the stored staff ObjectId to a human-readable name
// (falls back to the raw id if the staff record can't be found, e.g. deleted staff).
function downloadAppointmentsExcel(rows: Appointment[], filename: string, staffNameById: Map<string, string>) {
  const sheetData = rows.map(a => ({
    Customer: a.customer,
    Phone: a.phone,
    Service: a.service,
    Staff: staffNameById.get(a.staff) ?? "Unknown Staff (removed)",
    Date: a.date,
    Time: a.time,
    "Duration (min)": a.duration,
    Status: a.status,
    "Walk-in": a.isWalkIn ? "Yes" : "No",
    Notes: a.notes,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Appointments");
  XLSX.writeFile(wb, filename);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const p: Record<string, string> = {
    plus:     "M12 5v14M5 12h14",
    calendar: "M3 4h18v18H3zM3 10h18M8 2v4M16 2v4",
    list:     "M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1",
    user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    phone:    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    scissors: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12",
    x:        "M18 6L6 18M6 6l12 12",
    check:    "M20 6L9 17l-5-5",
    whatsapp: "M12 2a10 10 0 0 1 8.93 14.47L22 22l-5.53-1.07A10 10 0 1 1 12 2z",
    walkin:   "M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM6 20h4l1-4 2 2v4h2v-5l-2-2 1-3a9 9 0 0 0 4 2v-2a7 7 0 0 1-3-1l-1-2a1 1 0 0 0-1 0l-3 3L6 14H4v2h2zM4 8h7",
    search:   "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    edit:     "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z",
    trash:    "M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2",
    chev_l:   "M15 18l-6-6 6-6",
    chev_r:   "M9 18l6-6-6-6",
    refresh:  "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    bell:     "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {(p[n] ?? "").split("M").filter(Boolean).map((d, i) => (
  <path key={i} d={`M${d}`} />
))}
    </svg>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

// Display-only: convert a 24h "HH:mm" value into 12h "h:mm AM/PM" for labels/dropdowns.
// The underlying value used for filtering/matching/storage stays in 24h.
const fmtTime12 = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12)}:${String(m).padStart(2, '0')} ${ampm}`;
};
const emptyForm = (): Omit<Appointment, "_id"> => ({
  customer:"", phone:"", service:"", staff:"", date:todayStr,
  time:"10:00", duration:30, status:"confirmed", isWalkIn:false, notes:"",
});

// ─────────────────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const navigate = useNavigate();   // ← ADD THIS LINE
  const [calDots, setCalDots]           = useState<Record<string, number>>({});
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [apiError, setApiError]         = useState("");

 // staff (live, from Staff & Roles backend)
  const [staffList, setStaffList]       = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  // ALL staff (any status), used only for id→name fallback resolution —
  // declared here (not near fetchAllStaffNames further down) because
  // staffNameById below reads it immediately.
  const [allStaffNameMap, setAllStaffNameMap] = useState<Map<string, string>>(new Map());
  // Declared here (not further down) because handleExportClick and the daily
  // 9 PM auto-export effect both reference it, and both appear earlier in the
  // component than where this used to live — referencing a const before its
  // declaration throws a "used before initialization" error.
  // Falls back to allStaffNameMap so appointments assigned to inactive/removed
  // staff still resolve to a real name instead of the raw ObjectId.
  const staffNameById = useMemo(() => {
    const map = new Map(allStaffNameMap);
    staffList.forEach(s => map.set(s.id, s.name)); // active staff take priority
    return map;
  }, [staffList, allStaffNameMap]);

  const [view, setView]               = useState<ViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [calYear,  setCalYear]          = useState(today.getFullYear());
  const [calMonth, setCalMonth]         = useState(today.getMonth());
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState(emptyForm());

  // NEW: times already booked for the currently-selected staff + date in the
  // modal, so the Time dropdown only offers genuinely free slots — mirrors
  // ContactPage.tsx's fetchBookedSlots for the customer-facing booking form.
  const [modalBookedTimes, setModalBookedTimes]   = useState<string[]>([]);
  const [modalSlotsLoading, setModalSlotsLoading] = useState(false);

  const fetchModalBookedSlots = useCallback(async (staffId: string, date: string) => {
    if (!staffId || !date) { setModalBookedTimes([]); return; }
    setModalSlotsLoading(true);
    try {
      const params = new URLSearchParams({ date, staff: staffId });
      const res = await fetch(`${API}?${params}`, { headers: headers() });
      if (!res.ok) { setModalBookedTimes([]); return; }
      const data = (await res.json()) as Appointment[];
      // Exclude cancelled appointments (slot is free again) and, when
      // editing, exclude the appointment being edited (its own slot isn't "taken").
      setModalBookedTimes(
        data
          .filter(a => a.status !== "cancelled" && a._id !== editingId)
          .map(a => a.time.slice(0, 5))
      );
    } catch {
      setModalBookedTimes([]);
    } finally {
      setModalSlotsLoading(false);
    }
  }, [editingId]);

  // Refetch whenever the modal is open and staff/date change
  useEffect(() => {
    if (showModal) void fetchModalBookedSlots(form.staff, form.date);
  }, [showModal, form.staff, form.date, fetchModalBookedSlots]);

  const [search, setSearch]           = useState("");
  const [filterStaff, setFilterStaff] = useState("all");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");

  // ── Auto-fill customer name from phone number ────────────────────────────
  // Reuses the same GET /api/customers?q=... endpoint CustomersPage.tsx uses
  // (there's no dedicated phone-lookup route), then finds an exact phone match
  // client-side.
 // AFTER
const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
const [customerNotFound, setCustomerNotFound] = useState(false);
const lastLookedUpPhoneRef = useRef<string>(""); // avoid re-querying the same number
// True whenever the Customer Name field currently holds text WE put there
// (autofill or our own clearing) rather than something the user typed.
// This is far more reliable than comparing strings, which breaks the moment
// two different matched customers are typed in sequence.
const nameIsAutoFilledRef = useRef(true); // starts true — field is empty, safe to fill

useEffect(() => {
  if (form.isWalkIn) return; // walk-ins skip lookup entirely
  const digits = form.phone.replace(/\D/g, "");
  if (digits.length !== 10) {
    setCustomerNotFound(false); // number no longer complete — hide any stale "not found" message
    return;
  }
  if (lastLookedUpPhoneRef.current === digits) return;

  const timer = setTimeout(() => {
    void (async () => {
      lastLookedUpPhoneRef.current = digits;
      setCustomerLookupLoading(true);
      setCustomerNotFound(false);
      try {
        const res = await fetch(`${API_BASE}/api/customers?q=${digits}`, { headers: headers() });
        if (!res.ok) return; // request failed — leave whatever the user typed
        const data = (await res.json()) as CustomerLookupRecord[];
        const match = data.find(c => c.phone.replace(/\D/g, "") === digits);
        if (match) {
          setForm(f => {
            if (f.phone.replace(/\D/g, "") !== digits) return f; // phone changed again while we were fetching
            if (f.customer && !nameIsAutoFilledRef.current) return f; // user typed their own name — never touch it
            nameIsAutoFilledRef.current = true;
            return { ...f, customer: match.name };
          });
        } else {
          setForm(f => {
            if (f.phone.replace(/\D/g, "") !== digits) return f;
            if (!nameIsAutoFilledRef.current) return f; // user typed their own name — never touch it
            nameIsAutoFilledRef.current = true; // the "" we're setting is also our own autofill
            return { ...f, customer: "" };
          });
          setCustomerNotFound(true);
        }
      } catch {
        /* silent — lookup is best-effort, never blocks booking */
      } finally {
        setCustomerLookupLoading(false);
      }
    })();
  }, 500); // debounce so it doesn't fire on every keystroke

  return () => { clearTimeout(timer); };
}, [form.phone, form.isWalkIn]);

 // ── Fetch active staff for the calendar columns / picker ───────────────────
  const fetchStaffList = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await fetch(`${STAFF_API}?status=active`, { headers: headers() });
      if (!res.ok) return;
      const data = (await res.json()) as StaffRoleApiRecord[];
      const mapped: StaffMember[] = data
        .filter(s => s.status === "active")
        .map(s => ({
          id: s._id,
          name: s.name,
          initials: initialsOf(s.name),
          speciality: s.speciality,
          color: colorFor(s.name),
        }));
      setStaffList(mapped);
    } catch { /* silent — calendar still works with an empty staff list */ }
    finally { setStaffLoading(false); }
  }, []);

  useEffect(() => { void fetchStaffList(); }, [fetchStaffList]);

 // ── Fetch ALL staff (any status) purely for id→name resolution ─────────────
  // staffList above is deliberately active-only (drives the calendar columns
  // and the staff picker). But an appointment can reference a staff member who
  // has since gone on leave / inactive / been removed — that id would then be
  // missing from staffList and names/exports would fall back to the raw
  // ObjectId. allStaffNameMap (declared earlier, near staffList) covers every
  // status so names always resolve.
  const fetchAllStaffNames = useCallback(async () => {
    try {
      const res = await fetch(STAFF_API, { headers: headers() });
      if (!res.ok) return;
      const data = (await res.json()) as StaffRoleApiRecord[];
      setAllStaffNameMap(new Map(data.map(s => [s._id, s.name])));
    } catch { /* silent — falls back to active-only names / raw id */ }
  }, []);

  useEffect(() => { void fetchAllStaffNames(); }, [fetchAllStaffNames]);

  // ── Fetch appointments for selected date ─────────────────────────────────
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (filterStaff !== "all") params.append("staff", filterStaff);
      if (filterStatus !== "all") params.append("status", filterStatus);
      const res = await fetch(`${API}?${params}`, { headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Appointment[];
      setAppointments(data);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to load appointments.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, filterStaff, filterStatus]);

  // ── Fetch calendar dots for current month ─────────────────────────────────
  const fetchCalDots = useCallback(async () => {
    try {
      const month = `${String(calYear)}-${String(calMonth + 1).padStart(2, "0")}`;
      const res = await fetch(`${API}/calendar?month=${month}`, { headers: headers() });
      if (!res.ok) return;
      const data = (await res.json()) as CalendarDot[];
      const map: Record<string, number> = {};
      data.forEach(d => { map[d.date] = d.count; });
      setCalDots(map);
    } catch { /* silent */ }
  }, [calYear, calMonth]);

  useEffect(() => { void fetchAppointments(); }, [fetchAppointments]);
  useEffect(() => { void fetchCalDots(); },     [fetchCalDots]);

  // ── Export all appointments (not just the selected day) ─────────────────
  const [exporting, setExporting] = useState(false);
  const exportAllAppointments = useCallback(async (): Promise<Appointment[]> => {
    const res = await fetch(API, { headers: headers() });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as Appointment[];
  }, []);

  const handleExportClick = async () => {
    setExporting(true);
    try {
      const all = await exportAllAppointments();
      downloadAppointmentsExcel(all, `appointments_${todayStr}.xlsx`, staffNameById);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to export appointments.");
    } finally {
      setExporting(false);
    }
  };

  // ── Daily 9 PM auto-download + send trigger ──────────────────────────────
  // NOTE: this only fires if this page is open in a browser tab at 9 PM.
  // Reliable delivery to a phone number every day regardless of whether
  // anyone has the app open requires a server-side scheduled job — this
  // client-side check calls a backend endpoint that should own the actual
  // WhatsApp/SMS sending logic.
  const dailySendFiredRef = useRef<string | null>(null); // stores the date already sent, to avoid double-firing

  useEffect(() => {
    const checkAndSend = () => {
      const now = new Date();
      const nowDateStr = dateStrOf(now);
      if (now.getHours() === DAILY_REPORT_HOUR && dailySendFiredRef.current !== nowDateStr) {
        dailySendFiredRef.current = nowDateStr;
       void (async () => {
          try {
            const all = await exportAllAppointments();
            downloadAppointmentsExcel(all, `appointments_${nowDateStr}.xlsx`, staffNameById);
            // Ask the backend to actually deliver the file to the number.
            // This endpoint doesn't exist yet — it needs to be built server-side
            // with a WhatsApp Business API / Twilio integration.
            await fetch(`${API_BASE}/api/reports/send-daily-appointments`, {
              method: "POST",
              headers: headers(),
              body: JSON.stringify({ phone: DAILY_REPORT_PHONE, date: nowDateStr }),
            });
          } catch {
            /* silent — daily send is best-effort from the client */
          }
        })();
      }
    };
    const id = setInterval(checkAndSend, 60000); // check every minute
    checkAndSend(); // also check immediately on mount
    return () => { clearInterval(id); };
  }, [exportAllAppointments, staffNameById]);

  // ── Derived list ─────────────────────────────────────────────────────────
  const dayAppointments = useMemo(() =>
    appointments
      .filter(a => !search ||
        a.customer.toLowerCase().includes(search.toLowerCase()) ||
        a.service.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, search]
  );

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay    = getFirstDay(calYear, calMonth);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openNew = (walkIn = false) => {
    setForm({ ...emptyForm(), date: selectedDate, isWalkIn: walkIn,
      customer: walkIn ? "Walk-in Guest" : "" });
    setEditingId(null);
    setShowModal(true);
  };
  const openEdit = (a: Appointment) => {
    setForm({ customer:a.customer, phone:a.phone, service:a.service, staff:a.staff,
      date:a.date, time:a.time, duration:a.duration, status:a.status,
      isWalkIn:a.isWalkIn, notes:a.notes });
    setEditingId(a._id);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingId(null); };

  // ── Save (create or update) ───────────────────────────────────────────────
  const saveAppointment = async () => {
    if (!form.customer || !form.service || !form.staff || !form.time) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`${API}/${editingId}`, {
          method: "PUT", headers: headers(), body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        const updated = (await res.json()) as Appointment;
        setAppointments(prev => prev.map(a => a._id === editingId ? updated : a));
      } else {
        const res = await fetch(API, {
          method: "POST", headers: headers(), body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = (await res.json()) as Appointment;
        if (created.date === selectedDate) {
          setAppointments(prev => [...prev, created]);
        }
        // refresh calendar dots
        void fetchCalDots();
      }
      closeModal();
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteAppt = async (id: string) => {
    if (!confirm("Delete this appointment?")) return;
    try {
      const res = await fetch(`${API}/${id}`, { method: "DELETE", headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      setAppointments(prev => prev.filter(a => a._id !== id));
      void fetchCalDots();
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to delete.");
    }
  };

  // ── Update status ─────────────────────────────────────────────────────────
  const updateStatus = async (id: string, status: Status) => {
    try {
      const res = await fetch(`${API}/${id}/status`, {
        method: "PATCH", headers: headers(), body: JSON.stringify({ status }),
      });
     if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as Appointment;
      setAppointments(prev => prev.map(a => a._id === id ? updated : a));
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to update status.");
    }
  };

  // ── Calendar nav ──────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const staffOf = (id: string) => staffList.find(s => s.id === id);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        .ap-root { min-height:100vh; background:#f5f0e8; font-family:'Jost',sans-serif; color:#2c1f0e; }

        .ap-topbar {
          height:60px; background:#fff; border-bottom:1px solid #ede5d6;
          display:flex; align-items:center; padding:0 28px; gap:14px;
        }
        .ap-page-title { font-family:'Cormorant Garamond',serif; font-size:22px; font-weight:400; color:#1a1208; }
        .ap-topbar-right { margin-left:auto; display:flex; align-items:center; gap:10px; }

        .ap-btn {
          height:36px; padding:0 16px; border:none; border-radius:8px;
          font-family:'Jost',sans-serif; font-size:11px; font-weight:500;
          letter-spacing:0.15em; text-transform:uppercase; cursor:pointer;
          display:inline-flex; align-items:center; gap:6px; transition:all 0.2s;
        }
        .ap-btn-primary   { background:#1a1208; color:#d4af37; }
        .ap-btn-primary:hover { background:#2d2010; }
        .ap-btn-primary:disabled { opacity:0.6; cursor:not-allowed; }
        .ap-btn-secondary { background:#faf8f4; border:1px solid #ede5d6; color:#6b5740; }
        .ap-btn-secondary:hover { border-color:#d4af37; background:#fffdf5; }
        .ap-btn-gold  { background:#d4af37; color:#1a1208; }
        .ap-btn-gold:hover { background:#c9a227; }
        .ap-btn-sm    { height:30px; padding:0 12px; font-size:10px; }

        .ap-view-toggle { display:flex; border:1px solid #ede5d6; border-radius:8px; overflow:hidden; }
        .ap-view-btn {
          height:34px; padding:0 14px; background:#faf8f4; border:none; cursor:pointer;
          font-family:'Jost',sans-serif; font-size:11px; font-weight:500; letter-spacing:0.1em;
          text-transform:uppercase; color:#8a7560; display:flex; align-items:center; gap:6px;
          transition:all 0.2s; border-right:1px solid #ede5d6;
        }
        .ap-view-btn:last-child { border-right:none; }
        .ap-view-btn.active { background:#1a1208; color:#d4af37; }

        /* error banner */
        .ap-error-banner {
          background:#fff5f5; border-bottom:1px solid #f5c6c6;
          padding:10px 28px; font-size:12px; color:#c0392b;
          display:flex; align-items:center; gap:8px;
        }
        .ap-error-close { margin-left:auto; background:none; border:none; cursor:pointer; color:#c0392b; }

        /* loading overlay */
        .ap-loading {
          position:absolute; inset:0; background:rgba(250,248,244,0.7);
          display:flex; align-items:center; justify-content:center; z-index:5;
        }
        .ap-spinner {
          width:24px; height:24px; border:2px solid rgba(212,175,55,0.3);
          border-top-color:#d4af37; border-radius:50%; animation:ap-spin 0.7s linear infinite;
        }

        .ap-body { display:grid; grid-template-columns:300px 1fr; height:calc(100vh - 60px); overflow:hidden; }
        @media(max-width:900px) { .ap-body { grid-template-columns:1fr; } }

        /* ── Left panel ── */
        .ap-left {
  background:#fff; border-right:1px solid #ede5d6; display:flex; flex-direction:column; overflow-y:auto;
  scrollbar-width:none;        /* Firefox */
  -ms-overflow-style:none;     /* IE/Edge legacy */
}
.ap-left::-webkit-scrollbar { display:none; }  /* Chrome/Safari/Edge */

        .ap-cal-header {
          display:flex; align-items:center; justify-content:space-between; padding:20px 20px 14px;
        }
        .ap-cal-month { font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:400; color:#1a1208; }
        .ap-cal-nav-btn {
          width:28px; height:28px; border:1px solid #ede5d6; background:#faf8f4;
          border-radius:6px; cursor:pointer; display:flex; align-items:center;
          justify-content:center; color:#6b5740; transition:all 0.2s;
        }
        .ap-cal-nav-btn:hover { border-color:#d4af37; color:#b8860b; }

        .ap-cal-days-header { display:grid; grid-template-columns:repeat(7,1fr); padding:0 12px 8px; }
        .ap-cal-day-name {
          text-align:center; font-size:10px; font-weight:500; letter-spacing:0.1em;
          text-transform:uppercase; color:#8a7560; padding:4px 0;
        }
        .ap-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); padding:0 12px 16px; gap:2px; }
        .ap-cal-cell {
          aspect-ratio:1; display:flex; flex-direction:column; align-items:center;
          justify-content:center; border-radius:8px; cursor:pointer; font-size:12px;
          color:#4a3820; transition:all 0.15s; position:relative; gap:3px;
        }
        .ap-cal-cell:hover { background:#faf5e8; }
        .ap-cal-cell.today { font-weight:500; color:#b8860b; }
        .ap-cal-cell.selected { background:#1a1208 !important; color:#d4af37 !important; }
        .ap-cal-cell.has-appts::after {
          content:''; width:5px; height:5px; border-radius:50%; background:#d4af37;
        }
        .ap-cal-cell.selected::after { background:rgba(212,175,55,0.5); }

        .ap-cal-stats { padding:0 16px 16px; display:flex; flex-direction:column; gap:8px; }
        .ap-cal-stat-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 12px; border-radius:8px; background:#faf8f4; border:1px solid #f0e8d8;
        }
        .ap-stat-label { font-size:12px; color:#6b5740; }
        .ap-stat-val { font-size:14px; font-weight:500; color:#1a1208; }

        .ap-staff-filter { padding:0 16px 20px; }
        .ap-filter-title {
          font-size:10px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase;
          color:#8a7560; margin-bottom:10px;
        }
        .ap-staff-chips { display:flex; flex-direction:column; gap:6px; }
        .ap-staff-chip {
          display:flex; align-items:center; gap:10px; padding:8px 10px;
          border-radius:8px; cursor:pointer; border:1px solid transparent; transition:all 0.15s;
        }
        .ap-staff-chip:hover { background:#faf5e8; border-color:#ede5d6; }
        .ap-staff-chip.active { background:#faf5e8; border-color:#d4af37; }
        .ap-chip-avatar {
          width:28px; height:28px; border-radius:50%; display:flex; align-items:center;
          justify-content:center; font-size:10px; font-weight:500; flex-shrink:0; color:#fff;
        }
        .ap-chip-name  { font-size:12px; font-weight:400; color:#2c1f0e; }
        .ap-chip-spec  { font-size:10px; color:#8a7560; margin-top:1px; }
        .ap-chip-count {
          margin-left:auto; font-size:11px; font-weight:500;
          background:#f0e8d8; color:#6b5740; padding:2px 7px; border-radius:20px;
        }

        /* ── Right ── */
        .ap-right { display:flex; flex-direction:column; overflow:hidden; position:relative; }

        .ap-toolbar {
          background:#fff; border-bottom:1px solid #ede5d6;
          padding:14px 24px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;
        }
        .ap-selected-date { font-family:'Cormorant Garamond',serif; font-size:18px; font-weight:400; color:#1a1208; }
        .ap-search-wrap { position:relative; flex:1; min-width:180px; max-width:280px; }
        .ap-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#8a7560; }
        .ap-search-input {
          width:100%; height:34px; border:1px solid #ede5d6; border-radius:8px;
          background:#faf8f4; padding:0 12px 0 34px;
          font-family:'Jost',sans-serif; font-size:13px; font-weight:300; color:#2c1f0e;
          outline:none; transition:border-color 0.2s;
        }
        .ap-search-input:focus { border-color:#d4af37; }
        .ap-search-input::placeholder { color:#c5b89a; }
        .ap-select {
          height:34px; border:1px solid #ede5d6; border-radius:8px; background:#faf8f4;
          padding:0 28px 0 12px; font-family:'Jost',sans-serif; font-size:12px; color:#6b5740;
          outline:none; cursor:pointer; appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 10px center;
        }
        .ap-select:focus { border-color:#d4af37; }

        /* calendar grid view */
     
.ap-cal-view {
  flex:1; overflow-y:auto; padding:20px 24px;
  display:grid; grid-template-columns:64px repeat(var(--staff-col-count, 1), 1fr); gap:0;
  align-items:start;   /* ← ADD: stop rows from stretching/clipping cells with 2+ stacked appointments */
  scrollbar-width:none;        /* Firefox */
  -ms-overflow-style:none;     /* IE/Edge legacy */
}
.ap-cal-view::-webkit-scrollbar { display:none; }  /* Chrome/Safari/Edge */
...
.ap-time-slot-cell { border-top:1px solid #f0e8d8; min-height:52px; height:auto; overflow:visible; padding:4px 6px; transition:background 0.15s; }
/*                                              ↑ ADD height:auto            ↑ ADD overflow:visible */
        .ap-time-label { font-size:10px; color:#8a7560; letter-spacing:0.06em; text-align:right; padding-right:12px; padding-top:2px; }
        .ap-time-slot-cell { border-top:1px solid #f0e8d8; min-height:52px; padding:4px 6px; transition:background 0.15s; }
        .ap-time-slot-cell:hover { background:#fdfbf7; }
        .ap-staff-col-header {
          text-align:center; font-size:11px; font-weight:500; letter-spacing:0.08em;
          text-transform:uppercase; color:#6b5740; padding:10px 6px;
          border-bottom:1px solid #ede5d6; border-left:1px solid #f0e8d8;
          background:#fff; position:sticky; top:0; z-index:2;
          display:flex; align-items:center; justify-content:center; gap:6px;
        }
        .ap-col-avatar {
          width:24px; height:24px; border-radius:50%; display:flex; align-items:center;
          justify-content:center; font-size:9px; font-weight:500; color:#fff; flex-shrink:0;
        }
        .ap-appt-block {
          border-radius:6px; padding:6px 8px; cursor:pointer; border-left:3px solid;
          margin-bottom:3px; transition:opacity 0.15s, transform 0.15s; animation:ap-fadeIn 0.3s ease;
        }
        .ap-appt-block:hover { opacity:0.88; transform:translateX(2px); }
        .ap-appt-block-name { font-size:11px; font-weight:500; color:#1a1208; line-height:1.2; }
        .ap-appt-block-svc  { font-size:10px; color:#6b5740; margin-top:1px; }
        .ap-walkin-tag {
          display:inline-flex; align-items:center; gap:3px;
          background:#faeeda; color:#633806; font-size:9px; font-weight:500;
          padding:1px 6px; border-radius:20px; letter-spacing:0.06em; text-transform:uppercase; margin-top:2px;
        }

        /* list view */
  .ap-list-view {
  flex:1; overflow-y:auto; padding:20px 24px;
  scrollbar-width:none;
  -ms-overflow-style:none;
}
.ap-list-view::-webkit-scrollbar { display:none; }
        .ap-list-empty {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding:60px 20px; color:#8a7560; gap:12px;
        }
        .ap-list-empty-icon { opacity:0.3; }
        .ap-list-empty-text { font-size:14px; font-weight:300; letter-spacing:0.06em; }
        .ap-list-item {
          background:#fff; border:1px solid #ede5d6; border-radius:12px;
          padding:16px 20px; margin-bottom:10px; display:flex; align-items:center; gap:16px;
          transition:box-shadow 0.2s, border-color 0.2s; animation:ap-fadeIn 0.3s ease;
        }
        .ap-list-item:hover { box-shadow:0 2px 16px rgba(44,31,14,0.07); border-color:#e0d5c0; }
        .ap-list-time {
          font-family:'Cormorant Garamond',serif; font-size:22px; font-weight:400;
          color:#1a1208; min-width:56px; text-align:center; line-height:1;
        }
        .ap-list-time-ampm { font-size:10px; font-weight:300; color:#8a7560; letter-spacing:0.06em; display:block; }
        .ap-list-vdivider  { width:1px; height:40px; background:#ede5d6; flex-shrink:0; }
        .ap-list-info { flex:1; min-width:0; }
        .ap-list-name { font-size:14px; font-weight:500; color:#1a1208; }
        .ap-list-svc  { font-size:12px; color:#6b5740; margin-top:2px; }
        .ap-list-meta { display:flex; align-items:center; gap:10px; margin-top:6px; flex-wrap:wrap; }
        .ap-list-staff { display:flex; align-items:center; gap:5px; font-size:11px; color:#8a7560; }
        .ap-list-staff-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .ap-list-phone { font-size:11px; color:#8a7560; display:flex; align-items:center; gap:4px; }
        .ap-status-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:11px; }
        .ap-status-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
        .ap-list-actions { display:flex; align-items:center; gap:6px; }
        .ap-icon-btn {
          width:30px; height:30px; border:1px solid #ede5d6; border-radius:6px;
          background:#faf8f4; cursor:pointer; display:flex; align-items:center;
          justify-content:center; color:#6b5740; transition:all 0.15s;
        }
        .ap-icon-btn:hover { border-color:#d4af37; color:#b8860b; background:#fffdf5; }
        .ap-icon-btn.danger:hover { border-color:#e74c3c; color:#e74c3c; background:#fff5f5; }
        .ap-status-select {
          height:28px; border:1px solid #ede5d6; border-radius:6px; background:#faf8f4;
          padding:0 22px 0 8px; font-family:'Jost',sans-serif; font-size:11px; color:#6b5740;
          outline:none; cursor:pointer; appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 8px center;
        }

        /* modal */
        .ap-overlay {
          position:fixed; inset:0; background:rgba(26,18,8,0.55);
          display:flex; align-items:center; justify-content:center; z-index:100;
          padding:20px; animation:ap-fadeIn 0.2s ease;
        }
        .ap-modal {
  background:#fff; border-radius:16px; width:100%; max-width:520px;
  max-height:90vh; overflow-y:auto;
  box-shadow:0 20px 60px rgba(26,18,8,0.25); animation:ap-slideUp 0.3s ease;
  scrollbar-width:none;        /* Firefox */
  -ms-overflow-style:none;     /* IE/Edge legacy */
}
.ap-modal::-webkit-scrollbar { display:none; }  /* Chrome/Safari/Edge */
        .ap-modal-header {
          padding:24px 28px 16px; display:flex; align-items:flex-start; justify-content:space-between;
          position:sticky; top:0; background:#fff; z-index:1; border-bottom:1px solid #f0e8d8;
        }
        .ap-modal-title { font-family:'Cormorant Garamond',serif; font-size:26px; font-weight:400; color:#1a1208; }
        .ap-modal-sub   { font-size:12px; color:#8a7560; margin-top:3px; letter-spacing:0.04em; }
        .ap-modal-close {
          width:32px; height:32px; border:1px solid #ede5d6; border-radius:8px; background:#faf8f4;
          cursor:pointer; display:flex; align-items:center; justify-content:center; color:#6b5740;
          transition:all 0.2s; flex-shrink:0;
        }
        .ap-modal-close:hover { border-color:#e74c3c; color:#e74c3c; background:#fff5f5; }
        .ap-modal-body { padding:20px 28px 28px; display:flex; flex-direction:column; gap:16px; }

        .ap-walkin-toggle {
          display:flex; align-items:center; gap:10px; padding:12px 14px;
          border:1px solid #ede5d6; border-radius:8px; background:#faf8f4; cursor:pointer; transition:all 0.2s;
        }
        .ap-walkin-toggle.on { border-color:#d4af37; background:#fffdf5; }
        .ap-walkin-toggle-label { font-size:13px; color:#2c1f0e; flex:1; }
        .ap-walkin-toggle-sub   { font-size:11px; color:#8a7560; }
        .ap-toggle-switch {
          width:36px; height:20px; border-radius:20px; background:#e0d5c0;
          position:relative; transition:background 0.2s; flex-shrink:0;
        }
        .ap-toggle-switch.on { background:#d4af37; }
        .ap-toggle-knob {
          position:absolute; top:2px; left:2px;
          width:16px; height:16px; border-radius:50%; background:#fff;
          transition:transform 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.2);
        }
        .ap-toggle-switch.on .ap-toggle-knob { transform:translateX(16px); }

        .ap-form-row   { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .ap-form-field { display:flex; flex-direction:column; gap:6px; }
        .ap-form-label { font-size:10px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; color:#6b5740; }
        .ap-form-input, .ap-form-select, .ap-form-textarea {
          height:40px; border:1px solid #e0d5c0; border-radius:8px; background:#fff;
          padding:0 12px; font-family:'Jost',sans-serif; font-size:13px; font-weight:300; color:#2c1f0e;
          outline:none; transition:border-color 0.2s, box-shadow 0.2s;
        }
        .ap-form-input:focus, .ap-form-select:focus, .ap-form-textarea:focus {
          border-color:#d4af37; box-shadow:0 0 0 3px rgba(212,175,55,0.1);
        }
        .ap-form-input::placeholder, .ap-form-textarea::placeholder { color:#c5b89a; }
        .ap-form-input:disabled { background:#f5f0e8; color:#8a7560; cursor:not-allowed; }
        .ap-form-select {
          appearance:none; cursor:pointer;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 12px center; padding-right:32px;
        }
        .ap-form-textarea { height:auto; padding:10px 12px; resize:vertical; min-height:64px; }

        .ap-staff-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
        .ap-staff-option {
          padding:10px 12px; border:1px solid #e0d5c0; border-radius:8px; cursor:pointer;
          display:flex; align-items:center; gap:8px; transition:all 0.2s;
        }
        .ap-staff-option:hover    { border-color:#d4af37; background:#fffdf5; }
        .ap-staff-option.selected { border-color:#d4af37; background:#fffdf5; box-shadow:inset 0 0 0 1px #d4af37; }
        .ap-staff-opt-avatar { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:500; color:#fff; flex-shrink:0; }
        .ap-staff-opt-name { font-size:12px; font-weight:400; color:#1a1208; }
        .ap-staff-opt-spec { font-size:10px; color:#8a7560; margin-top:1px; }

        .ap-whatsapp-section {
          border:1px solid #e8f5e9; background:#f1f8e9; border-radius:8px; padding:12px 14px;
          display:flex; align-items:center; gap:10px;
        }
        .ap-wa-icon { color:#25D366; flex-shrink:0; }
        .ap-wa-text { font-size:12px; color:#2e7d32; flex:1; }
        .ap-wa-btn {
          height:28px; padding:0 12px; border:1px solid #25D366; border-radius:6px;
          background:#fff; color:#25D366; font-family:'Jost',sans-serif; font-size:11px;
          font-weight:500; cursor:pointer; white-space:nowrap; transition:all 0.2s;
        }
        .ap-wa-btn:hover { background:#25D366; color:#fff; }

        .ap-modal-footer { display:flex; gap:10px; padding-top:4px; }
        .ap-btn-full { flex:1; height:44px; font-size:12px; }

        @keyframes ap-fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes ap-slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ap-spin    { to{transform:rotate(360deg)} }

        /* ════════════════════════════════════════════════════════════════════
           RESPONSIVE — TABLET (≤1024px) & MOBILE (≤600px)
           Layout/styling only — no functionality changed.
        ════════════════════════════════════════════════════════════════════ */

        /* ── Tablet & below (≤1024px) ── */
        @media (max-width: 1024px) {
          .ap-body { grid-template-columns: 260px 1fr; }
          .ap-staff-grid { grid-template-columns: 1fr 1fr; }
        }

        /* ── Tablet portrait / large phone (≤900px) — stacked layout ──
           Whole page scrolls naturally now (no clipped inner scroll box
           for the left panel — that was hiding the calendar/stats behind
           a short fixed-height container and leaving a blank gap). */
        @media (max-width: 900px) {
          .ap-topbar { flex-wrap: wrap; height: auto; min-height: 56px; padding: 10px 16px; }
          .ap-topbar-right { width: 100%; margin-left: 0; flex-wrap: wrap; }

          .ap-body {
            display: block;
            height: auto;
            overflow: visible;
          }
          .ap-left {
            border-right: none;
            border-bottom: 1px solid #ede5d6;
            max-height: none;
            overflow: visible;
          }
          .ap-right { overflow: visible; }
          .ap-loading { position: fixed; }

          /* staff-column table stays fully visible; scrolls sideways
             instead of squashing or clipping columns */
          .ap-cal-view {
            grid-template-columns: 56px repeat(var(--staff-col-count, 1), minmax(130px, 1fr));
            overflow-x: auto;
            overflow-y: visible;
            -webkit-overflow-scrolling: touch;
          }
          .ap-list-view { overflow-y: visible; }
          .ap-staff-col-header { position: sticky; top: 0; }

          .ap-toolbar { padding: 12px 16px; }
          .ap-search-wrap { max-width: none; flex: 1 1 200px; }

          .ap-modal { max-width: 480px; }
        }

        /* ── Mobile (≤600px) ── */
        @media (max-width: 600px) {
          .ap-page-title { font-size: 18px; }
          .ap-topbar-right { gap: 8px; }
          .ap-btn { padding: 0 12px; font-size: 10px; }
          .ap-view-btn { padding: 0 10px; }

          .ap-cal-header { padding: 16px 14px 10px; }
          .ap-cal-days-header, .ap-cal-grid { padding-left: 8px; padding-right: 8px; }
          .ap-cal-stats, .ap-staff-filter { padding-left: 12px; padding-right: 12px; }

          .ap-toolbar { padding: 10px 14px; gap: 8px; }
          .ap-selected-date { width: 100%; font-size: 16px; }
          .ap-search-wrap { flex: 1 1 100%; max-width: none; order: 2; }
          .ap-select { flex: 1 1 auto; order: 3; }

          .ap-cal-view { padding: 14px; }
          .ap-list-view { padding: 14px; }

          .ap-list-item { flex-wrap: wrap; padding: 14px; gap: 10px; }
          .ap-list-vdivider { display: none; }
          .ap-list-time { min-width: 46px; font-size: 18px; }
          .ap-list-info { flex: 1 1 60%; min-width: 140px; }
          .ap-status-badge { order: 4; }
          .ap-list-actions { width: 100%; order: 5; justify-content: flex-end; flex-wrap: wrap; }

          .ap-overlay { padding: 0; align-items: flex-end; }
          .ap-modal {
            max-width: 100%; width: 100%; max-height: 94vh;
            border-radius: 16px 16px 0 0; animation: ap-slideUp 0.3s ease;
          }
          .ap-modal-header { padding: 18px 18px 14px; }
          .ap-modal-title { font-size: 21px; }
          .ap-modal-body { padding: 16px 18px 24px; gap: 14px; }

          .ap-form-row { grid-template-columns: 1fr; }
          .ap-staff-grid { grid-template-columns: 1fr; }

          .ap-modal-footer { flex-direction: column-reverse; }
        }
      `}</style>

      <div className="ap-root">

        {/* ── Topbar ── */}
        <header className="ap-topbar">
          <div className="ap-page-title">Appointments</div>
          <div className="ap-topbar-right">
            <button className="ap-btn ap-btn-secondary ap-btn-sm" onClick={() => { void fetchAppointments(); }} title="Refresh">
              <Ic n="refresh" s={13}/> Refresh
            </button>
            <button className="ap-btn ap-btn-secondary ap-btn-sm" onClick={() => { void handleExportClick(); }} disabled={exporting} title="Download all appointments as Excel">
              {exporting ? "Exporting…" : <><Ic n="list" s={13}/> Export Excel</>}
            </button>
            <div className="ap-view-toggle">
              <button className={`ap-view-btn${view==="calendar"?" active":""}`} onClick={() => { setView("calendar"); }}>
                <Ic n="calendar" s={14}/> Calendar
              </button>
              <button className={`ap-view-btn${view==="list"?" active":""}`} onClick={() => { setView("list"); }}>
                <Ic n="list" s={14}/> List
              </button>
            </div>
            <button className="ap-btn ap-btn-gold" onClick={() => { openNew(true); }}>
              <Ic n="walkin" s={14}/> Walk-in
            </button>
            <button className="ap-btn ap-btn-primary" onClick={() => { openNew(false); }}>
              <Ic n="plus" s={14}/> New Booking
            </button>
          </div>
        </header>

        {/* Error banner */}
        {apiError && (
          <div className="ap-error-banner">
            ⚠ {apiError}
            <button className="ap-error-close" onClick={() => { setApiError(""); }}><Ic n="x" s={14}/></button>
          </div>
        )}

        <div className="ap-body">

          {/* ── Left ── */}
          <aside className="ap-left">
            <div className="ap-cal-header">
              <button className="ap-cal-nav-btn" onClick={prevMonth}><Ic n="chev_l" s={12}/></button>
              <span className="ap-cal-month">{MONTHS[calMonth]} {calYear}</span>
              <button className="ap-cal-nav-btn" onClick={nextMonth}><Ic n="chev_r" s={12}/></button>
            </div>
            <div className="ap-cal-days-header">
              {DAYS.map(d => <div key={d} className="ap-cal-day-name">{d}</div>)}
            </div>
            <div className="ap-cal-grid">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`b${i.toString()}`}/>)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day     = i + 1;
const dateStr = `${String(calYear)}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const isToday    = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const hasAppts   = !!calDots[dateStr];
                return (
                  <div key={day}
                    className={`ap-cal-cell${isToday?" today":""}${isSelected?" selected":""}${hasAppts&&!isSelected?" has-appts":""}`}
                    onClick={() => { setSelectedDate(dateStr); }}>
                    {day}
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            <div className="ap-cal-stats">
              <div className="ap-cal-stat-row">
                <span className="ap-stat-label">Bookings</span>
                <span className="ap-stat-val">{appointments.length}</span>
              </div>
              <div className="ap-cal-stat-row">
                <span className="ap-stat-label">Walk-ins</span>
                <span className="ap-stat-val">{appointments.filter(a=>a.isWalkIn).length}</span>
              </div>
              <div className="ap-cal-stat-row">
                <span className="ap-stat-label">Confirmed</span>
                <span className="ap-stat-val">{appointments.filter(a=>a.status==="confirmed").length}</span>
              </div>
            </div>

            {/* Staff filter */}
            <div className="ap-staff-filter">
              <div className="ap-filter-title">Filter by Staff</div>
              <div className="ap-staff-chips">
                <div className={`ap-staff-chip${filterStaff==="all"?" active":""}`}
                  onClick={() => { setFilterStaff("all"); }}>
                  <div className="ap-chip-avatar" style={{ background:"#8a7050" }}>All</div>
                  <div><div className="ap-chip-name">All Staff</div></div>
                  <span className="ap-chip-count">{appointments.length}</span>
                </div>
                {staffLoading ? (
                  <div style={{ padding: "10px 12px", fontSize: 11, color: "#8a7560" }}>Loading staff…</div>
                ) : staffList.length === 0 ? (
                  <div style={{ padding: "10px 12px", fontSize: 11, color: "#8a7560" }}>No active staff found.</div>
                ) : staffList.map(s => (
                  <div key={s.id}
                    className={`ap-staff-chip${filterStaff===s.id?" active":""}`}
                    onClick={() => { setFilterStaff(filterStaff===s.id?"all":s.id); }}>
                    <div className="ap-chip-avatar" style={{ background:s.color }}>{s.initials}</div>
                    <div>
                      <div className="ap-chip-name">{s.name}</div>
                      <div className="ap-chip-spec">{s.speciality}</div>
                    </div>
                    <span className="ap-chip-count">
                      {appointments.filter(a=>a.staff===s.id).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Right ── */}
          <div className="ap-right">
            {loading && <div className="ap-loading"><div className="ap-spinner"/></div>}

            {/* Toolbar */}
            <div className="ap-toolbar">
              <div className="ap-selected-date">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday:"long", day:"numeric", month:"long"
                })}
              </div>
              <div className="ap-search-wrap">
                <span className="ap-search-icon"><Ic n="search" s={14}/></span>
                <input className="ap-search-input" placeholder="Search customer or service…"
                  value={search} onChange={e => { setSearch(e.target.value); }}/>
              </div>
              <select className="ap-select" value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value as Status|"all"); }}>
                <option value="all">All statuses</option>
                {(Object.keys(STATUS_CFG) as Status[]).map(s => (
                  <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                ))}
              </select>
            </div>

            {/* Calendar view */}
            {view === "calendar" && (
              <div className="ap-cal-view"
                style={{ "--staff-col-count": Math.max(staffList.length, 1) } as React.CSSProperties}>
                <div style={{ gridColumn:"1/2", borderBottom:"1px solid #ede5d6", background:"#fff", position:"sticky", top:0, zIndex:2 }}/>
                {staffList.map(s => (
                  <div key={s.id} className="ap-staff-col-header">
                    <div className="ap-col-avatar" style={{ background:s.color }}>{s.initials}</div>
                    {s.name}
                  </div>
                ))}
                {TIME_SLOTS.map(slot => (
                  <Fragment key={slot}>
                    <div key={`lbl-${slot}`} className="ap-time-label">{fmtTime12(slot)}</div>
                   {staffList.map(s => {
                      const appts = dayAppointments.filter(a => a.staff === s.id && a.time.slice(0, 5) === slot);
                      return (
                        <div key={`${slot}-${s.id}`} className="ap-time-slot-cell"
                          style={{ borderLeft:"1px solid #f0e8d8" }}
                          onClick={() => { openNew(false); }}>
                          {appts.map(a => {
                            const sc = STATUS_CFG[a.status];
                            return (
                              <div key={a._id} className="ap-appt-block"
                                style={{ background:sc.bg, borderLeftColor:sc.dot }}
                                onClick={e => { e.stopPropagation(); openEdit(a); }}>
                                <div className="ap-appt-block-name">{a.customer}</div>
                                <div className="ap-appt-block-svc">{a.service}</div>
                                {a.isWalkIn && <div className="ap-walkin-tag"><Ic n="walkin" s={9}/>Walk-in</div>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            )}

            {/* List view */}
            {view === "list" && (
              <div className="ap-list-view">
                {dayAppointments.length === 0 && !loading ? (
                  <div className="ap-list-empty">
                    <div className="ap-list-empty-icon"><Ic n="calendar" s={48}/></div>
                    <div className="ap-list-empty-text">No appointments for this day</div>
                    <button className="ap-btn ap-btn-primary" onClick={() => { openNew(false); }}>
                      <Ic n="plus" s={14}/> Book Appointment
                    </button>
                  </div>
                ) : (
                  dayAppointments.map(a => {
                    const sc  = STATUS_CFG[a.status];
                    const stf = staffOf(a.staff);
                    const [hh = "0", mm = "00"] = a.time.split(":");
const h = parseInt(hh, 10);
const ampm = h >= 12 ? "PM" : "AM";
const h12 = h > 12 ? h - 12 : h || 12;
                    return (
                      <div key={a._id} className="ap-list-item">
                        <div className="ap-list-time">
                          {h12}:{mm}
                          <span className="ap-list-time-ampm">{ampm}</span>
                        </div>
                        <div className="ap-list-vdivider"/>
                        <div className="ap-list-info">
                          <div className="ap-list-name">
                            {a.customer}
                            {a.isWalkIn && (
                              <span style={{ marginLeft:8, fontSize:9, background:"#faeeda", color:"#633806",
                                border:"1px solid #f0d5b0", padding:"1px 7px", borderRadius:20,
                                fontWeight:500, letterSpacing:"0.08em", textTransform:"uppercase" }}>Walk-in</span>
                            )}
                          </div>
                          <div className="ap-list-svc">{a.service} · {a.duration} min</div>
                          <div className="ap-list-meta">
                            {stf && (
                              <span className="ap-list-staff">
                                <span className="ap-list-staff-dot" style={{ background:stf.color }}/>
                                {stf.name}
                              </span>
                            )}
                            {a.phone && (
                              <span className="ap-list-phone"><Ic n="phone" s={10}/>{a.phone}</span>
                            )}
                          </div>
                        </div>
                        <span className="ap-status-badge" style={{ background:sc.bg, color:sc.color }}>
                          <span className="ap-status-dot" style={{ background:sc.dot }}/>
                          {sc.label}
                        </span>
                        <div className="ap-list-actions">
  <select className="ap-status-select" value={a.status}
    disabled={a.status === "billed"}
    title={a.status === "billed" ? "Billed appointments can't be changed" : undefined}
    onChange={e => { void updateStatus(a._id, e.target.value as Status); }}
    onClick={e => { e.stopPropagation(); }}>
    {(Object.keys(STATUS_CFG) as Status[]).map(s => (
      <option key={s} value={s}>{STATUS_CFG[s].label}</option>
    ))}
  </select>
                          {a.status === "completed" && (
  <button className="ap-icon-btn" title="Generate Bill"
    onClick={() => { void navigate(`/billing?appointmentId=${a._id}`); }}>
    <Ic n="check" s={13}/>
  </button>
)}
                         <button className="ap-icon-btn" onClick={() => { openEdit(a); }} title="Edit"><Ic n="edit" s={13}/></button>
                          <button className="ap-icon-btn danger" onClick={() => { void deleteAppt(a._id); }} title="Delete"><Ic n="trash" s={13}/></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Modal ── */}
        {showModal && (
          <div className="ap-overlay" onClick={closeModal}>
            <div className="ap-modal" onClick={e => { e.stopPropagation(); }}>
              <div className="ap-modal-header">
                <div>
                  <div className="ap-modal-title">
                    {editingId ? "Edit Appointment" : form.isWalkIn ? "Walk-in Entry" : "New Booking"}
                  </div>
                  <div className="ap-modal-sub">
                    {editingId ? "Update appointment details"
                      : form.isWalkIn ? "Quick entry for walk-in customer"
                      : "Schedule a new appointment"}
                  </div>
                </div>
                <button className="ap-modal-close" onClick={closeModal}><Ic n="x" s={14}/></button>
              </div>

              <div className="ap-modal-body">
                {/* Walk-in toggle */}
                {!editingId && (
                  <div className={`ap-walkin-toggle${form.isWalkIn?" on":""}`}
                    onClick={() => { setForm(f => ({ ...f, isWalkIn:!f.isWalkIn,
                      customer: !f.isWalkIn ? "Walk-in Guest" : "" })); }}>
                    <div>
                      <div className="ap-walkin-toggle-label">Walk-in Customer</div>
                      <div className="ap-walkin-toggle-sub">No advance booking required</div>
                    </div>
                    <div className={`ap-toggle-switch${form.isWalkIn?" on":""}`}>
                      <div className="ap-toggle-knob"/>
                    </div>
                  </div>
                )}

                <div className="ap-form-field">
                  <label className="ap-form-label">Customer Name</label>
                  <input className="ap-form-input" placeholder="Full name"
                    value={form.customer} disabled={form.isWalkIn}
                    onChange={e => { setForm(f => ({ ...f, customer:e.target.value })); }}/>
                </div>

               {!form.isWalkIn && (
                  <div className="ap-form-field">
                    <label className="ap-form-label">
                      Mobile Number
                      {customerLookupLoading && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: "#8a7560", textTransform: "none", letterSpacing: 0 }}>
                          looking up…
                        </span>
                      )}
                      {!customerLookupLoading && customerNotFound && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: "#a32d2d", textTransform: "none", letterSpacing: 0 }}>
                          No customer found
                        </span>
                      )}
                    </label>
                    <input className="ap-form-input" placeholder="10-digit mobile number"
                      value={form.phone}
                      onChange={e => { setForm(f => ({ ...f, phone:e.target.value })); }}/>
                  </div>
                )}

                <div className="ap-form-row">
                 <div className="ap-form-field">
  <label className="ap-form-label">Service</label>
  <select className="ap-form-select" value={form.service}
    onChange={e => {
      const selected = SERVICES_CAT.find(s => s.name === e.target.value);
      setForm(f => ({
        ...f,
        service: e.target.value,
        duration: selected ? selected.duration : f.duration,
      }));
    }}>
    <option value="">Select service</option>
    {SERVICES_CAT.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
  </select>
</div>
                  <div className="ap-form-field">
                    <label className="ap-form-label">Duration (min)</label>
                    <select className="ap-form-select" value={form.duration}
                      onChange={e => { setForm(f => ({ ...f, duration:Number(e.target.value) })); }}>
                      {[15,30,45,60,75,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                </div>

                                <div className="ap-form-row">
                  <div className="ap-form-field">
                    <label className="ap-form-label">Date</label>
                    <input type="date" className="ap-form-input" value={form.date}
                      onChange={e => { setForm(f => ({ ...f, date:e.target.value })); }}/>
                  </div>
                  <div className="ap-form-field">
                    <label className="ap-form-label">
                      Time
                      {modalSlotsLoading && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: "#8a7560", textTransform: "none", letterSpacing: 0 }}>
                          checking availability…
                        </span>
                      )}
                    </label>
                    <select className="ap-form-select" value={form.time}
  onChange={e => { setForm(f => ({ ...f, time:e.target.value })); }}>
  {getAvailableSlots(form.date).map(t => {
    const isBooked = modalBookedTimes.includes(t);
    return (
      <option key={t} value={t} disabled={isBooked}>
        {fmtTime12(t)}{isBooked ? " (booked)" : ""}
      </option>
    );
  })}
</select>
                  </div>
                </div>

                <div className="ap-form-field">
                  <label className="ap-form-label">Assign Staff</label>
                  {staffLoading ? (
                    <div style={{ fontSize: 12, color: "#8a7560", padding: "8px 0" }}>Loading staff…</div>
                  ) : staffList.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#8a7560", padding: "8px 0" }}>
                      No active staff available. Add staff in Staff &amp; Roles first.
                    </div>
                  ) : (
                    <div className="ap-staff-grid">
                      {staffList.map(s => (
                        <div key={s.id}
                          className={`ap-staff-option${form.staff===s.id?" selected":""}`}
                          onClick={() => { setForm(f => ({ ...f, staff:s.id })); }}>
                          <div className="ap-staff-opt-avatar" style={{ background:s.color }}>{s.initials}</div>
                          <div>
                            <div className="ap-staff-opt-name">{s.name}</div>
                            <div className="ap-staff-opt-spec">{s.speciality}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="ap-form-field">
                  <label className="ap-form-label">Notes (optional)</label>
                  <textarea className="ap-form-textarea" placeholder="Allergies, preferences, special instructions…"
                    value={form.notes}
                    onChange={e => { setForm(f => ({ ...f, notes:e.target.value })); }}/>
                </div>

                {!form.isWalkIn && form.phone && (
                  <div className="ap-whatsapp-section">
                    <span className="ap-wa-icon"><Ic n="whatsapp" s={18}/></span>
                    <div className="ap-wa-text">Send WhatsApp confirmation to {form.phone}</div>
                    <button className="ap-wa-btn">Send</button>
                  </div>
                )}

                <div className="ap-modal-footer">
                  <button className="ap-btn ap-btn-secondary ap-btn-full" onClick={closeModal}>Cancel</button>
                  <button className="ap-btn ap-btn-primary ap-btn-full" onClick={() => { void saveAppointment(); }} disabled={saving}>
                    {saving ? "Saving…" : <><Ic n="check" s={14}/>{editingId ? "Save Changes" : "Confirm Booking"}</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}