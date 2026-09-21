import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

// ─── Types ─────────────────────────────────────────────────────────────────────
type MembershipTier = "none" | "silver" | "gold" | "platinum";
type CustomerTab = "overview" | "visits" | "services" | "loyalty" | "membership" | "referrals";

interface Visit {
  _id: string; date: string; services: string[]; staff: string; total: number; notes: string;
}
interface ServiceRecord {
  _id: string; date: string; service: string; staff: string; duration: number; price: number; rating?: number;
}
interface Referral {
  _id: string; referredName: string; referredPhone: string; date: string;
  status: "pending" | "converted" | "credited"; reward: number;
}
interface Customer {
  _id: string; name: string; phone: string; email: string; dob: string;
  anniversary: string;
  gender: "male" | "female" | "other"; joinDate: string; loyaltyPoints?: number;
  membershipTier: MembershipTier; membershipExpiry: string;
  visitCount?: number;
  totalSpent?: number;
  referralCode: string; referredBy: string; referredByCode: string;
  tags?: string[]; notes: string; visits?: Visit[]; services?: ServiceRecord[];
  referrals?: Referral[]; lastVisit: string;
}

// ── Staff member as returned by /api/staff-roles ────────────────────────────
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

// ─── Static config ─────────────────────────────────────────────────────────────
const MEMBERSHIP_CFG: Record<MembershipTier, { label: string; color: string; bg: string; icon: string; minSpend: number }> = {
  none:     { label: "No Membership", color: "#8a7560", bg: "#f5f0e8", icon: "○",  minSpend: 0 },
  silver:   { label: "Silver",        color: "#6b7280", bg: "#f3f4f6", icon: "◆",  minSpend: 5000 },
  gold:     { label: "Gold",          color: "#b8860b", bg: "#fefce8", icon: "◆",  minSpend: 15000 },
  platinum: { label: "Platinum",      color: "#7c3aed", bg: "#f5f3ff", icon: "◆",  minSpend: 40000 },
};

const API_BASE = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/customers`;
const STAFF_API_BASE = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/staff-roles`;
const token = (): string => {
  try {
    const parsed = JSON.parse(localStorage.getItem("velvet_token") ?? "{}") as { token?: string };
    return parsed.token ?? "";
  } catch {
    return "";
  }
};
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });
const todayStr = new Date().toISOString().slice(0, 10);

// ─── SVG Icons ─────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const p: Record<string, string> = {
    plus:"M12 5v14M5 12h14", search:"M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    user:"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    phone:"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    mail:"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
    calendar:"M3 4h18v18H3zM3 10h18M8 2v4M16 2v4",
    scissors:"M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12",
    star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    gift:"M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
    award:"M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12",
    users:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    edit:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z",
    trash:"M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2",
    x:"M18 6L6 18M6 6l12 12", check:"M20 6L9 17l-5-5",
    copy:"M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
    refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    whatsapp:"M12 2a10 10 0 0 1 8.93 14.47L22 22l-5.53-1.07A10 10 0 1 1 12 2z",
    clock:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
    tag:"M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {(p[n] ?? "").split("M").filter(Boolean).map((d, i) => <path key={i} d={`M${d}`}/>)}
    </svg>
  );
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => d ? new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "—";
const fmtCur  = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const initials = (name: string) => name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

// ── Excel export helper ──────────────────────────────────────────────────────
function downloadCustomersExcel(rows: Customer[], filename: string) {
  const sheetData = rows.map(c => ({
    Name: c.name,
    Phone: c.phone,
    Email: c.email,
    "Date of Birth": c.dob,
    Anniversary: c.anniversary,
    Gender: c.gender,
    "Join Date": c.joinDate,
    "Loyalty Points": c.loyaltyPoints ?? 0,
    "Membership Tier": MEMBERSHIP_CFG[c.membershipTier].label,
    "Membership Expiry": c.membershipExpiry,
    "Visit Count": c.visitCount ?? 0,
    "Total Spent": c.totalSpent ?? 0,
    "Referral Code": c.referralCode,
    "Referred By": c.referredByCode,
    Tags: (c.tags ?? []).join(", "),
    "Last Visit": c.lastVisit,
    Notes: c.notes,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  XLSX.writeFile(wb, filename);
}

/** Average of all rated (rating != null) service records, rounded to 1 decimal. Returns null if none rated. */
const avgServiceRating = (services?: ServiceRecord[]): number | null => {
  const rated = (services ?? []).filter((s): s is ServiceRecord & { rating: number } => s.rating != null);
  if (!rated.length) return null;
  return Math.round((rated.reduce((sum, s) => sum + s.rating, 0) / rated.length) * 10) / 10;
};

const emptyCustomer = (): Omit<Customer, "_id"|"visits"|"services"|"referrals"|"visitCount"|"totalSpent"|"referralCode"|"referredByCode"|"lastVisit"> & { tags: string[] } => ({
  name:"", phone:"", email:"", dob:"", anniversary:"", gender:"female",
  joinDate: todayStr, loyaltyPoints: 0, membershipTier:"none",
  membershipExpiry:"", referredBy:"", tags:[], notes:"",
});

// ─── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name, size=40, tier }: { name:string; size?:number; tier?:MembershipTier }) => {
  const colors: Record<string,string> = { A:"#d4af37",B:"#8a7050",C:"#b8860b",D:"#6b5740",E:"#d4af37" };
  const col = colors[name[0]?.toUpperCase() ?? "A"] ?? "#8a7050";
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:col, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:size*0.35, fontWeight:500, flexShrink:0, position:"relative", fontFamily:"'Cormorant Garamond',serif", border: tier && tier!=="none" ? `2px solid ${MEMBERSHIP_CFG[tier].color}` : "none" }}>
      {initials(name || "?")}
      {tier && tier!=="none" && (
        <span style={{ position:"absolute", bottom:-2, right:-2, width:14, height:14, borderRadius:"50%", background:MEMBERSHIP_CFG[tier].color, border:"1.5px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#fff" }}>◆</span>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [selected, setSelected]     = useState<Customer | null>(null);
  const [activeTab, setActiveTab]   = useState<CustomerTab>("overview");
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [apiError, setApiError]     = useState("");
  const [exporting, setExporting]   = useState(false);
  const [search, setSearch]         = useState("");
  const [filterTier, setFilterTier] = useState<MembershipTier | "all">("all");
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<Omit<Customer, "_id"|"visits"|"services"|"referrals"|"visitCount"|"totalSpent"|"referralCode"|"referredByCode"|"lastVisit"> & { tags: string[] }>(emptyCustomer());
  const [tagInput, setTagInput]     = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  // ── Live staff list (fetched from the Staff & Roles backend) ───────────────
  // Used to resolve staff IDs stored on visit/service records to display names,
  // so renaming/adding staff in Staff & Roles is reflected here automatically.
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  const fetchStaffList = useCallback(async () => {
    try {
      const res = await fetch(STAFF_API_BASE, { headers: headers() });
      if (!res.ok) return;
      const data = (await res.json()) as StaffMember[];
      setStaffList(data);
    } catch { /* non-critical — falls back to raw staff id/value */ }
  }, []);

  useEffect(() => { void fetchStaffList(); }, [fetchStaffList]);

  // Map of staff _id -> name, plus a fallback for legacy numeric ids ("1","2"…)
  // that may already exist in old visit/service records.
  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staffList) map.set(s._id, s.name);
    return map;
  }, [staffList]);

  const resolveStaffName = useCallback((staffRef: string) => {
    const key = staffRef.trim();
    if (!key) return "—";
    return staffNameById.get(key) ?? key;
  }, [staffNameById]);

  const selectedRef = useRef<Customer | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true); setApiError("");
    try {
      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (filterTier !== "all") params.append("tier", filterTier);
      const res = await fetch(`${API_BASE}?${params}`, { headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Customer[];
      setCustomers(data);
      const currentSelected = selectedRef.current;
      if (currentSelected) {
        try {
          const res2 = await fetch(`${API_BASE}/${currentSelected._id}`, { headers: headers() });
          if (res2.ok) setSelected((await res2.json()) as Customer);
        } catch {
          const r = data.find(c => c._id === currentSelected._id);
          if (r) setSelected(r);
        }
      }
    } catch (e: unknown) { setApiError(e instanceof Error ? e.message : "Failed to load customers."); }
    finally { setLoading(false); }
  }, [search, filterTier]);

  useEffect(() => { void fetchCustomers(); }, [fetchCustomers]);

  // ── Export all customers to Excel ────────────────────────────────────────
  const handleExportClick = async () => {
    setExporting(true);
    try {
      const res = await fetch(API_BASE, { headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      const all = (await res.json()) as Customer[];
      downloadCustomersExcel(all, `customers_${todayStr}.xlsx`);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to export customers.");
    } finally {
      setExporting(false);
    }
  };

  const filteredCustomers = useMemo(() =>
    customers.filter(c =>
      (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)) &&
      (filterTier === "all" || c.membershipTier === filterTier)
    ), [customers, search, filterTier]);

  const openNew = () => { setForm(emptyCustomer()); setEditingId(null); setTagInput(""); setShowModal(true); };
const openEdit = (c: Customer) => {
  setForm({ name:c.name, phone:c.phone, email:c.email, dob:c.dob, anniversary:c.anniversary, gender:c.gender, joinDate:c.joinDate, loyaltyPoints:c.loyaltyPoints ?? 0, membershipTier:c.membershipTier, membershipExpiry:c.membershipExpiry, referredBy:c.referredByCode, tags:[...(c.tags ?? [])], notes:c.notes });
  setEditingId(c._id); setTagInput(""); setShowModal(true);
};
  const closeModal = () => { setShowModal(false); setEditingId(null); };

  const saveCustomer = async () => {
    if (!form.name || !form.phone) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`${API_BASE}/${editingId}`, { method:"PUT", headers:headers(), body:JSON.stringify(form) });
        if (!res.ok) throw new Error(await res.text());
        const updated = (await res.json()) as Customer;
        setCustomers(prev => prev.map(c => c._id === editingId ? updated : c));
        if (selected?._id === editingId) setSelected(updated);
      } else {
        const res = await fetch(API_BASE, { method:"POST", headers:headers(), body:JSON.stringify(form) });
        if (!res.ok) throw new Error(await res.text());
        const created = (await res.json()) as Customer;
        setCustomers(prev => [created, ...prev]);
        setSelected(created);
      }
      closeModal();
    } catch (e: unknown) { setApiError(e instanceof Error ? e.message : "Failed to save."); }
    finally { setSaving(false); }
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method:"DELETE", headers:headers() });
      if (!res.ok) throw new Error(await res.text());
      setCustomers(prev => prev.filter(c => c._id !== id));
      if (selected?._id === id) setSelected(null);
    } catch (e: unknown) { setApiError(e instanceof Error ? e.message : "Failed to delete."); }
  };

  const addTag = () => { const t = tagInput.trim(); if (t && !form.tags.includes(t)) { setForm(f => ({ ...f, tags:[...f.tags, t] })); setTagInput(""); } };
  const removeTag = (t: string) => { setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) })); };
  const copyReferralCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => { setCopiedCode(true); setTimeout(() => { setCopiedCode(false); }, 2000); })
      .catch(() => { /* clipboard write failed — ignore */ });
  };

  const TAB_CFG: { id: CustomerTab; label: string; icon: string }[] = [
    { id:"overview",   label:"Overview",   icon:"user" },
    { id:"visits",     label:"Visits",     icon:"calendar" },
    { id:"services",   label:"Services",   icon:"scissors" },
    { id:"loyalty",    label:"Loyalty",    icon:"star" },
    { id:"membership", label:"Membership", icon:"award" },
    { id:"referrals",  label:"Referrals",  icon:"users" },
  ];

  // Average customer rating across this customer's rated service records
  // (sourced from ServiceRecord.rating — same field the Services tab table renders).
  const selectedAvgRating = useMemo(() => avgServiceRating(selected?.services), [selected]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .cm-root{min-height:100vh;background:#f5f0e8;font-family:'Jost',sans-serif;color:#2c1f0e}
        .cm-topbar{height:60px;background:#fff;border-bottom:1px solid #ede5d6;display:flex;align-items:center;padding:0 28px;gap:14px}
        .cm-page-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208}
        .cm-topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px}
        .cm-btn{height:36px;padding:0 16px;border:none;border-radius:8px;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s}
        .cm-btn-primary{background:#1a1208;color:#d4af37}.cm-btn-primary:hover{background:#2d2010}.cm-btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .cm-btn-secondary{background:#faf8f4;border:1px solid #ede5d6;color:#6b5740}.cm-btn-secondary:hover{border-color:#d4af37;background:#fffdf5}
        .cm-btn-sm{height:30px;padding:0 12px;font-size:10px}
        .cm-error-banner{background:#fff5f5;border-bottom:1px solid #f5c6c6;padding:10px 28px;font-size:12px;color:#c0392b;display:flex;align-items:center;gap:8px}
        .cm-error-close{margin-left:auto;background:none;border:none;cursor:pointer;color:#c0392b}
        .cm-body{display:grid;grid-template-columns:320px 1fr;height:calc(100vh - 60px);overflow:hidden}
        .cm-list-panel{background:#fff;border-right:1px solid #ede5d6;display:flex;flex-direction:column;overflow:hidden}
        .cm-list-toolbar{padding:16px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid #f0e8d8}
        .cm-search-wrap{position:relative}
        .cm-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#8a7560}
        .cm-search-input{width:100%;height:36px;border:1px solid #ede5d6;border-radius:8px;background:#faf8f4;padding:0 12px 0 34px;font-family:'Jost',sans-serif;font-size:13px;font-weight:300;color:#2c1f0e;outline:none;transition:border-color .2s}
        .cm-search-input:focus{border-color:#d4af37}.cm-search-input::placeholder{color:#c5b89a}
        .cm-tier-filters{display:flex;gap:6px;flex-wrap:wrap}
        .cm-tier-chip{height:26px;padding:0 10px;border-radius:20px;border:1px solid #ede5d6;background:#faf8f4;font-family:'Jost',sans-serif;font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;color:#8a7560;transition:all .15s;display:flex;align-items:center;gap:5px}
        .cm-tier-chip.active{background:#1a1208;color:#d4af37;border-color:#1a1208}
        .cm-tier-chip-dot{width:6px;height:6px;border-radius:50%}
        .cm-list-count{padding:10px 16px;font-size:11px;color:#8a7560;letter-spacing:.06em;border-bottom:1px solid #f5f0e8}
        .cm-list-scroll{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}
.cm-list-scroll::-webkit-scrollbar{display:none}
        .cm-list-item{padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;border-bottom:1px solid #f5f0e8;transition:background .15s;position:relative}
        .cm-list-item:hover{background:#faf8f4}.cm-list-item.active{background:#faf5e8}
        .cm-list-item.active::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#d4af37;border-radius:0 2px 2px 0}
        .cm-list-name{font-size:13px;font-weight:400;color:#1a1208;line-height:1.2}
        .cm-list-phone{font-size:11px;color:#8a7560;margin-top:2px;display:flex;align-items:center;gap:4px}
        .cm-list-meta{display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap}
        .cm-list-tier-badge{font-size:9px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;padding:1px 7px;border-radius:20px}
        .cm-list-pts{font-size:10px;color:#b8860b}
        .cm-list-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;color:#8a7560;gap:10px}
        .cm-detail-panel{display:flex;flex-direction:column;overflow:hidden}
        .cm-detail-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#8a7560}
        .cm-detail-empty-icon{opacity:.2}
        .cm-detail-empty-text{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:#8a7560}
        .cm-detail-header{background:#fff;border-bottom:1px solid #ede5d6;padding:20px 28px;display:flex;align-items:flex-start;gap:16px}
        .cm-detail-name-wrap{flex:1;min-width:0}
        .cm-detail-name{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:400;color:#1a1208;line-height:1.1}
        .cm-detail-phone{font-size:13px;color:#6b5740;margin-top:4px;display:flex;align-items:center;gap:6px}
        .cm-detail-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
        .cm-detail-tag{font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;padding:2px 9px;border-radius:20px;background:#f0e8d8;color:#6b5740;border:1px solid #e5d8c4}
        .cm-detail-actions{display:flex;gap:8px;align-items:center;flex-shrink:0}
        .cm-icon-btn{width:32px;height:32px;border:1px solid #ede5d6;border-radius:8px;background:#faf8f4;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b5740;transition:all .15s}
        .cm-icon-btn:hover{border-color:#d4af37;color:#b8860b;background:#fffdf5}.cm-icon-btn.danger:hover{border-color:#e74c3c;color:#e74c3c;background:#fff5f5}
        .cm-stats-row{background:#faf8f4;border-bottom:1px solid #ede5d6;padding:14px 28px;display:flex;gap:0}
        .cm-stat-cell{flex:1;display:flex;flex-direction:column;gap:3px;padding:0 16px;border-right:1px solid #ede5d6}
        .cm-stat-cell:first-child{padding-left:0}.cm-stat-cell:last-child{border-right:none}
        .cm-stat-label{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560}
        .cm-stat-value{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208;line-height:1}
        .cm-stat-sub{font-size:10px;color:#8a7560}
        .cm-tabs{background:#fff;border-bottom:1px solid #ede5d6;padding:0 28px;display:flex;gap:0;overflow-x:auto}
        .cm-tab{height:44px;padding:0 16px;border:none;background:none;cursor:pointer;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#8a7560;display:flex;align-items:center;gap:6px;border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap}
        .cm-tab:hover{color:#1a1208}.cm-tab.active{color:#1a1208;border-bottom-color:#d4af37}
       .cm-tab-content{flex:1;overflow-y:auto;padding:24px 28px;scrollbar-width:none;-ms-overflow-style:none}
.cm-tab-content::-webkit-scrollbar{display:none}
        .cm-overview-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .cm-info-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:18px 20px}
        .cm-info-card-title{font-size:10px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#8a7560;margin-bottom:14px;display:flex;align-items:center;gap:6px}
        .cm-info-row{display:flex;gap:10px;margin-bottom:10px;align-items:flex-start}.cm-info-row:last-child{margin-bottom:0}
        .cm-info-lbl{font-size:11px;color:#8a7560;min-width:90px;flex-shrink:0;padding-top:1px}
        .cm-info-val{font-size:13px;color:#1a1208;font-weight:400;word-break:break-all}
        .cm-notes-box{background:#faf8f4;border:1px solid #f0e8d8;border-radius:8px;padding:10px 12px;font-size:13px;font-weight:300;color:#4a3820;line-height:1.6;min-height:48px}
        .cm-table-wrap{background:#fff;border:1px solid #ede5d6;border-radius:12px;overflow:hidden}
        .cm-table{width:100%;border-collapse:collapse}
        .cm-table th{background:#faf8f4;padding:10px 16px;text-align:left;font-family:'Jost',sans-serif;font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560;border-bottom:1px solid #ede5d6}
        .cm-table td{padding:12px 16px;font-size:13px;color:#2c1f0e;border-bottom:1px solid #f5f0e8;vertical-align:middle}
        .cm-table tr:last-child td{border-bottom:none}.cm-table tr:hover td{background:#fdfbf7}
        .cm-empty-row td{text-align:center;color:#8a7560;padding:32px;font-size:13px}
        .cm-svc-pill{display:inline-block;background:#f0e8d8;color:#6b5740;font-size:10px;padding:2px 8px;border-radius:20px;margin:2px 3px 2px 0}
        .cm-rating-stars{display:flex;gap:2px;align-items:center}.cm-star-filled{color:#d4af37}.cm-star-empty{color:#e0d5c0}
        .cm-rating-empty{color:#c5b89a;font-size:12px;font-style:italic}
        .cm-loyalty-hero{background:linear-gradient(135deg,#1a1208 0%,#2d2010 60%,#3d2e18 100%);border-radius:16px;padding:28px;color:#d4af37;position:relative;overflow:hidden;margin-bottom:20px}
        .cm-loyalty-hero::before{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:rgba(212,175,55,.07);pointer-events:none}
        .cm-loyalty-pts-label{font-size:11px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;opacity:.7}
        .cm-loyalty-pts-val{font-family:'Cormorant Garamond',serif;font-size:56px;font-weight:300;line-height:1;margin:6px 0}
        .cm-loyalty-pts-sub{font-size:12px;opacity:.6}
        .cm-loyalty-prog-wrap{background:rgba(255,255,255,.1);border-radius:20px;height:6px;margin:16px 0 8px}
        .cm-loyalty-prog-bar{height:6px;border-radius:20px;background:#d4af37;transition:width .5s ease}
        .cm-loyalty-prog-text{font-size:11px;opacity:.65}
        .cm-loyalty-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px}
        .cm-loyalty-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:16px;text-align:center}
        .cm-loyalty-card-icon{font-size:22px;margin-bottom:6px}
        .cm-loyalty-card-val{font-family:'Cormorant Garamond',serif;font-size:22px;color:#1a1208}
        .cm-loyalty-card-lbl{font-size:10px;color:#8a7560;font-weight:500;letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
        .cm-member-card{border-radius:16px;padding:24px 28px;position:relative;overflow:hidden;margin-bottom:20px;color:#fff}
        .cm-member-card.none{background:#f5f0e8;color:#6b5740}
        .cm-member-card.silver{background:linear-gradient(135deg,#4b5563,#6b7280,#9ca3af)}
        .cm-member-card.gold{background:linear-gradient(135deg,#92400e,#b45309,#d97706)}
        .cm-member-card.platinum{background:linear-gradient(135deg,#4c1d95,#6d28d9,#7c3aed)}
        .cm-member-card::before{content:'';position:absolute;top:-30px;right:-30px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.08);pointer-events:none}
        .cm-member-tier-label{font-size:11px;font-weight:500;letter-spacing:.25em;text-transform:uppercase;opacity:.7}
        .cm-member-tier-name{font-family:'Cormorant Garamond',serif;font-size:38px;font-weight:300;margin:4px 0}
        .cm-member-expiry{font-size:12px;opacity:.65}
        .cm-member-perks{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:20px}
        .cm-member-perks-title{font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#8a7560;margin-bottom:14px}
        .cm-perk-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f5f0e8}.cm-perk-row:last-child{border-bottom:none}
        .cm-perk-icon{width:28px;height:28px;border-radius:8px;background:#faf5e8;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cm-perk-text{font-size:13px;color:#2c1f0e}.cm-perk-sub{font-size:11px;color:#8a7560}
        .cm-upgrade-row{display:flex;gap:10px;margin-top:16px}
        .cm-upgrade-card{flex:1;border:1px solid #ede5d6;border-radius:10px;padding:14px;cursor:pointer;transition:all .2s;text-align:center}
        .cm-upgrade-card:hover{border-color:#d4af37;background:#fffdf5}
        .cm-referral-hero{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;gap:20px}
        .cm-referral-code-box{background:#faf5e8;border:1px dashed #d4af37;border-radius:10px;padding:12px 20px;text-align:center;flex:1}
        .cm-referral-code{font-family:'Cormorant Garamond',serif;font-size:28px;letter-spacing:.2em;color:#1a1208}
        .cm-referral-code-sub{font-size:11px;color:#8a7560;margin-top:2px}
        .cm-referral-copy-btn{height:32px;padding:0 14px;border:1px solid #d4af37;border-radius:8px;background:#fff;color:#b8860b;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s;white-space:nowrap}
        .cm-referral-copy-btn:hover{background:#d4af37;color:#1a1208}
        .cm-referral-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        .cm-ref-stat{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:16px;text-align:center}
        .cm-ref-stat-val{font-family:'Cormorant Garamond',serif;font-size:28px;color:#1a1208}
        .cm-ref-stat-lbl{font-size:10px;color:#8a7560;font-weight:500;letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
        .cm-ref-status-badge{padding:2px 10px;border-radius:20px;font-size:10px;font-weight:500;letter-spacing:.06em;text-transform:uppercase}
        .cm-ref-pending{background:#fef9ec;color:#92400e}.cm-ref-converted{background:#eaf3de;color:#3b6d11}.cm-ref-credited{background:#e8f5e9;color:#1b5e20}
        .cm-overlay{position:fixed;inset:0;background:rgba(26,18,8,.55);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;animation:cm-fadeIn .2s ease}
       .cm-modal{background:#fff;border-radius:16px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(26,18,8,.25);animation:cm-slideUp .3s ease;scrollbar-width:none;-ms-overflow-style:none}
.cm-modal::-webkit-scrollbar{display:none}
        .cm-modal-header{padding:24px 28px 16px;display:flex;align-items:flex-start;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1;border-bottom:1px solid #f0e8d8}
        .cm-modal-title{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;color:#1a1208}
        .cm-modal-sub{font-size:12px;color:#8a7560;margin-top:3px;letter-spacing:.04em}
        .cm-modal-close{width:32px;height:32px;border:1px solid #ede5d6;border-radius:8px;background:#faf8f4;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b5740;transition:all .2s;flex-shrink:0}
        .cm-modal-close:hover{border-color:#e74c3c;color:#e74c3c;background:#fff5f5}
        .cm-modal-body{padding:20px 28px 28px;display:flex;flex-direction:column;gap:16px}
        .cm-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .cm-form-field{display:flex;flex-direction:column;gap:6px}
        .cm-form-label{font-size:10px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#6b5740}
        .cm-form-input,.cm-form-select,.cm-form-textarea{height:40px;border:1px solid #e0d5c0;border-radius:8px;background:#fff;padding:0 12px;font-family:'Jost',sans-serif;font-size:13px;font-weight:300;color:#2c1f0e;outline:none;transition:border-color .2s,box-shadow .2s}
        .cm-form-input:focus,.cm-form-select:focus,.cm-form-textarea:focus{border-color:#d4af37;box-shadow:0 0 0 3px rgba(212,175,55,.1)}
        .cm-form-input::placeholder,.cm-form-textarea::placeholder{color:#c5b89a}
        .cm-form-select{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
        .cm-form-textarea{height:auto;padding:10px 12px;resize:vertical;min-height:72px}
        .cm-tags-input-row{display:flex;gap:8px}
        .cm-tags-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
        .cm-tag-pill{display:inline-flex;align-items:center;gap:5px;background:#f0e8d8;color:#6b5740;font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid #e5d8c4}
        .cm-tag-remove{background:none;border:none;cursor:pointer;color:#8a7560;display:flex;padding:0}.cm-tag-remove:hover{color:#c0392b}
        .cm-modal-footer{display:flex;gap:10px;padding-top:4px}
        .cm-btn-full{flex:1;height:44px;font-size:12px}
        .cm-divider-label{display:flex;align-items:center;gap:10px;font-size:10px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#8a7560;margin:4px 0}
        .cm-divider-label::before,.cm-divider-label::after{content:'';flex:1;height:1px;background:#ede5d6}
        @keyframes cm-fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes cm-slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cm-spin{to{transform:rotate(360deg)}}
        .cm-spinner{width:24px;height:24px;border:2px solid rgba(212,175,55,.3);border-top-color:#d4af37;border-radius:50%;animation:cm-spin .7s linear infinite}
        .cm-loading-row{display:flex;justify-content:center;padding:40px}

        /* ════════════════════════════════════════════════════════════════════
           RESPONSIVE — TABLET (≤1024px) & MOBILE (≤600px)
           This page had no responsive rules before, which is why the detail
           panel (fixed 320px + 1fr grid) overflowed off the right edge of
           the screen on your phone. Layout/styling only — no functionality
           changed.
        ════════════════════════════════════════════════════════════════════ */

        /* ── Tablet (≤1024px) ── */
        @media (max-width: 1024px) {
          .cm-body { grid-template-columns: 260px minmax(0, 1fr); }
        }

        /* ── Tablet portrait / large phone (≤900px) — stacked layout ── */
        @media (max-width: 900px) {
          .cm-topbar { flex-wrap: wrap; height: auto; min-height: 56px; padding: 10px 16px; }
          .cm-topbar-right { width: 100%; margin-left: 0; flex-wrap: wrap; }

          .cm-body {
            display: block;
            height: auto;
            overflow: visible;
          }
          .cm-list-panel {
            border-right: none;
            border-bottom: 1px solid #ede5d6;
            max-height: 46vh;
            overflow: hidden;
          }
          .cm-detail-panel { overflow: visible; }
          .cm-tab-content { overflow-y: visible; }

          .cm-detail-header { flex-wrap: wrap; padding: 18px 20px; }
          .cm-detail-actions { width: 100%; justify-content: flex-end; }

          .cm-stats-row { overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 12px 20px; }
          .cm-stat-cell { min-width: 140px; flex: 0 0 auto; }

          .cm-tabs { padding: 0 20px; }
          .cm-overview-grid { grid-template-columns: 1fr; }

          .cm-table-wrap { overflow-x: auto; }
          .cm-table { min-width: 560px; }

          .cm-loyalty-grid { grid-template-columns: 1fr 1fr; }
          .cm-referral-stats { grid-template-columns: 1fr 1fr; }
          .cm-referral-hero { flex-wrap: wrap; }

          .cm-modal { max-width: 480px; }
        }

        /* ── Mobile (≤600px) ── */
        @media (max-width: 600px) {
          .cm-page-title { font-size: 18px; }
          .cm-btn { padding: 0 12px; font-size: 10px; }

          .cm-list-panel { max-height: 42vh; }
          .cm-list-toolbar { padding: 12px; }
          .cm-tier-filters { gap: 5px; }
          .cm-tier-chip { height: 24px; padding: 0 8px; font-size: 9px; }

          .cm-detail-header { padding: 16px; }
          .cm-detail-name { font-size: 22px; }

          .cm-stats-row { padding: 12px 16px; }
          .cm-tabs { padding: 0 16px; }
          .cm-tab { padding: 0 12px; font-size: 10px; }
          .cm-tab-content { padding: 16px; }

          .cm-loyalty-grid { grid-template-columns: 1fr; }
          .cm-referral-stats { grid-template-columns: 1fr; }
          .cm-referral-hero { padding: 16px; }
          .cm-referral-code-box { flex: 1 1 100%; }

          .cm-form-row { grid-template-columns: 1fr; }

          .cm-overlay { padding: 0; align-items: flex-end; }
          .cm-modal {
            max-width: 100%; width: 100%; max-height: 94vh;
            border-radius: 16px 16px 0 0;
          }
          .cm-modal-header { padding: 18px 18px 14px; }
          .cm-modal-title { font-size: 21px; }
          .cm-modal-body { padding: 16px 18px 24px; gap: 14px; }
          .cm-modal-footer { flex-direction: column-reverse; }
        }
      `}</style>

      <div className="cm-root">
        <header className="cm-topbar">
          <div className="cm-page-title">Customers</div>
          <div className="cm-topbar-right">
            <button className="cm-btn cm-btn-secondary cm-btn-sm" onClick={() => { void fetchCustomers(); }}><Ic n="refresh" s={13}/> Refresh</button>
            <button className="cm-btn cm-btn-secondary cm-btn-sm" onClick={() => { void handleExportClick(); }} disabled={exporting} title="Download all customers as Excel">
              {exporting ? "Exporting…" : <><Ic n="copy" s={13}/> Export Excel</>}
            </button>
            <button className="cm-btn cm-btn-primary" onClick={openNew}><Ic n="plus" s={14}/> Add Customer</button>
          </div>
        </header>

        {apiError && (
          <div className="cm-error-banner">
            ⚠ {apiError}
            <button className="cm-error-close" onClick={() => { setApiError(""); }}><Ic n="x" s={14}/></button>
          </div>
        )}

        <div className="cm-body">
          {/* ── List Panel ── */}
          <aside className="cm-list-panel">
            <div className="cm-list-toolbar">
              <div className="cm-search-wrap">
                <span className="cm-search-icon"><Ic n="search" s={14}/></span>
                <input className="cm-search-input" placeholder="Search name or phone…" value={search} onChange={e => { setSearch(e.target.value); }}/>
              </div>
              <div className="cm-tier-filters">
                {(["all","none","silver","gold","platinum"] as const).map(t => (
                  <button key={t} className={`cm-tier-chip${filterTier===t?" active":""}`} onClick={() => { setFilterTier(t); }}>
{t!=="all" && <span className="cm-tier-chip-dot" style={{ background:MEMBERSHIP_CFG[t as MembershipTier].color }}/>}
                    {t==="all" ? "All" : MEMBERSHIP_CFG[t as MembershipTier].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="cm-list-count">{filteredCustomers.length} customer{filteredCustomers.length!==1?"s":""}</div>
            <div className="cm-list-scroll">
              {loading ? (
                <div className="cm-loading-row"><div className="cm-spinner"/></div>
              ) : filteredCustomers.length===0 ? (
                <div className="cm-list-empty"><Ic n="users" s={36}/><div style={{ fontSize:13,fontWeight:300 }}>No customers found</div></div>
              ) : filteredCustomers.map(c => {
                const mc = MEMBERSHIP_CFG[c.membershipTier];
                return (
                  <div key={c._id} className={`cm-list-item${selected?._id===c._id?" active":""}`} onClick={() => {
  void (async () => {
    setActiveTab("overview");
    // Set basic info immediately for fast UI response
    setSelected(c);
    // Then fetch full detail including visits/services/referrals
    try {
      const res = await fetch(`${API_BASE}/${c._id}`, { headers: headers() });
      if (res.ok) setSelected((await res.json()) as Customer);
    } catch { /* keep basic data already set */ }
  })();
}}>
                    <Avatar name={c.name} size={38} tier={c.membershipTier}/>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div className="cm-list-name">{c.name}</div>
                      <div className="cm-list-phone"><Ic n="phone" s={10}/>{c.phone}</div>
                      <div className="cm-list-meta">
                        {c.membershipTier!=="none" && <span className="cm-list-tier-badge" style={{ background:mc.bg,color:mc.color }}>{mc.label}</span>}
                        {(c.loyaltyPoints ?? 0) > 0 && <span className="cm-list-pts">⭑ {(c.loyaltyPoints ?? 0).toLocaleString()} pts</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0 }}>
                      {/* ✅ visitCount / totalSpent */}
                      <div style={{ fontSize:11,color:"#8a7560" }}>{c.visitCount ?? 0} visits</div>
                      <div style={{ fontSize:11,color:"#b8860b",marginTop:2 }}>{fmtCur(c.totalSpent ?? 0)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ── Detail Panel ── */}
          <div className="cm-detail-panel">
            {!selected ? (
              <div className="cm-detail-empty">
                <div className="cm-detail-empty-icon"><Ic n="user" s={64}/></div>
                <div className="cm-detail-empty-text">Select a customer to view details</div>
                <button className="cm-btn cm-btn-primary" onClick={openNew}><Ic n="plus" s={14}/> Add Customer</button>
              </div>
            ) : (
              <>
                <div className="cm-detail-header">
                  <Avatar name={selected.name} size={52} tier={selected.membershipTier}/>
                  <div className="cm-detail-name-wrap">
                    <div className="cm-detail-name">{selected.name}</div>
                    <div className="cm-detail-phone">
                      <Ic n="phone" s={12}/>{selected.phone}
                      {selected.email && <><span style={{ color:"#e0d5c0" }}>·</span><Ic n="mail" s={12}/>{selected.email}</>}
                    </div>
                    {(selected.tags?.length ?? 0) > 0 && <div className="cm-detail-tags">{selected.tags?.map(t => <span key={t} className="cm-detail-tag">{t}</span>)}</div>}
                  </div>
                  <div className="cm-detail-actions">
                    <button className="cm-icon-btn" title="WhatsApp" onClick={() => window.open(`https://wa.me/91${selected.phone}`)}><Ic n="whatsapp" s={14}/></button>
                    <button className="cm-btn cm-btn-secondary cm-btn-sm" onClick={() => { openEdit(selected); }}><Ic n="edit" s={12}/> Edit</button>
                    <button className="cm-icon-btn danger" title="Delete" onClick={() => { void deleteCustomer(selected._id); }}><Ic n="trash" s={14}/></button>
                  </div>
                </div>

                {/* ✅ Stats with correct field names */}
                <div className="cm-stats-row">
                  {[
                    { label:"Total Visits",   value: selected.visitCount ?? 0,                                        sub: selected.lastVisit ? `Last: ${fmtDate(selected.lastVisit)}` : "No visits yet" },
                    { label:"Total Spend",    value: fmtCur(selected.totalSpent ?? 0),                                sub: selected.visitCount ? `Avg ₹${Math.round((selected.totalSpent??0)/selected.visitCount).toLocaleString("en-IN")}/visit` : "—" },
                    { label:"Loyalty Points", value: (selected.loyaltyPoints??0).toLocaleString(),                    sub: `≈ ${fmtCur(Math.floor((selected.loyaltyPoints??0)/10))} value` },
                    { label:"Membership",     value: MEMBERSHIP_CFG[selected.membershipTier].label,                  sub: selected.membershipExpiry ? `Expires ${fmtDate(selected.membershipExpiry)}` : "—" },
                    { label:"Referrals",      value: selected.referrals?.length ?? 0,                                 sub: `${(selected.referrals?.filter(r=>r.status==="converted").length??0).toString()} converted` },
                  ].map(s => (
                    <div key={s.label} className="cm-stat-cell">
                      <span className="cm-stat-label">{s.label}</span>
                      <span className="cm-stat-value">{s.value}</span>
                      <span className="cm-stat-sub">{s.sub}</span>
                    </div>
                  ))}
                </div>

                <div className="cm-tabs">
                  {TAB_CFG.map(t => (
                    <button key={t.id} className={`cm-tab${activeTab===t.id?" active":""}`} onClick={() => { setActiveTab(t.id); }}>
                      <Ic n={t.icon} s={13}/>{t.label}
                    </button>
                  ))}
                </div>

                <div className="cm-tab-content">

                  {/* OVERVIEW */}
                  {activeTab==="overview" && (
                    <div className="cm-overview-grid">
                      <div className="cm-info-card">
                        <div className="cm-info-card-title"><Ic n="user" s={13}/>Personal Info</div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Mobile</span><span className="cm-info-val">{selected.phone||"—"}</span></div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Email</span><span className="cm-info-val">{selected.email||"—"}</span></div>
                       <div className="cm-info-row"><span className="cm-info-lbl">Date of Birth</span><span className="cm-info-val">{selected.dob?fmtDate(selected.dob):"—"}</span></div>
<div className="cm-info-row"><span className="cm-info-lbl">Anniversary</span><span className="cm-info-val">{selected.anniversary?fmtDate(selected.anniversary):"—"}</span></div>
<div className="cm-info-row"><span className="cm-info-lbl">Gender</span><span className="cm-info-val" style={{ textTransform:"capitalize" }}>{selected.gender}</span></div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Member Since</span><span className="cm-info-val">{fmtDate(selected.joinDate)}</span></div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Referred By</span><span className="cm-info-val">{selected.referredByCode||"—"}</span></div>
                      </div>
                      <div className="cm-info-card">
                        <div className="cm-info-card-title"><Ic n="award" s={13}/>Account Summary</div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Total Visits</span><span className="cm-info-val">{selected.visitCount??0}</span></div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Total Spend</span><span className="cm-info-val">{fmtCur(selected.totalSpent??0)}</span></div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Loyalty Pts</span><span className="cm-info-val">{(selected.loyaltyPoints??0).toLocaleString()}</span></div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Membership</span>
                          <span className="cm-info-val"><span style={{ background:MEMBERSHIP_CFG[selected.membershipTier].bg,color:MEMBERSHIP_CFG[selected.membershipTier].color,padding:"1px 9px",borderRadius:20,fontSize:11,fontWeight:500 }}>{MEMBERSHIP_CFG[selected.membershipTier].label}</span></span>
                        </div>
                        {/* ── Avg. Rating: derived from ServiceRecord.rating, same field rendered in the Services tab ── */}
                        <div className="cm-info-row">
                          <span className="cm-info-lbl">Avg. Rating</span>
                          <span className="cm-info-val">
                            {selectedAvgRating == null ? (
                              <span className="cm-rating-empty">Not rated yet</span>
                            ) : (
                              <span className="cm-rating-stars">
                                {[1,2,3,4,5].map(i => (
                                  <span key={i} className={i <= Math.round(selectedAvgRating) ? "cm-star-filled" : "cm-star-empty"}>★</span>
                                ))}
                                <span style={{ color:"#8a7560", fontSize:11, marginLeft:4 }}>
                                  {selectedAvgRating.toFixed(1)} / 5
                                </span>
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Last Visit</span><span className="cm-info-val">{selected.lastVisit?fmtDate(selected.lastVisit):"—"}</span></div>
                        <div className="cm-info-row"><span className="cm-info-lbl">Referral Code</span>
                          <span className="cm-info-val" style={{ display:"flex",alignItems:"center",gap:6 }}>
                            <strong style={{ letterSpacing:"0.1em" }}>{selected.referralCode||"—"}</strong>
                            {selected.referralCode && <button style={{ background:"none",border:"none",cursor:"pointer",color:"#8a7560",padding:0 }} onClick={() => { copyReferralCode(selected.referralCode); }}><Ic n="copy" s={13}/></button>}
                          </span>
                        </div>
                      </div>
                      <div className="cm-info-card" style={{ gridColumn:"1/-1" }}>
                        <div className="cm-info-card-title"><Ic n="edit" s={13}/>Notes</div>
                        <div className="cm-notes-box">{selected.notes||"No notes added."}</div>
                      </div>
                    </div>
                  )}

                  {/* VISITS */}
                  {activeTab==="visits" && (
                    <div className="cm-table-wrap">
                      <table className="cm-table">
                        <thead><tr><th>Date</th><th>Services</th><th>Staff</th><th>Total</th><th>Notes</th></tr></thead>
                        <tbody>
                          {!selected.visits?.length ? <tr className="cm-empty-row"><td colSpan={5}>No visit history yet</td></tr>
                          : selected.visits.map(v => (
                            <tr key={v._id}>
                              <td style={{ whiteSpace:"nowrap" }}>{fmtDate(v.date)}</td>
                              <td>{v.services.map(s => <span key={s} className="cm-svc-pill">{s}</span>)}</td>
                             <td style={{ color:"#6b5740" }}>{resolveStaffName(v.staff)}</td>
                              <td style={{ color:"#b8860b",fontWeight:500 }}>{fmtCur(v.total)}</td>
                              <td style={{ color:"#8a7560",fontSize:12 }}>{v.notes||"—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SERVICES */}
                  {activeTab==="services" && (
                    <div className="cm-table-wrap">
                      <table className="cm-table">
                        <thead><tr><th>Date</th><th>Service</th><th>Staff</th><th>Duration</th><th>Price</th><th>Rating</th></tr></thead>
                        <tbody>
                          {!selected.services?.length ? <tr className="cm-empty-row"><td colSpan={6}>No service history yet</td></tr>
                          : selected.services.map(s => (
                            <tr key={s._id}>
                              <td style={{ whiteSpace:"nowrap" }}>{fmtDate(s.date)}</td>
                              <td><span className="cm-svc-pill">{s.service}</span></td>
                              <td style={{ color:"#6b5740" }}>{resolveStaffName(s.staff)}</td>
                              <td style={{ color:"#8a7560" }}>{s.duration} min</td>
                              <td style={{ color:"#b8860b",fontWeight:500 }}>{fmtCur(s.price)}</td>
                              <td>
                                {s.rating ? (
                                  <div className="cm-rating-stars">
                                    {[1,2,3,4,5].map(i=><span key={i} className={i<=(s.rating ?? 0)?"cm-star-filled":"cm-star-empty"}>★</span>)}
                                  </div>
                                ) : (
                                  <span className="cm-rating-empty">Not rated</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* LOYALTY */}
                  {activeTab==="loyalty" && (
                    <>
                      <div className="cm-loyalty-hero">
                        <div className="cm-loyalty-pts-label">Available Points</div>
                        <div className="cm-loyalty-pts-val">{(selected.loyaltyPoints??0).toLocaleString()}</div>
                        <div className="cm-loyalty-pts-sub">≈ {fmtCur(Math.floor((selected.loyaltyPoints??0)/10))} redeemable value</div>
                        {(() => {
                          const next = selected.membershipTier==="none"?500:selected.membershipTier==="silver"?1500:selected.membershipTier==="gold"?4000:null;
                          const pct = next?Math.min(100,Math.round(((selected.loyaltyPoints??0)/next)*100)):100;
                          return next ? (<><div className="cm-loyalty-prog-wrap"><div className="cm-loyalty-prog-bar" style={{ width:`${pct.toString()}%` }}/></div><div className="cm-loyalty-prog-text">{next-(selected.loyaltyPoints??0)} pts to next tier reward</div></>) : (<div className="cm-loyalty-prog-text" style={{ marginTop:16 }}>Maximum tier achieved 🎉</div>);
                        })()}
                      </div>
                      <div className="cm-loyalty-grid">
                        <div className="cm-loyalty-card"><div className="cm-loyalty-card-icon">⭑</div><div className="cm-loyalty-card-val">{(selected.loyaltyPoints??0).toLocaleString()}</div><div className="cm-loyalty-card-lbl">Total Earned</div></div>
                        <div className="cm-loyalty-card"><div className="cm-loyalty-card-icon">💰</div><div className="cm-loyalty-card-val">{fmtCur(selected.totalSpent??0)}</div><div className="cm-loyalty-card-lbl">Lifetime Spend</div></div>
                        <div className="cm-loyalty-card"><div className="cm-loyalty-card-icon">🎁</div><div className="cm-loyalty-card-val">{selected.referrals?.filter(r=>r.status==="credited").length??0}</div><div className="cm-loyalty-card-lbl">Referral Rewards</div></div>
                      </div>
                    </>
                  )}

                  {/* MEMBERSHIP */}
                  {activeTab==="membership" && (
                    <>
                      <div className={`cm-member-card ${selected.membershipTier}`}>
                        <div className="cm-member-tier-label">Current Tier</div>
                        <div className="cm-member-tier-name">{MEMBERSHIP_CFG[selected.membershipTier].label}</div>
                        {selected.membershipExpiry && <div className="cm-member-expiry">Valid until {fmtDate(selected.membershipExpiry)}</div>}
                      </div>
                      <div className="cm-member-perks" style={{ marginBottom:16 }}>
                        <div className="cm-member-perks-title">Membership Benefits</div>
                        {selected.membershipTier==="none" && <div style={{ color:"#8a7560",fontSize:13,padding:"8px 0" }}>No active membership. Upgrade to unlock perks.</div>}
                        {selected.membershipTier==="silver" && (<><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="tag" s={13}/></div><div><div className="cm-perk-text">10% off all services</div><div className="cm-perk-sub">Applied automatically at checkout</div></div></div><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="star" s={13}/></div><div><div className="cm-perk-text">1.5× loyalty points</div></div></div><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="gift" s={13}/></div><div><div className="cm-perk-text">Birthday month discount — 15%</div></div></div></>)}
                        {selected.membershipTier==="gold" && (<><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="tag" s={13}/></div><div><div className="cm-perk-text">20% off all services</div></div></div><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="star" s={13}/></div><div><div className="cm-perk-text">2× loyalty points</div></div></div><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="gift" s={13}/></div><div><div className="cm-perk-text">Birthday month discount — 25%</div></div></div><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="clock" s={13}/></div><div><div className="cm-perk-text">Priority booking</div></div></div></>)}
                        {selected.membershipTier==="platinum" && (<><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="tag" s={13}/></div><div><div className="cm-perk-text">30% off all services</div></div></div><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="star" s={13}/></div><div><div className="cm-perk-text">3× loyalty points</div></div></div><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="gift" s={13}/></div><div><div className="cm-perk-text">Birthday month — complimentary service</div></div></div><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="clock" s={13}/></div><div><div className="cm-perk-text">Priority booking + dedicated stylist</div></div></div><div className="cm-perk-row"><div className="cm-perk-icon"><Ic n="users" s={13}/></div><div><div className="cm-perk-text">Bring a guest — 10% off their service</div></div></div></>)}
                      </div>
                      {selected.membershipTier!=="platinum" && (
                        <div>
                          <div className="cm-divider-label">Upgrade Tier</div>
                          <div className="cm-upgrade-row" style={{ marginTop:12 }}>
                            {(["silver","gold","platinum"] as MembershipTier[]).filter(t=>t!==selected.membershipTier).map(t=>(
                              <div key={t} className="cm-upgrade-card">
                                <div style={{ fontSize:11,fontWeight:500,letterSpacing:"0.1em",textTransform:"uppercase",color:MEMBERSHIP_CFG[t].color }}>{MEMBERSHIP_CFG[t].label}</div>
                                <div style={{ fontSize:11,color:"#8a7560",marginTop:4 }}>from {fmtCur(MEMBERSHIP_CFG[t].minSpend)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* REFERRALS */}
                  {activeTab==="referrals" && (
                    <>
                      <div className="cm-referral-hero">
                        <div className="cm-referral-code-box">
                          <div style={{ fontSize:10,fontWeight:500,letterSpacing:"0.15em",textTransform:"uppercase",color:"#8a7560",marginBottom:4 }}>Referral Code</div>
                          <div className="cm-referral-code">{selected.referralCode||"—"}</div>
                          <div className="cm-referral-code-sub">Share to earn ₹100 per conversion</div>
                        </div>
                        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                          <button className="cm-referral-copy-btn" onClick={() => { copyReferralCode(selected.referralCode); }}>
                            <Ic n={copiedCode?"check":"copy"} s={13}/>{copiedCode?"Copied!":"Copy Code"}
                          </button>
                          <button className="cm-referral-copy-btn" onClick={() => window.open(`https://wa.me/?text=Use my referral code ${selected.referralCode} at Velvet Salon!`)}>
                            <Ic n="whatsapp" s={13}/>Share via WhatsApp
                          </button>
                        </div>
                      </div>
                      <div className="cm-referral-stats">
                        <div className="cm-ref-stat"><div className="cm-ref-stat-val">{selected.referrals?.length??0}</div><div className="cm-ref-stat-lbl">Total Referred</div></div>
                        <div className="cm-ref-stat"><div className="cm-ref-stat-val">{selected.referrals?.filter(r=>r.status==="converted").length??0}</div><div className="cm-ref-stat-lbl">Converted</div></div>
                        <div className="cm-ref-stat"><div className="cm-ref-stat-val">{fmtCur(selected.referrals?.reduce((sum,r)=>sum+(r.status==="credited"?r.reward:0),0)??0)}</div><div className="cm-ref-stat-lbl">Rewards Earned</div></div>
                      </div>
                      <div className="cm-table-wrap">
                        <table className="cm-table">
                          <thead><tr><th>Referred</th><th>Phone</th><th>Date</th><th>Status</th><th>Reward</th></tr></thead>
                          <tbody>
                            {!selected.referrals?.length ? <tr className="cm-empty-row"><td colSpan={5}>No referrals yet</td></tr>
                            : selected.referrals.map(r=>(
                              <tr key={r._id}>
                                <td>{r.referredName}</td>
                                <td style={{ color:"#6b5740" }}>{r.referredPhone}</td>
                                <td style={{ whiteSpace:"nowrap" }}>{fmtDate(r.date)}</td>
                                <td><span className={`cm-ref-status-badge cm-ref-${r.status}`}>{r.status}</span></td>
                                <td style={{ color:"#b8860b" }}>{fmtCur(r.reward)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Modal ── */}
        {showModal && (
          <div className="cm-overlay" onClick={closeModal}>
            <div className="cm-modal" onClick={e => { e.stopPropagation(); }}>
              <div className="cm-modal-header">
                <div>
                  <div className="cm-modal-title">{editingId?"Edit Customer":"Add Customer"}</div>
                  <div className="cm-modal-sub">{editingId?"Update customer details":"Register a new customer"}</div>
                </div>
                <button className="cm-modal-close" onClick={closeModal}><Ic n="x" s={14}/></button>
              </div>
              <div className="cm-modal-body">
                <div className="cm-form-row">
                  <div className="cm-form-field" style={{ gridColumn:"1/-1" }}>
                    <label className="cm-form-label">Full Name *</label>
                    <input className="cm-form-input" placeholder="Customer full name" value={form.name} onChange={e=>{ setForm(f=>({...f,name:e.target.value})); }}/>
                  </div>
                </div>
                <div className="cm-form-row">
                  <div className="cm-form-field">
                    <label className="cm-form-label">Mobile Number *</label>
                    <input className="cm-form-input" placeholder="10-digit mobile" value={form.phone} onChange={e=>{ setForm(f=>({...f,phone:e.target.value})); }}/>
                  </div>
                  <div className="cm-form-field">
                    <label className="cm-form-label">Email</label>
                    <input className="cm-form-input" placeholder="email@example.com" type="email" value={form.email} onChange={e=>{ setForm(f=>({...f,email:e.target.value})); }}/>
                  </div>
                </div>
                <div className="cm-form-row">
  <div className="cm-form-field">
    <label className="cm-form-label">Date of Birth</label>
    <input className="cm-form-input" type="date" value={form.dob} onChange={e=>{ setForm(f=>({...f,dob:e.target.value})); }}/>
  </div>
  <div className="cm-form-field">
    <label className="cm-form-label">Anniversary</label>
    <input className="cm-form-input" type="date" value={form.anniversary} onChange={e=>{ setForm(f=>({...f,anniversary:e.target.value})); }}/>
  </div>
</div>
<div className="cm-form-row">
  <div className="cm-form-field">
    <label className="cm-form-label">Gender</label>
    <select className="cm-form-select" value={form.gender} onChange={e=>{ setForm(f=>({...f,gender:e.target.value as Customer["gender"]})); }}>
      <option value="female">Female</option>
      <option value="male">Male</option>
      <option value="other">Other</option>
    </select>
  </div>
</div>
                <div className="cm-divider-label">Membership</div>
                <div className="cm-form-row">
                  <div className="cm-form-field">
                    <label className="cm-form-label">Membership Tier</label>
                    <select className="cm-form-select" value={form.membershipTier} onChange={e=>{ setForm(f=>({...f,membershipTier:e.target.value as MembershipTier})); }}>
                      {(Object.keys(MEMBERSHIP_CFG) as MembershipTier[]).map(t=><option key={t} value={t}>{MEMBERSHIP_CFG[t].label}</option>)}
                    </select>
                  </div>
                  <div className="cm-form-field">
                    <label className="cm-form-label">Membership Expiry</label>
                    <input className="cm-form-input" type="date" value={form.membershipExpiry} onChange={e=>{ setForm(f=>({...f,membershipExpiry:e.target.value})); }}/>
                  </div>
                </div>
                <div className="cm-form-row">
                  <div className="cm-form-field">
                    <label className="cm-form-label">Loyalty Points</label>
                    <input className="cm-form-input" type="number" min={0} placeholder="0" value={form.loyaltyPoints} onChange={e=>{ setForm(f=>({...f,loyaltyPoints:Number(e.target.value)})); }}/>
                  </div>
                  <div className="cm-form-field">
                    <label className="cm-form-label">Referred By (Code)</label>
                    <input className="cm-form-input" placeholder="Referral code" value={form.referredBy} onChange={e=>{ setForm(f=>({...f,referredBy:e.target.value})); }}/>
                  </div>
                </div>
                <div className="cm-form-field">
                  <label className="cm-form-label">Tags</label>
                  <div className="cm-tags-input-row">
                    <input className="cm-form-input" style={{ flex:1 }} placeholder="Add tag (e.g. VIP, Regular)" value={tagInput} onChange={e=>{ setTagInput(e.target.value); }} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag();}}}/>
                    <button className="cm-btn cm-btn-secondary cm-btn-sm" onClick={addTag}>Add</button>
                  </div>
                  {form.tags.length>0 && <div className="cm-tags-list">{form.tags.map(t=><span key={t} className="cm-tag-pill">{t}<button className="cm-tag-remove" onClick={()=>{ removeTag(t); }}><Ic n="x" s={10}/></button></span>)}</div>}
                </div>
                <div className="cm-form-field">
                  <label className="cm-form-label">Notes</label>
                  <textarea className="cm-form-textarea" placeholder="Allergies, preferences, special notes…" value={form.notes} onChange={e=>{ setForm(f=>({...f,notes:e.target.value})); }}/>
                </div>
                <div className="cm-modal-footer">
                  <button className="cm-btn cm-btn-secondary cm-btn-full" onClick={closeModal}>Cancel</button>
                  <button className="cm-btn cm-btn-primary cm-btn-full" onClick={() => { void saveCustomer(); }} disabled={saving}>
                    {saving?"Saving…":<><Ic n="check" s={14}/>{editingId?"Save Changes":"Add Customer"}</>}
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