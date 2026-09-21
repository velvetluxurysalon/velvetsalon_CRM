import { useState, useMemo, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────
export type StaffRole =
  | "admin"
  | "manager"
  | "senior_stylist"
  | "stylist"
  | "receptionist"
  | "support";

export type StaffStatus = "active" | "on_leave" | "inactive";

// Single unified StaffMember shape used by BOTH Staffrole and AttendancePage
export interface StaffMember {
  _id: string;          // primary key (maps to `id` alias in attendance)
  name: string;
  phone: string;
  email: string;
  role: StaffRole;
  speciality: string;
  status: StaffStatus;
  joinDate: string;
  exitDate: string;     // set when status === "inactive"
  notes: string;
  // Attendance-page display fields (computed/stored on server)
  color: string;        // avatar colour hex
  salary: number;
  salaryMode: "monthly" | "daily" | "hourly";
}

type StaffFormData = Omit<StaffMember, "_id">;
type StaffTab = "overview" | "access";

// ─── Static config ──────────────────────────────────────────────────────────
const ROLE_CFG: Record<
  StaffRole,
  { label: string; color: string; bg: string; description: string; permissions: string[] }
> = {
  admin: {
    label: "Admin",
    color: "#7c3aed",
    bg: "#f5f3ff",
    description: "Full access to every module, including staff and role management.",
    permissions: [
      "Dashboard", "Appointments", "Customers", "Billing", "Inventory",
      "Staff & Attendance", "Membership", "Reports", "Users & Roles",
    ],
  },
  manager: {
    label: "Manager",
    color: "#b8860b",
    bg: "#fefce8",
    description: "Runs daily salon operations across bookings, customers and stock.",
    permissions: [
      "Dashboard", "Appointments", "Customers", "Billing", "Inventory",
      "Staff & Attendance", "Membership", "Reports",
    ],
  },
  senior_stylist: {
    label: "Senior Stylist",
    color: "#0f766e",
    bg: "#f0fdfa",
    description: "Experienced service staff with customer history access.",
    permissions: ["Appointments", "Customers", "Staff & Attendance"],
  },
  stylist: {
    label: "Stylist",
    color: "#2563eb",
    bg: "#eff6ff",
    description: "Performs services and manages their own appointment schedule.",
    permissions: ["Appointments", "Staff & Attendance"],
  },
  receptionist: {
    label: "Receptionist",
    color: "#db2777",
    bg: "#fdf2f8",
    description: "Front-desk bookings, customer records and billing.",
    permissions: ["Appointments", "Customers", "Billing"],
  },
  support: {
    label: "Support Staff",
    color: "#6b7280",
    bg: "#f9fafb",
    description: "Housekeeping and general support duties.",
    permissions: ["Staff & Attendance"],
  },
};

const STATUS_CFG: Record<StaffStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:   { label: "Active",   color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
  on_leave: { label: "On Leave", color: "#b45309", bg: "#fffbeb", dot: "#f59e0b" },
  inactive: { label: "Left",     color: "#6b5740", bg: "#f5f0e8", dot: "#c5b89a" },
};

const FALLBACK_ROLE_CFG = {
  label: "Unknown", color: "#6b5740", bg: "#f5f0e8",
  description: "Unrecognised role — edit to assign a valid one.",
  permissions: [] as string[],
};
const FALLBACK_STATUS_CFG = { label: "Unknown", color: "#6b5740", bg: "#f5f0e8", dot: "#c5b89a" };

export const getRoleCfg = (role: StaffRole | undefined | null) =>
  role ? ROLE_CFG[role] : FALLBACK_ROLE_CFG;
export const getStatusCfg = (status: StaffStatus | undefined | null) =>
  status ? STATUS_CFG[status] : FALLBACK_STATUS_CFG;

const ALL_MODULES = [
  "Dashboard", "Appointments", "Customers", "Billing", "Inventory",
  "Staff & Attendance", "Membership", "Reports", "Users & Roles",
];

// ─── Shared API helpers (exported so AttendancePage can reuse) ───────────────
export const API_STAFF = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/staff-roles`;

export const getToken = (): string => {
  try { return (JSON.parse(localStorage.getItem("velvet_token") ?? "{}") as { token?: string }).token ?? ""; }
  catch { return ""; }
};
export const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export const todayStr = new Date().toISOString().slice(0, 10);

// ─── Avatar helpers (exported for AttendancePage) ────────────────────────────
const AVATAR_COLORS = ["#d4af37", "#8a7050", "#b8860b", "#6b5740", "#0f766e", "#7c3aed", "#db2777", "#2563eb"];
export const avatarColor = (name: string) => {
  const code = name[0]?.toUpperCase().charCodeAt(0) ?? 65;
  return AVATAR_COLORS[code % AVATAR_COLORS.length] ?? "#d4af37";
};
export const initials = (name: string) =>
  name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

// ─── Local helpers ───────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const emptyStaff = (): StaffFormData => ({
  name: "", phone: "", email: "", role: "stylist", speciality: "",
  status: "active", joinDate: todayStr, exitDate: "", notes: "",
  color: avatarColor("A"), salary: 0, salaryMode: "monthly",
});

// ─── Icons ──────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const p: Record<string, string> = {
    plus:       "M12 5v14M5 12h14",
    search:     "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    user:       "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    users:      "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    phone:      "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    mail:       "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
    calendar:   "M3 4h18v18H3zM3 10h18M8 2v4M16 2v4",
    edit:       "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z",
    trash:      "M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2",
    x:          "M18 6L6 18M6 6l12 12",
    check:      "M20 6L9 17l-5-5",
    refresh:    "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    shield:     "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    briefcase:  "M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",
    award:      "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12",
    arrowRight: "M5 12h14M13 5l7 7-7 7",
    rupee:      "M6 3h12M6 8h12M15 3a9 9 0 0 1 0 18H6M6 21l9-18",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {p[n]?.split("M").filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
    </svg>
  );
};

// ─── Avatar ──────────────────────────────────────────────────────────────────
export const Avatar = ({ name, size = 40, status, colorOverride }: {
  name: string; size?: number; status?: StaffStatus; colorOverride?: string;
}) => (
  <div
    className="rounded-full flex items-center justify-center text-white font-medium relative flex-shrink-0 font-['Cormorant_Garamond']"
    style={{
      width: size, height: size, fontSize: size * 0.38,
      background: colorOverride ?? avatarColor(name),
      opacity: status === "inactive" ? 0.45 : 1,
    }}
  >
    {initials(name || "?")}
    {status && status !== "active" && (
      <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"
        style={{ width: 12, height: 12, background: getStatusCfg(status).dot }} />
    )}
  </div>
);

// ─── Colour swatches ─────────────────────────────────────────────────────────
const SWATCH_COLORS = [
  "#d4af37", "#b8860b", "#8a7050", "#6b5740",
  "#0f766e", "#7c3aed", "#db2777", "#2563eb",
  "#a0522d", "#15803d",
];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function StaffPage() {
  const [staff, setStaff]               = useState<StaffMember[]>([]);
  const [selected, setSelected]         = useState<StaffMember | null>(null);
  const [activeTab, setActiveTab]       = useState<StaffTab>("overview");
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [apiError, setApiError]         = useState("");
  const [search, setSearch]             = useState("");
  const [filterRole, setFilterRole]     = useState<StaffRole | "all">("all");
  const [filterStatus, setFilterStatus] = useState<StaffStatus | "all">("all");

  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<StaffFormData>(emptyStaff());

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusDraft, setStatusDraft]         = useState<StaffStatus>("active");
  const [exitDateDraft, setExitDateDraft]     = useState("");

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setLoading(true); setApiError("");
    try {
      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (filterRole !== "all") params.append("role", filterRole);
      if (filterStatus !== "all") params.append("status", filterStatus);
      const res = await fetch(`${API_STAFF}?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as StaffMember[];

      setStaff(data);
      if (selected) {
        const fresh = data.find(s => s._id === selected._id);
        setSelected(fresh ?? null);
      }
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchStaff(); }, [fetchStaff]);

  const filteredStaff = useMemo(() =>
    staff.filter(s =>
      (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search)) &&
      (filterRole === "all" || s.role === filterRole) &&
      (filterStatus === "all" || s.status === filterStatus)
    ), [staff, search, filterRole, filterStatus]);

  const stats = useMemo(() => ({
    total:   staff.length,
    active:  staff.filter(s => s.status === "active").length,
    onLeave: staff.filter(s => s.status === "on_leave").length,
    left:    staff.filter(s => s.status === "inactive").length,
  }), [staff]);

  // ── Modal helpers ────────────────────────────────────────────────────────
  const openNew = () => { setForm(emptyStaff()); setEditingId(null); setShowModal(true); };
  const openEdit = (s: StaffMember) => {
    setForm({
      name: s.name, phone: s.phone, email: s.email, role: s.role,
      speciality: s.speciality, status: s.status, joinDate: s.joinDate,
      exitDate: s.exitDate, notes: s.notes,
      color: s.color || avatarColor(s.name),
salary: s.salary,
salaryMode: s.salaryMode,
    });
    setEditingId(s._id); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingId(null); };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveStaff = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      const payload: StaffFormData = {
        ...form,
        color: form.color || avatarColor(form.name),
      };
      if (editingId) {
        const res = await fetch(`${API_STAFF}/${editingId}`, {
          method: "PUT", headers: authHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        const updated = (await res.json()) as StaffMember;

        setStaff(prev => prev.map(s => s._id === editingId ? updated : s));
        if (selected?._id === editingId) setSelected(updated);
      } else {
        const res = await fetch(API_STAFF, {
          method: "POST", headers: authHeaders(), body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = (await res.json()) as StaffMember;

        setStaff(prev => [created, ...prev]);
        setSelected(created);
        setActiveTab("overview");
      }
      closeModal();
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to save staff member.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteStaff = async (id: string) => {
    if (!confirm("Permanently remove this staff member? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_STAFF}/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      setStaff(prev => prev.filter(s => s._id !== id));
      if (selected?._id === id) setSelected(null);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to remove staff member.");
    }
  };

  // ── Role change ──────────────────────────────────────────────────────────
  const changeRole = async (member: StaffMember, role: StaffRole) => {
    try {
      const res = await fetch(`${API_STAFF}/${member._id}`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify({ ...member, role }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as StaffMember;

      setStaff(prev => prev.map(s => s._id === member._id ? updated : s));
      setSelected(updated);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to update role.");
    }
  };

  // ── Status change ────────────────────────────────────────────────────────
  const openStatusModal = (member: StaffMember) => {
    setStatusDraft(member.status === "inactive" ? "active" : "inactive");
    setExitDateDraft(member.exitDate || todayStr);
    setShowStatusModal(true);
  };

  const applyStatusChange = async () => {
    if (!selected) return;
    try {
      const body = {
        ...selected, status: statusDraft,
        exitDate: statusDraft === "inactive" ? exitDateDraft : "",
      };
      const res = await fetch(`${API_STAFF}/${selected._id}`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as StaffMember;
      setStaff(prev => prev.map(s => s._id === selected._id ? updated : s));
      setSelected(updated);
      setShowStatusModal(false);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to update status.");
    }
  };

  // ── Shared style tokens ──────────────────────────────────────────────────
  const labelCls = "block text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5";
  const inputCls = "w-full h-10 border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] font-light text-[#2c1f0e] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/10 placeholder:text-[#c5b89a] transition-all";
  const selectCls = `${inputCls} appearance-none cursor-pointer pr-8`;
  const selectArrow = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat" as const,
    backgroundPosition: "right 12px center",
  };

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#f5f0e8] font-['Jost'] text-[#2c1f0e]">

      {/* TOPBAR */}
      <header className="h-[60px] bg-white border-b border-[#ede5d6] flex items-center px-7 gap-4">
        <h1 className="font-['Cormorant_Garamond'] text-[22px] font-normal text-[#1a1208]">Staff &amp; Roles</h1>
        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={() => { void fetchStaff(); }}
  className="h-9 px-4 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[11px] font-medium tracking-[0.12em] uppercase text-[#6b5740] hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all flex items-center gap-1.5">
  <Ic n="refresh" s={13} /> Refresh
</button>
          <button onClick={openNew}
            className="h-9 px-4 rounded-lg bg-[#1a1208] text-[#d4af37] text-[11px] font-medium tracking-[0.12em] uppercase hover:bg-[#2d2010] transition-all flex items-center gap-1.5">
            <Ic n="plus" s={14} /> Add Staff
          </button>
        </div>
      </header>

      {apiError && (
        <div className="bg-[#fff5f5] border-b border-[#f5c6c6] px-7 py-2.5 text-[12px] text-[#c0392b] flex items-center gap-2">
          ⚠ {apiError}
          <button className="ml-auto text-[#c0392b]" onClick={() => { setApiError(""); }}><Ic n="x" s={14} /></button>
        </div>
      )}

      {/* STATS */}
      <div className="px-7 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Staff", value: stats.total,   color: "#1a1208" },
          { label: "Active",      value: stats.active,  color: "#15803d" },
          { label: "On Leave",    value: stats.onLeave, color: "#b45309" },
          { label: "Left",        value: stats.left,    color: "#8a7560" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#ede5d6] rounded-xl px-5 py-4">
            <div className="font-['Cormorant_Garamond'] text-3xl font-light" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* BODY */}
      <div className="px-7 pb-8 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">

        {/* LIST PANEL */}
        <aside className="bg-white border border-[#ede5d6] rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#f0e8d8] flex flex-col gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7560]"><Ic n="search" s={14} /></span>
              <input
                className="w-full h-10 border border-[#ede5d6] rounded-lg bg-[#faf8f4] pl-9 pr-3 text-[13px] font-light text-[#2c1f0e] outline-none focus:border-[#d4af37] placeholder:text-[#c5b89a] transition-all"
                placeholder="Search name or phone…"
                value={search}
                onChange={e => { setSearch(e.target.value); }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => { setFilterRole("all"); }}
                className={`h-[26px] px-2.5 rounded-full text-[10px] font-medium tracking-[0.08em] uppercase border transition-all ${
                  filterRole === "all" ? "bg-[#1a1208] text-[#d4af37] border-[#1a1208]" : "bg-[#faf8f4] text-[#8a7560] border-[#ede5d6]"
                }`}>All Roles</button>
              {(Object.keys(ROLE_CFG) as StaffRole[]).map(r => (
                <button key={r} onClick={() => { setFilterRole(r); }}
                  className={`h-[26px] px-2.5 rounded-full text-[10px] font-medium tracking-[0.08em] uppercase border transition-all flex items-center gap-1.5 ${
                    filterRole === r ? "bg-[#1a1208] text-[#d4af37] border-[#1a1208]" : "bg-[#faf8f4] text-[#8a7560] border-[#ede5d6]"
                  }`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ROLE_CFG[r].color }} />
                  {ROLE_CFG[r].label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "active", "on_leave", "inactive"] as const).map(st => (
                <button key={st} onClick={() => { setFilterStatus(st); }}
                  className={`h-[26px] px-2.5 rounded-full text-[10px] font-medium tracking-[0.08em] uppercase border transition-all ${
                    filterStatus === st ? "bg-[#1a1208] text-[#d4af37] border-[#1a1208]" : "bg-[#faf8f4] text-[#8a7560] border-[#ede5d6]"
                  }`}>
                  {st === "all" ? "All Status" : STATUS_CFG[st as StaffStatus].label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-2.5 text-[11px] text-[#8a7560] tracking-[0.06em] border-b border-[#f5f0e8]">
            {filteredStaff.length} member{filteredStaff.length !== 1 ? "s" : ""}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[640px]">
            {loading ? (
              <div className="flex justify-center py-12">
                <span className="w-7 h-7 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#8a7560]">
                <Ic n="users" s={32} />
                <div className="text-[13px] font-light">No staff found</div>
              </div>
            ) : filteredStaff.map(s => {
              const rc = getRoleCfg(s.role);
              const sc = getStatusCfg(s.status);
              return (
                <div key={s._id}
                  onClick={() => { setSelected(s); setActiveTab("overview"); }}
                  className={`px-4 py-3 flex items-center gap-3 cursor-pointer border-b border-[#f5f0e8] transition-colors relative ${
                    selected?._id === s._id ? "bg-[#faf5e8]" : "hover:bg-[#faf8f4]"
                  }`}>
                  {selected?._id === s._id && (
                    <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#d4af37] rounded-r" />
                  )}
                  <Avatar name={s.name} size={38} status={s.status} colorOverride={s.color} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#1a1208]">{s.name}</div>
                    <div className="text-[11px] text-[#8a7560] mt-0.5 flex items-center gap-1">
                      <Ic n="phone" s={10} />{s.phone}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-medium tracking-[0.1em] uppercase px-2 py-0.5 rounded-full"
                      style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
                    <span className="text-[9px] font-medium tracking-[0.1em] uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{ background: sc.bg, color: sc.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                      {sc.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* DETAIL PANEL */}
        <div className="bg-white border border-[#ede5d6] rounded-2xl overflow-hidden">
          {!selected ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-[#8a7560]">
              <Ic n="user" s={56} />
              <div className="font-['Cormorant_Garamond'] text-2xl font-light">Select a staff member to view details</div>
              <button onClick={openNew}
                className="h-10 px-5 rounded-lg bg-[#1a1208] text-[#d4af37] text-[11px] font-medium tracking-[0.15em] uppercase hover:bg-[#2d2010] transition-all flex items-center gap-2">
                <Ic n="plus" s={14} /> Add Staff
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-7 py-5 border-b border-[#ede5d6] flex items-start gap-4">
                <Avatar name={selected.name} size={56} status={selected.status} colorOverride={selected.color} />
                <div className="flex-1 min-w-0">
                  <div className="font-['Cormorant_Garamond'] text-[28px] text-[#1a1208] leading-tight">{selected.name}</div>
                  <div className="text-[13px] text-[#6b5740] mt-1 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5"><Ic n="phone" s={12} />{selected.phone}</span>
                    {selected.email && <><span className="text-[#e0d5c0]">·</span>
                      <span className="flex items-center gap-1.5"><Ic n="mail" s={12} />{selected.email}</span></>}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-medium tracking-[0.12em] uppercase px-2.5 py-1 rounded-full"
                      style={{ background: getRoleCfg(selected.role).bg, color: getRoleCfg(selected.role).color }}>
                      {getRoleCfg(selected.role).label}
                    </span>
                    <span className="text-[10px] font-medium tracking-[0.12em] uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      style={{ background: getStatusCfg(selected.status).bg, color: getStatusCfg(selected.status).color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: getStatusCfg(selected.status).dot }} />
                      {getStatusCfg(selected.status).label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => { openEdit(selected); }}
                    className="h-9 px-3.5 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[11px] font-medium tracking-[0.1em] uppercase text-[#6b5740] hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all flex items-center gap-1.5">
                    <Ic n="edit" s={12} /> Edit
                  </button>
                  <button onClick={() => { openStatusModal(selected); }}
                    className="h-9 px-3.5 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[11px] font-medium tracking-[0.1em] uppercase text-[#6b5740] hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all flex items-center gap-1.5">
                    {selected.status === "inactive" ? "Reactivate" : "Mark as Left"}
                  </button>
                  <button onClick={() => { void deleteStaff(selected._id); }}
  className="w-9 h-9 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[#6b5740] hover:border-[#e74c3c] hover:text-[#e74c3c] hover:bg-[#fff5f5] transition-all flex items-center justify-center">
  <Ic n="trash" s={14} />
</button>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-7 border-b border-[#ede5d6] flex gap-6">
                {([
                  { id: "overview", label: "Overview", icon: "user" },
                  { id: "access",   label: "Role & Access", icon: "shield" },
                ] as { id: StaffTab; label: string; icon: string }[]).map(t => (
                  <button key={t.id} onClick={() => { setActiveTab(t.id); }}
                    className={`h-11 text-[11px] font-medium tracking-[0.12em] uppercase flex items-center gap-2 border-b-2 transition-all ${
                      activeTab === t.id ? "text-[#1a1208] border-[#d4af37]" : "text-[#8a7560] border-transparent hover:text-[#1a1208]"
                    }`}>
                    <Ic n={t.icon} s={13} /> {t.label}
                  </button>
                ))}
              </div>

              <div className="px-7 py-6">
                {/* OVERVIEW TAB */}
                {activeTab === "overview" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#faf8f4] border border-[#f0e8d8] rounded-xl p-5">
                      <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mb-3 flex items-center gap-2">
                        <Ic n="user" s={13} /> Contact Info
                      </div>
                      {[
                        { lbl: "Mobile",    val: selected.phone || "—" },
                        { lbl: "Email",     val: selected.email || "—" },
                      ].map(r => (
                        <div key={r.lbl} className="flex gap-3 mb-2.5 last:mb-0">
                          <span className="text-[11px] text-[#8a7560] min-w-[90px]">{r.lbl}</span>
                          <span className="text-[13px] text-[#1a1208]">{r.val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#faf8f4] border border-[#f0e8d8] rounded-xl p-5">
                      <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mb-3 flex items-center gap-2">
                        <Ic n="briefcase" s={13} /> Employment
                      </div>
                      {[
                        { lbl: "Speciality", val: selected.speciality || "—" },
                        { lbl: "Joined",     val: fmtDate(selected.joinDate) },
                        { lbl: "Left On",    val: selected.status === "inactive" ? fmtDate(selected.exitDate) : "—" },
                      ].map(r => (
                        <div key={r.lbl} className="flex gap-3 mb-2.5 last:mb-0">
                          <span className="text-[11px] text-[#8a7560] min-w-[90px]">{r.lbl}</span>
                          <span className="text-[13px] text-[#1a1208]">{r.val}</span>
                        </div>
                      ))}
                    </div>

                    {/* Salary info card */}
                    <div className="bg-[#faf8f4] border border-[#f0e8d8] rounded-xl p-5">
                      <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mb-3 flex items-center gap-2">
                        <Ic n="rupee" s={13} /> Salary
                      </div>
                      {[
                        { lbl: "Base Salary", val: selected.salary ? `₹${selected.salary.toLocaleString("en-IN")}` : "—" },
                        { lbl: "Pay Mode",    val: selected.salaryMode === "monthly" ? "Monthly" : selected.salaryMode === "daily" ? "Daily" : "Hourly" },
                      ].map(r => (
                        <div key={r.lbl} className="flex gap-3 mb-2.5 last:mb-0">
                          <span className="text-[11px] text-[#8a7560] min-w-[90px]">{r.lbl}</span>
                          <span className="text-[13px] text-[#1a1208]">{r.val}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-[#faf8f4] border border-[#f0e8d8] rounded-xl p-5 sm:col-span-2">
                      <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560] mb-3 flex items-center gap-2">
                        <Ic n="edit" s={13} /> Notes
                      </div>
                      <div className="text-[13px] text-[#4a3820] leading-relaxed min-h-[40px]">
                        {selected.notes || "No notes added."}
                      </div>
                    </div>
                  </div>
                )}

                {/* ACCESS TAB */}
                {activeTab === "access" && (
                  <div className="flex flex-col gap-5">
                    <div className="rounded-xl p-5 border border-[#ede5d6]"
                      style={{ background: getRoleCfg(selected.role).bg }}>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <div className="text-[10px] font-medium tracking-[0.2em] uppercase opacity-70"
                            style={{ color: getRoleCfg(selected.role).color }}>Current Role</div>
                          <div className="font-['Cormorant_Garamond'] text-3xl font-light mt-1"
                            style={{ color: getRoleCfg(selected.role).color }}>
                            {getRoleCfg(selected.role).label}
                          </div>
                          <p className="text-[12px] text-[#6b5740] mt-1.5 max-w-md">
                            {getRoleCfg(selected.role).description}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>Reassign Role</label>
                          <select className={selectCls} style={selectArrow}
                            value={selected.role}
                            onChange={e => { void changeRole(selected, e.target.value as StaffRole); }}>
                            {(Object.keys(ROLE_CFG) as StaffRole[]).map(r => (
                              <option key={r} value={r}>{ROLE_CFG[r].label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="border border-[#ede5d6] rounded-xl overflow-hidden">
                      <div className="px-5 py-3 bg-[#faf8f4] border-b border-[#ede5d6] text-[10px] font-medium tracking-[0.15em] uppercase text-[#8a7560]">
                        Module Access
                      </div>
                      <div className="divide-y divide-[#f5f0e8]">
                        {ALL_MODULES.map(mod => {
                          const has = getRoleCfg(selected.role).permissions.includes(mod);
                          return (
                            <div key={mod} className="px-5 py-2.5 flex items-center justify-between">
                              <span className="text-[13px] text-[#2c1f0e]">{mod}</span>
                              {has
                                ? <span className="text-[#15803d] flex items-center gap-1.5 text-[11px] font-medium"><Ic n="check" s={14} /> Access</span>
                                : <span className="text-[#c5b89a] text-[11px]">No access</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-[#faf5e8] border border-[#f0e4c0] rounded-xl px-5 py-3.5 text-[12px] text-[#6b5740] leading-relaxed flex items-start gap-2.5">
                      <Ic n="award" s={15} />
                      <span>Changing a staff member&apos;s role updates their module access immediately.</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-[#1a1208]/55 flex items-center justify-center z-[100] p-5" onClick={closeModal}>
         <div className="bg-white rounded-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onClick={e => { e.stopPropagation(); }}>
            <div className="px-7 pt-6 pb-4 border-b border-[#f0e8d8] flex items-start justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="font-['Cormorant_Garamond'] text-[26px] text-[#1a1208]">
                  {editingId ? "Edit Staff" : "Add Staff"}
                </div>
                <div className="text-[12px] text-[#8a7560] mt-1">
                  {editingId ? "Update staff details and role" : "Register a new staff member"}
                </div>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] hover:border-[#e74c3c] hover:text-[#e74c3c] transition-all">
                <Ic n="x" s={14} />
              </button>
            </div>

            <div className="px-7 py-5 flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className={labelCls}>Full Name *</label>
                <input className={inputCls} placeholder="Staff full name"
                  value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); }} />
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Mobile Number *</label>
                  <input className={inputCls} placeholder="10-digit mobile"
                    value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); }} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={inputCls} type="email" placeholder="email@example.com"
                    value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); }} />
                </div>
              </div>

              {/* Role + Speciality */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Role *</label>
                  <select className={selectCls} style={selectArrow} value={form.role}
                    onChange={e => { setForm(f => ({ ...f, role: e.target.value as StaffRole })); }}>
                    {(Object.keys(ROLE_CFG) as StaffRole[]).map(r => (
                      <option key={r} value={r}>{ROLE_CFG[r].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Speciality</label>
                  <input className={inputCls} placeholder="e.g. Hair & Colour"
                    value={form.speciality} onChange={e => { setForm(f => ({ ...f, speciality: e.target.value })); }} />
                </div>
              </div>

              {/* Role description hint */}
              <div className="bg-[#faf5e8] border border-[#f0e4c0] rounded-lg px-4 py-2.5 text-[11px] text-[#6b5740] leading-relaxed">
                {getRoleCfg(form.role).description}
              </div>

              {/* Join date + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Joining Date</label>
                  <input className={inputCls} type="date" value={form.joinDate}
                    onChange={e => { setForm(f => ({ ...f, joinDate: e.target.value })); }} />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={selectCls} style={selectArrow} value={form.status}
                    onChange={e => { setForm(f => ({ ...f, status: e.target.value as StaffStatus })); }}>
                    {(Object.keys(STATUS_CFG) as StaffStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.status === "inactive" && (
                <div>
                  <label className={labelCls}>Exit Date</label>
                  <input className={inputCls} type="date" value={form.exitDate}
                    onChange={e => { setForm(f => ({ ...f, exitDate: e.target.value })); }} />
                </div>
              )}

              {/* Salary + mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Base Salary (₹)</label>
                  <input className={inputCls} type="number" placeholder="0"
                    value={form.salary || ""}
                    onChange={e => { setForm(f => ({ ...f, salary: Number(e.target.value) })); }} />
                </div>
                <div>
                  <label className={labelCls}>Pay Mode</label>
                  <select className={selectCls} style={selectArrow} value={form.salaryMode}
                    onChange={e => { setForm(f => ({ ...f, salaryMode: e.target.value as StaffMember["salaryMode"] })); }}>
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
              </div>

              {/* Avatar colour */}
              <div>
                <label className={labelCls}>Avatar Colour</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {SWATCH_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, color: c })); }}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        background: c,
                        borderColor: form.color === c ? "#1a1208" : "transparent",
                        transform: form.color === c ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  className={`${inputCls} h-auto min-h-[80px] py-2.5 resize-y`}
                  placeholder="Skills, certifications, remarks…"
                  value={form.notes}
                  onChange={e => { setForm(f => ({ ...f, notes: e.target.value })); }}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={closeModal}
                  className="flex-1 h-11 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[12px] font-medium tracking-[0.12em] uppercase text-[#6b5740] hover:border-[#d4af37] transition-all">
                  Cancel
                </button>
                <button onClick={() => { void saveStaff(); }}
  disabled={saving || !form.name.trim() || !form.phone.trim()}
  className="flex-1 h-11 rounded-lg bg-[#1a1208] text-[#d4af37] text-[12px] font-medium tracking-[0.12em] uppercase hover:bg-[#2d2010] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
  {saving ? "Saving…" : <><Ic n="check" s={14} /> {editingId ? "Save Changes" : "Add Staff"}</>}
</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS CHANGE MODAL */}
      {showStatusModal && selected && (
        <div className="fixed inset-0 bg-[#1a1208]/55 flex items-center justify-center z-[100] p-5"
          onClick={() => { setShowStatusModal(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-[420px]" onClick={e => { e.stopPropagation(); }}>
            <div className="px-6 pt-6 pb-4 border-b border-[#f0e8d8]">
              <div className="font-['Cormorant_Garamond'] text-[24px] text-[#1a1208]">Update Status</div>
              <div className="text-[12px] text-[#8a7560] mt-1">Change employment status for {selected.name}</div>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className={labelCls}>Status</label>
                <select className={selectCls} style={selectArrow} value={statusDraft}
                  onChange={e => { setStatusDraft(e.target.value as StaffStatus); }}>
                  {(Object.keys(STATUS_CFG) as StaffStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                  ))}
                </select>
              </div>
              {statusDraft === "inactive" && (
                <div>
                  <label className={labelCls}>Last Working Day</label>
                  <input className={inputCls} type="date" value={exitDateDraft}
                    onChange={e => { setExitDateDraft(e.target.value); }} />
                  <p className="text-[11px] text-[#8a7560] mt-2 leading-relaxed">
                    Their record stays for history and reporting but they won&apos;t be available for new bookings.
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowStatusModal(false); }}
                  className="flex-1 h-11 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[12px] font-medium tracking-[0.12em] uppercase text-[#6b5740] hover:border-[#d4af37] transition-all">
                  Cancel
                </button>
                <button onClick={() => { void applyStatusChange(); }}
  className="flex-1 h-11 rounded-lg bg-[#1a1208] text-[#d4af37] text-[12px] font-medium tracking-[0.12em] uppercase hover:bg-[#2d2010] transition-all flex items-center justify-center gap-2">
  <Ic n="arrowRight" s={14} /> Update
</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}