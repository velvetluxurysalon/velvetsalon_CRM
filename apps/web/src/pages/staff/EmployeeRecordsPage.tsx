import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
// ─── Types ──────────────────────────────────────────────────────────────────
interface EmployeeJoiningSummary {
  _id: string;
  fullName: string;
  position: string;
  mobileNumber: string;
    totalExperience?: string;
  createdAt: string;
}

type EmployeeJoiningDetail = EmployeeJoiningSummary;

// ─── Static config ────────────────────────────────────────────────────────────
const SWATCH_COLORS = [
  "#d4af37", "#b8860b", "#8a7050", "#6b5740",
  "#a0522d", "#8b4513", "#cd853f", "#daa520",
  "#b8732b", "#9c6b3c",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? "").join("").toUpperCase() || "?";

const avatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SWATCH_COLORS[Math.abs(hash) % SWATCH_COLORS.length] ?? "#d4af37";
};

// ─── Small building blocks ──────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const paths: Record<string, string> = {
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
    refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    x: "M18 6L6 18M6 6l12 12",
    phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    people: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    check: "M20 6L9 17l-5-5",
    edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
    trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {(paths[n] ?? "").split("M").filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
    </svg>
  );
};

const EmpAvatar = ({ name, size = 32 }: { name: string; size?: number }) => (
  <div
    className="rounded-full flex items-center justify-center text-white flex-shrink-0"
    style={{
      width: size, height: size, fontSize: size * 0.38,
      background: avatarColor(name), fontFamily: "'Cormorant Garamond',serif",
    }}
  >
    {initials(name)}
  </div>
);

const Detail = ({ icon, label, value }: { icon?: string | undefined; label: string; value?: string | undefined }) => (
  <div>
    <div className="er-form-lbl">{label}</div>
    <div className="er-detail-val">
      {icon && <Ic n={icon} s={12} />}
      {value && value.trim() ? value : "—"}
    </div>
  </div>
);

// Field renders either a read-only Detail row or an editable input row,
// depending on the `editing` flag.
const Field = ({
  icon, label, value, editing, onChange,
}: {
  icon?: string | undefined;
  label: string;
  value?: string | undefined;
  editing: boolean;
  onChange?: ((v: string) => void) | undefined;
}) => {
  if (editing) {
    return (
      <div>
        <div className="er-form-lbl">{label}</div>
        <div className="er-edit-input-wrap">
          {icon && <Ic n={icon} s={12} />}
          <input
            type="text"
            className="er-edit-input"
            value={value ?? ""}
            onChange={e => onChange?.(e.target.value)}
          />
        </div>
      </div>
    );
  }
  return <Detail icon={icon} label={label} value={value} />;
};

const SectionCard = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
  <div className="er-card">
    <div className="er-ch">
      <div className="er-ct"><Ic n={icon} s={13} />{title}</div>
    </div>
    <div className="er-cb">
      <div className="er-detail-grid">{children}</div>
    </div>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function EmployeeRecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<EmployeeJoiningSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<EmployeeJoiningDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

   const [search, setSearch] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EmployeeJoiningDetail>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const authHeaders = user?.token ? { Authorization: `Bearer ${user.token}` } : {};

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/employee-joining`, { headers: authHeaders });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message ?? body?.error ?? `Failed to load records (${String(res.status)})`);
      }
      const data = (await res.json()) as EmployeeJoiningSummary[];
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load employee records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setSelected(null);
    try {
      const res = await fetch(`${API_BASE}/api/employee-joining/${id}`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load record");
      const data = (await res.json()) as EmployeeJoiningDetail;
      setSelected(data);
    } catch {
      setDetailError("Couldn't load that record.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetailError(null);
    setIsEditing(false);
    setEditForm({});
    setSaveError(null);
    setConfirmDelete(false);
  };

  const startEdit = () => {
    if (!selected) return;
    setEditForm({ ...selected });
    setIsEditing(true);
    setSaveError(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
    setSaveError(null);
  };

  const updateField = (key: keyof EmployeeJoiningDetail, value: string) => {
    setEditForm(prev => ({ ...prev, [key]: value }));
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_BASE}/api/employee-joining/${selected._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to save changes");
      const updated = (await res.json()) as EmployeeJoiningDetail;
      setSelected(updated);
      setRecords(prev => prev.map(r => (r._id === updated._id ? { ...r, ...updated } : r)));
      setIsEditing(false);
      setEditForm({});
    } catch {
      setSaveError("Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async () => {
    if (!selected) return;
    setDeleting(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_BASE}/api/employee-joining/${selected._id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to delete record");
      setRecords(prev => prev.filter(r => r._id !== selected._id));
      closeDetail();
    } catch {
      setSaveError("Couldn't delete record.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
       return records.filter(r => {
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.position.toLowerCase().includes(q) ||
        r.mobileNumber.toLowerCase().includes(q)
      );
    });
  }, [records, search]);

  const total = records.length;

  // Excel export — one row per currently filtered/searched record.
  const downloadExcel = () => {
    if (filtered.length === 0) return;
    setExporting(true);
    try {
           const header = ["Full Name", "Position", "Mobile", "Experience"];
      const rows = filtered.map(d => [
        d.fullName,
        d.position,
        d.mobileNumber,
        d.totalExperience ?? "",
      ]);

      const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Employee Records");
      XLSX.writeFile(wb, `employee_records_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .er-page{display:flex;flex-direction:column;min-height:100vh;background:#f5f0e8;font-family:'Jost',sans-serif;color:#2c1f0e}
        .er-topbar{min-height:60px;background:#fff;border-bottom:1px solid #ede5d6;display:flex;align-items:center;padding:0 28px;gap:14px;flex-shrink:0;flex-wrap:wrap}
        .er-page-title-wrap{margin-right:auto}
        .er-page-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208;letter-spacing:.02em;text-transform:uppercase}
        .er-page-sub{font-size:11px;font-style:italic;color:#8a7560;margin-top:2px}
        .er-topbar-right{display:flex;align-items:center;gap:10px}
        .er-err{background:#fff5f5;border-bottom:1px solid #f5c6c6;padding:9px 28px;font-size:12px;color:#c0392b;display:flex;align-items:center;gap:8px;flex-shrink:0}
        .er-err button{margin-left:auto;background:none;border:none;cursor:pointer;color:#c0392b;display:flex}
        .er-body{flex:1;padding:22px 28px;display:flex;flex-direction:column;gap:16px}
        .er-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        .er-stat{padding:14px 16px;border:1px solid #ede5d6;border-radius:12px;background:#fff}
        .er-stat-val{font-family:'Cormorant Garamond',serif;font-size:26px;color:#1a1208;line-height:1}
        .er-stat-lbl{font-size:10px;color:#8a7560;font-weight:500;letter-spacing:.1em;text-transform:uppercase;margin-top:4px}
        .er-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;overflow:hidden}
        .er-ch{padding:14px 18px;border-bottom:1px solid #f0e8d8;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
        .er-ct{font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#8a7560;display:flex;align-items:center;gap:7px}
        .er-cb{padding:18px}
        .er-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .er-search{position:relative;flex:1;min-width:200px}
        .er-search input{width:100%;height:38px;border:1px solid #e0d5c0;border-radius:8px;background:#faf8f4;padding:0 12px 0 36px;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e;outline:none;transition:border-color .2s}
        .er-search input:focus{border-color:#d4af37;background:#fff}
        .er-search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#8a7560}
        .er-filter-row{display:flex;gap:6px;flex-wrap:wrap}
        .er-filter-btn{height:32px;padding:0 13px;border-radius:20px;border:1.5px solid #e0d5c0;background:#fff;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;color:#6b5740;cursor:pointer;transition:all .15s;white-space:nowrap}
        .er-filter-btn:hover{border-color:#d4af37}
        .er-filter-btn.active{background:#1a1208;border-color:#1a1208;color:#d4af37}
        .er-filter-btn-danger{background:#b91c1c;border-color:#b91c1c;color:#fff}
        .er-filter-btn-danger:hover{border-color:#b91c1c}
        .er-filter-btn:disabled{opacity:.6;cursor:not-allowed}
        .er-icon-btn{width:36px;height:36px;border:1px solid #ede5d6;border-radius:8px;background:#faf8f4;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b5740;transition:all .15s;flex-shrink:0}
        .er-icon-btn:hover{border-color:#d4af37;color:#b8860b}
        .er-icon-btn:disabled{opacity:.6;cursor:not-allowed}
        .er-icon-btn-primary{background:#1a1208;border-color:#1a1208;color:#d4af37}
        .er-icon-btn-primary:hover{color:#f0d774}
        .er-icon-btn-danger{color:#b91c1c}
        .er-icon-btn-danger:hover{border-color:#b91c1c;color:#b91c1c}
        .er-spin{width:14px;height:14px;border:2px solid rgba(212,175,55,.3);border-top-color:#d4af37;border-radius:50%;animation:er-spin .7s linear infinite;flex-shrink:0}
        .er-empty{font-size:12px;color:#8a7560;text-align:center;padding:36px 0}
        .er-tbl-wrap{overflow-x:auto}
        .er-tbl{width:100%;border-collapse:collapse;min-width:640px}
        .er-tbl th{font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#8a7560;padding:0 12px 10px;text-align:left;border-bottom:1px solid #f0e8d8}
        .er-tbl td{padding:12px;border-bottom:1px solid #f5f0e8;vertical-align:middle;font-size:13px;color:#2c1f0e}
        .er-tbl tr:last-child td{border-bottom:none}
        .er-tbl tr.er-row{cursor:pointer;transition:background .15s}
        .er-tbl tr.er-row:hover{background:#faf8f4}
        .er-name-cell{display:flex;align-items:center;gap:10px}
        .er-name-primary{font-weight:500;color:#1a1208}
        .er-badge{font-size:10px;font-weight:500;padding:3px 9px;border-radius:20px;display:inline-block;white-space:nowrap}
        .er-view-btn{font-family:'Jost',sans-serif;font-size:11px;font-weight:500;color:#8B5A2B;background:none;border:none;cursor:pointer;letter-spacing:.05em;text-transform:uppercase}
        .er-view-btn:hover{color:#2C1810;text-decoration:underline}
        .er-overlay{position:fixed;inset:0;background:rgba(26,18,8,.5);display:flex;align-items:flex-start;justify-content:center;z-index:200;padding:32px 20px;animation:er-fade .2s ease;overflow-y:auto}
        .er-modal{background:transparent;width:100%;max-width:760px;animation:er-slide .25s ease;display:flex;flex-direction:column;gap:14px}
        .er-modal-hd{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:18px 22px;display:flex;align-items:center;gap:14px;position:sticky;top:0}
        .er-modal-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208}
        .er-modal-sub{font-size:11px;color:#8a7560;margin-top:2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .er-modal-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0}
        .er-detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .er-form-lbl{font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#8B5A2B;margin-bottom:4px}
        .er-detail-val{font-size:13px;color:#2C1810;display:flex;align-items:center;gap:6px;word-break:break-word}
        .er-detail-val svg{color:#8a7560;flex-shrink:0}
        .er-edit-input-wrap{display:flex;align-items:center;gap:6px}
        .er-edit-input-wrap svg{color:#8a7560;flex-shrink:0}
        .er-edit-input{width:100%;height:32px;border:1px solid #e0d5c0;border-radius:6px;background:#faf8f4;padding:0 10px;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e;outline:none;transition:border-color .2s}
        .er-edit-input:focus{border-color:#d4af37;background:#fff}
        .er-edit-title{font-family:'Cormorant Garamond',serif;font-size:20px;height:38px}
        .er-edit-inline{width:auto;min-width:120px;height:28px;font-size:12px}
        .er-edit-select{height:28px;border:1px solid #e0d5c0;border-radius:20px;background:#fff;font-family:'Jost',sans-serif;font-size:11px;color:#6b5740;padding:0 8px}
        .er-confirm-card{border-color:#f5c6c6;background:#fff5f5}
        .er-save-err{font-size:12px;color:#c0392b;padding:2px 4px}
        @keyframes er-fade{from{opacity:0}to{opacity:1}}
        @keyframes er-slide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes er-spin{to{transform:rotate(360deg)}}

        @media (max-width: 1024px) {
          .er-stats{grid-template-columns:repeat(2,1fr)}
          .er-detail-grid{grid-template-columns:repeat(2,1fr)}
        }
        @media (max-width: 780px) {
          .er-topbar{padding:10px 16px}
          .er-page-title{font-size:18px}
          .er-body{padding:14px 14px}
          .er-stats{grid-template-columns:repeat(2,1fr)}
          .er-stat{padding:10px 12px}
          .er-stat-val{font-size:20px}
          .er-ch{padding:12px 14px}
          .er-cb{padding:12px}
          .er-detail-grid{grid-template-columns:1fr 1fr}
          .er-overlay{padding:0}
          .er-modal{max-width:100%}
          .er-modal-hd{border-radius:0;position:sticky;top:0}
        }
        @media (max-width: 480px) {
          .er-detail-grid{grid-template-columns:1fr}
          .er-stats{grid-template-columns:1fr 1fr}
        }
      `}</style>

      <div className="er-page">
        {/* TOPBAR */}
        <header className="er-topbar">
          <div className="er-page-title-wrap">
            <div className="er-page-title">Employee Records</div>
            <div className="er-page-sub">Confidential — Internal HR &amp; Management Use Only</div>
          </div>
          <div className="er-topbar-right">
            <button
              className="er-icon-btn"
              onClick={downloadExcel}
              title="Download Excel"
              disabled={filtered.length === 0 || exporting}
            >
              {exporting ? <div className="er-spin" /> : <Ic n="download" s={14} />}
            </button>
            <button className="er-icon-btn" onClick={() => { void load(); }} title="Refresh">
              {loading ? <div className="er-spin" /> : <Ic n="refresh" s={14} />}
            </button>
          </div>
        </header>

        {error && (
          <div className="er-err">⚠ {error}
            <button onClick={() => { setError(null); }}><Ic n="x" s={14} /></button>
          </div>
        )}

        <div className="er-body">
          {/* STATS */}
          <div className="er-stats">
                       <div className="er-stat">
              <div className="er-stat-val">{total}</div>
              <div className="er-stat-lbl">Total Employees</div>
            </div>
          </div>

          {/* TABLE CARD */}
          <div className="er-card">
            <div className="er-ch">
              <div className="er-ct"><Ic n="people" s={13} />All Records</div>
            </div>
            <div className="er-cb" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="er-toolbar">
                <div className="er-search">
                  <Ic n="search" s={15} />
                  <input
                    type="text"
                    placeholder="Search by name, position, mobile…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); }}
                  />
                               </div>
              </div>

              {loading && (
                <div className="er-empty"><div className="er-spin" style={{ margin: "0 auto" }} /></div>
              )}
              {!loading && !error && filtered.length === 0 && (
                <div className="er-empty">
                  {records.length === 0 ? "No employee records yet." : "No records match your search."}
                </div>
              )}

              {!loading && filtered.length > 0 && (
                <div className="er-tbl-wrap">
                  <table className="er-tbl">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Mobile</th>
                                               <th>Experience</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                                           {filtered.map(r => {
                        return (
                          <tr key={r._id} className="er-row" onClick={() => { void openDetail(r._id); }}>
                            <td>
                              <div className="er-name-cell">
                                <EmpAvatar name={r.fullName} size={32} />
                                <div className="er-name-primary">{r.fullName}</div>
                              </div>
                            </td>
                            <td>{r.position}</td>
                            <td>{r.mobileNumber}</td>
                                                       <td>{r.totalExperience && r.totalExperience.trim() ? r.totalExperience : "—"}</td>
                            <td onClick={e => { e.stopPropagation(); }}>
                              <button className="er-view-btn" onClick={() => { void openDetail(r._id); }}>
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {(detailLoading || selected || detailError) && (
        <div className="er-overlay" onClick={() => { if (!isEditing) closeDetail(); }}>
          <div className="er-modal" onClick={e => { e.stopPropagation(); }}>
            <div className="er-modal-hd">
              {selected && <EmpAvatar name={selected.fullName} size={44} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                {isEditing ? (
                  <input
                    className="er-edit-input er-edit-title"
                    value={editForm.fullName ?? ""}
                    onChange={e => { updateField("fullName", e.target.value); }}
                  />
                ) : (
                  <div className="er-modal-title">
                    {detailLoading ? "Loading…" : selected ? selected.fullName : "Error"}
                  </div>
                )}

                {selected && (
                  <div className="er-modal-sub">
                                       {isEditing ? (
                      <input
                        className="er-edit-input er-edit-inline"
                        placeholder="Position"
                        value={editForm.position ?? ""}
                        onChange={e => { updateField("position", e.target.value); }}
                      />
                    ) : (
                      <span>{selected.position}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="er-modal-actions">
                {selected && !isEditing && (
                  <>
                    <button className="er-icon-btn" title="Edit record" onClick={startEdit}>
                      <Ic n="edit" s={15} />
                    </button>
                    <button
                      className="er-icon-btn er-icon-btn-danger"
                      title="Delete record"
                      onClick={() => { setConfirmDelete(true); }}
                    >
                      <Ic n="trash" s={15} />
                    </button>
                  </>
                )}
                {isEditing && (
                  <>
                    <button className="er-icon-btn" title="Cancel" onClick={cancelEdit} disabled={saving}>
                      <Ic n="x" s={15} />
                    </button>
                    <button
                      className="er-icon-btn er-icon-btn-primary"
                      title="Save changes"
                      onClick={() => { void saveEdit(); }}
                      disabled={saving}
                    >
                      {saving ? <div className="er-spin" /> : <Ic n="check" s={15} />}
                    </button>
                  </>
                )}
                {!isEditing && (
                  <button className="er-icon-btn" onClick={closeDetail} title="Close">
                    <Ic n="x" s={15} />
                  </button>
                )}
              </div>
            </div>

            {saveError && <div className="er-card"><div className="er-save-err">{saveError}</div></div>}

            {confirmDelete && (
              <div className="er-card er-confirm-card">
                <div className="er-cb" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "#b91c1c" }}>
                    Delete this employee record? This cannot be undone.
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button className="er-filter-btn" onClick={() => { setConfirmDelete(false); }} disabled={deleting}>
                      Cancel
                    </button>
                    <button
                      className="er-filter-btn er-filter-btn-danger"
                      onClick={() => { void deleteRecord(); }}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Confirm Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {detailLoading && (
              <div className="er-card"><div className="er-cb er-empty"><div className="er-spin" style={{ margin: "0 auto" }} /></div></div>
            )}

            {detailError && (
              <div className="er-card"><div className="er-cb er-empty" style={{ color: "#c0392b" }}>{detailError}</div></div>
            )}

            {selected && (
              <SectionCard icon="user" title="Employee Details">
                <Field editing={isEditing} icon="phone" label="Mobile Number"
                  value={isEditing ? editForm.mobileNumber : selected.mobileNumber}
                  onChange={v => { updateField("mobileNumber", v); }} />
                <Field editing={isEditing} label="Experience"
                  value={isEditing ? editForm.totalExperience : selected.totalExperience}
                  onChange={v => { updateField("totalExperience", v); }} />
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </>
  );
}