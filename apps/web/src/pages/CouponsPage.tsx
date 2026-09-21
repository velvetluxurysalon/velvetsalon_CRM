import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";

type DiscountType = "percent" | "flat";

interface Coupon {
  _id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  description: string;
  expiryDate: string | null;
  active: boolean;
  customerPhone: string | null;
  usedAt: string | null;   // ← added
  createdAt: string;
}

const API   = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api`;
const token = (): string => {
  try {
    const parsed = JSON.parse(localStorage.getItem("velvet_token") ?? "{}") as { token?: string };
    return parsed.token ?? "";
  } catch {
    return "";
  }
};
const hdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });
const todayStr = new Date().toISOString().slice(0, 10);

const emptyForm = { code: "", discountType: "percent" as DiscountType, discountValue: "" as number | "", description: "", expiryDate: "", active: true, customerPhone: "" };
export default function CouponsPage() {
  const [coupons, setCoupons]     = useState<Coupon[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  // ── Customer lookup for "Assign to Customer" phone field ──────────────────
  // undefined = not searched yet, null = searched but no match, string = matched name
  const [customerLookup, setCustomerLookup]           = useState<string | null | undefined>(undefined);
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/coupons`, { headers: hdr() });
      if (!res.ok) throw new Error(await res.text());
      setCoupons((await res.json()) as Coupon[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load coupons.");
    } finally { setLoading(false); }
  }, []);

    useEffect(() => { void fetchCoupons(); }, [fetchCoupons]);

  // Looks up whether the typed phone number belongs to an existing customer,
  // debounced so it doesn't fire on every keystroke. Purely informational —
  // doesn't block or change what gets submitted.
  useEffect(() => {
    const phone = form.customerPhone;
    if (phone.length !== 10) {
      setCustomerLookup(undefined);
      return;
    }
    const t = setTimeout(() => {
      setCustomerLookupLoading(true);
      fetch(`${API}/customers?q=${phone}`, { headers: hdr() })
        .then(res => (res.ok ? (res.json() as Promise<{ name: string; phone: string }[]>) : []))
        .then(data => {
          const match = data.find(c => c.phone === phone);
          setCustomerLookup(match ? match.name : null);
        })
        .catch(() => { setCustomerLookup(undefined); })
        .finally(() => { setCustomerLookupLoading(false); });
    }, 400);
    return () => { clearTimeout(t); };
  }, [form.customerPhone]);

 const status = (c: Coupon): { label: string; color: string; bg: string } => {
    if (c.usedAt) return { label: "Used", color: "#6b5740", bg: "#f5f0e8" };
    if (!c.active) return { label: "Inactive", color: "#8a7560", bg: "#f5f0e8" };
    if (c.expiryDate && c.expiryDate < todayStr) return { label: "Expired", color: "#c0392b", bg: "#fff5f5" };
    return { label: "Active", color: "#2e7d32", bg: "#f0fdf4" };
  };

  // NEW: Excel export of all coupons currently loaded
  const downloadExcel = () => {
    const header = ["Code", "Discount", "Description", "Customer Phone", "Expiry Date", "Status", "Used At", "Created At"];
    const rows = coupons.map(c => {
      const s = status(c);
      return [
        c.code,
        c.discountType === "percent" ? `${String(c.discountValue)}%` : `₹${String(c.discountValue)}`,
        c.description || "",
        c.customerPhone ?? "Public — anyone",
        c.expiryDate ?? "No expiry",
        s.label,
        c.usedAt ?? "",
        c.createdAt,
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coupons");
    XLSX.writeFile(wb, `coupons_${todayStr}.xlsx`);
  };

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setFormError(""); setCustomerLookup(undefined); setModalOpen(true); };
 const openEdit = (c: Coupon) => {
    setEditingId(c._id);
    setForm({
      code: c.code, discountType: c.discountType, discountValue: c.discountValue,
      description: c.description, expiryDate: c.expiryDate ?? "", active: c.active,
      customerPhone: c.customerPhone ?? "",
    });
    setFormError(""); setCustomerLookup(undefined); setModalOpen(true);
  };

  const submit = async () => {
    if (!form.code.trim()) { setFormError("Coupon code is required."); return; }
    if (form.discountValue === "" || form.discountValue <= 0) { setFormError("Enter a valid discount value."); return; }
    if (form.discountType === "percent" && form.discountValue > 100) { setFormError("Percent discount cannot exceed 100."); return; }

    setSaving(true); setFormError("");
    if (form.customerPhone && !/^\d{10}$/.test(form.customerPhone)) {
      setFormError("Customer phone must be a 10-digit number."); setSaving(false); return;
    }
    const payload = {
  code: form.code.trim(),
  discountType: form.discountType,
  discountValue: form.discountValue, // already guaranteed to be a valid number by the guard clause above
  description: form.description.trim(),
  expiryDate: form.expiryDate || null,
  active: form.active,
  customerPhone: form.customerPhone.trim() || null,
};
    try {
      const url = editingId ? `${API}/coupons/${editingId}` : `${API}/coupons`;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: hdr(), body: JSON.stringify(payload) });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Failed to save coupon.");
      }
      setModalOpen(false);
      void fetchCoupons();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save coupon.");
    } finally { setSaving(false); }
  };

  const remove = async (c: Coupon) => {
    if (!window.confirm(`Delete coupon "${c.code}"? This cannot be undone.`)) return;
    try {
     const res = await fetch(`${API}/coupons/${c._id}`, { method: "DELETE", headers: hdr() });
      if (!res.ok) throw new Error(await res.text());
      void fetchCoupons();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete coupon.");
    }
  };

  const toggleActive = async (c: Coupon) => {
    try {
      const res = await fetch(`${API}/coupons/${c._id}`, { method: "PATCH", headers: hdr(), body: JSON.stringify({ active: !c.active }) });
      if (!res.ok) throw new Error(await res.text());
      void fetchCoupons();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update coupon.");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Jost:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .cp-page{display:flex;flex-direction:column;height:100%;background:#f5f0e8;font-family:'Jost',sans-serif;color:#2c1f0e;overflow:hidden}
        .cp-topbar{height:60px;background:#fff;border-bottom:1px solid #ede5d6;display:flex;align-items:center;padding:0 28px;gap:14px;flex-shrink:0}
        .cp-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208}
        .cp-add-btn{margin-left:auto;height:38px;padding:0 18px;border:none;border-radius:8px;background:#1a1208;color:#d4af37;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;gap:7px}
        .cp-add-btn:hover{background:#2d2010}
        .cp-err{background:#fff5f5;border-bottom:1px solid #f5c6c6;padding:9px 28px;font-size:12px;color:#c0392b}
        .cp-body{flex:1;overflow-y:auto;padding:22px 28px}
        .cp-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #ede5d6;border-radius:12px;overflow:hidden}
        .cp-table th{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560;padding:12px 16px;text-align:left;background:#faf8f4;border-bottom:1px solid #ede5d6}
        .cp-table td{padding:13px 16px;border-bottom:1px solid #f5f0e8;font-size:13px;vertical-align:middle}
        .cp-table tr:last-child td{border-bottom:none}
        .cp-code{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:600;color:#1a1208;letter-spacing:.03em}
        .cp-desc{font-size:11px;color:#8a7560;margin-top:2px}
        .cp-badge{font-size:10px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;padding:3px 10px;border-radius:20px;display:inline-block;cursor:pointer}
        .cp-actions{display:flex;gap:8px}
        .cp-icon-btn{width:28px;height:28px;border:1px solid #ede5d6;border-radius:7px;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b5740;transition:all .15s}
        .cp-icon-btn:hover{border-color:#d4af37;color:#b8860b;background:#fffdf5}
        .cp-icon-btn.danger:hover{border-color:#e74c3c;color:#e74c3c;background:#fff5f5}
        .cp-empty{text-align:center;padding:50px 20px;color:#c5b89a;font-size:13px}
        .cp-overlay{position:fixed;inset:0;background:rgba(26,18,8,.55);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px}
        .cp-modal{background:#fff;border-radius:16px;width:100%;max-width:440px;padding:26px 28px;box-shadow:0 20px 60px rgba(26,18,8,.28)}
        .cp-modal-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208;margin-bottom:18px}
        .cp-field{margin-bottom:14px}
        .cp-label{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560;margin-bottom:6px;display:block}
        .cp-input{width:100%;height:42px;border:1.5px solid #e0d5c0;border-radius:9px;background:#faf8f4;padding:0 13px;font-family:'Jost',sans-serif;font-size:14px;color:#2c1f0e;outline:none}
        .cp-input:focus{border-color:#d4af37;background:#fff}
        .cp-row{display:flex;gap:10px}
        .cp-toggle-group{display:flex;border:1px solid #ede5d6;border-radius:8px;overflow:hidden}
        .cp-toggle-opt{flex:1;height:42px;border:none;background:#faf8f4;font-family:'Jost',sans-serif;font-size:12px;font-weight:500;color:#8a7560;cursor:pointer}
        .cp-toggle-opt.on{background:#1a1208;color:#d4af37}
        .cp-active-row{display:flex;align-items:center;gap:10px;padding:10px 0}
        .cp-tog{width:36px;height:20px;border-radius:20px;background:#e0d5c0;position:relative;transition:background .2s;cursor:pointer;flex-shrink:0}
        .cp-tog.on{background:#d4af37}
        .cp-tok{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s}
        .cp-tog.on .cp-tok{transform:translateX(16px)}
        .cp-form-err{background:#fff5f5;border:1px solid #f5c6c6;color:#c0392b;font-size:12px;padding:9px 12px;border-radius:8px;margin-bottom:14px}
        .cp-modal-actions{display:flex;gap:10px;margin-top:6px}
        .cp-btn{flex:1;height:42px;border:none;border-radius:9px;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.13em;text-transform:uppercase;cursor:pointer}
        .cp-btn-primary{background:#1a1208;color:#d4af37}
        .cp-btn-primary:disabled{opacity:.55;cursor:not-allowed}
        .cp-btn-secondary{background:#faf8f4;border:1px solid #ede5d6;color:#6b5740}
      `}</style>

      <div className="cp-page">
       <header className="cp-topbar">
          <div className="cp-title">Coupons</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button className="cp-add-btn" style={{ marginLeft: 0, background: "#faf8f4", border: "1px solid #ede5d6", color: "#6b5740" }}
              onClick={downloadExcel}>
              ⬇ Download Excel
            </button>
            <button className="cp-add-btn" style={{ marginLeft: 0 }} onClick={openCreate}>+ New Coupon</button>
          </div>
        </header>

        {error && <div className="cp-err">⚠ {error}</div>}

        <div className="cp-body">
          {loading ? (
            <div className="cp-empty">Loading coupons…</div>
          ) : coupons.length === 0 ? (
            <div className="cp-empty">No coupons yet — create one to get started.</div>
          ) : (
            <table className="cp-table">
              <thead>
                <tr><th>Code</th><th>Discount</th><th>Customer</th><th>Expiry</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {coupons.map(c => {
                  const s = status(c);
                  return (
                    <tr key={c._id}>
                      <td>
                        <div className="cp-code">{c.code}</div>
                        {c.description && <div className="cp-desc">{c.description}</div>}
                      </td>
                      <td>{c.discountType === "percent" ? `${c.discountValue.toString()}% off` : `₹${c.discountValue.toString()} off`}</td>
                      <td>
                        {c.customerPhone
                          ? <span className="cp-badge" style={{ background: "#f5f3ff", color: "#7c3aed" }}>{c.customerPhone}</span>
                          : <span style={{ fontSize: 11, color: "#c5b89a" }}>Public — anyone</span>}
                      </td>
                      <td>{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No expiry"}</td>
                      <td>
                       <span className="cp-badge" style={{ background: s.bg, color: s.color }} onClick={() => { void toggleActive(c); }} title="Click to toggle active">
                          {s.label}
                        </span>
                      </td>
                      <td>
                        <div className="cp-actions">
                          <button className="cp-icon-btn" onClick={() => { openEdit(c); }} title="Edit">✎</button>
                          <button className="cp-icon-btn danger" onClick={() => { void remove(c); }} title="Delete">✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="cp-overlay" onClick={() => { setModalOpen(false); }}>
          <div className="cp-modal" onClick={e => { e.stopPropagation(); }}>
            <div className="cp-modal-title">{editingId ? "Edit Coupon" : "New Coupon"}</div>

            {formError && <div className="cp-form-err">{formError}</div>}

            <div className="cp-field">
              <label className="cp-label">Coupon Code</label>
              <input className="cp-input" placeholder="e.g. VELVET20" value={form.code}
                onChange={e => { setForm(f => ({ ...f, code: e.target.value.toUpperCase() })); }} />
            </div>

            <div className="cp-field">
              <label className="cp-label">Discount Type</label>
              <div className="cp-toggle-group">
                <button className={`cp-toggle-opt${form.discountType === "percent" ? " on" : ""}`}
                  onClick={() => { setForm(f => ({ ...f, discountType: "percent" })); }}>% Percent</button>
                <button className={`cp-toggle-opt${form.discountType === "flat" ? " on" : ""}`}
                  onClick={() => { setForm(f => ({ ...f, discountType: "flat" })); }}>₹ Flat</button>
              </div>
            </div>

            <div className="cp-field">
              <label className="cp-label">Discount Value</label>
              <input className="cp-input" type="number" min={0} max={form.discountType === "percent" ? 100 : undefined}
                placeholder={form.discountType === "percent" ? "e.g. 20" : "e.g. 200"}
                value={form.discountValue}
                onChange={e => { setForm(f => ({ ...f, discountValue: e.target.value === "" ? "" : Number(e.target.value) })); }} />
            </div>

            <div className="cp-field">
              <label className="cp-label">Description (optional)</label>
              <input className="cp-input" placeholder="e.g. Festive season offer" value={form.description}
                onChange={e => { setForm(f => ({ ...f, description: e.target.value })); }} />
            </div>

            <div className="cp-field">
              <label className="cp-label">Expiry Date (optional)</label>
              <input className="cp-input" type="date" value={form.expiryDate}
                onChange={e => { setForm(f => ({ ...f, expiryDate: e.target.value })); }} />
            </div>

                        <div className="cp-field">
              <label className="cp-label">Assign to Customer (optional)</label>
              <input className="cp-input" type="tel" maxLength={10} placeholder="10-digit phone — leave blank for a public coupon"
                value={form.customerPhone}
                onChange={e => { setForm(f => ({ ...f, customerPhone: e.target.value.replace(/\D/g, "") })); }} />
              {form.customerPhone && form.customerPhone.length === 10 && (
                <div style={{ fontSize: 11, marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
                  {customerLookupLoading ? (
                    <span style={{ color: "#8a7560" }}>Checking…</span>
                  ) : customerLookup === undefined ? (
                    <span style={{ color: "#8a7560" }}>
                      Only the customer with this phone number will be able to redeem this coupon.
                    </span>
                  ) : customerLookup ? (
                    <span style={{ color: "#2e7d32" }}>
                      ✓ Existing customer — <strong>{customerLookup}</strong>
                    </span>
                  ) : (
                    <span style={{ color: "#c0392b" }}>
                      ⚠ Not an existing customer — coupon will still be assigned to this number.
                    </span>
                  )}
                </div>
              )}
              {form.customerPhone && form.customerPhone.length < 10 && (
                <div style={{ fontSize: 11, color: "#8a7560", marginTop: 5 }}>
                  Only the customer with this phone number will be able to redeem this coupon.
                </div>
              )}
            </div>

            <div className="cp-active-row">
              <div className={`cp-tog${form.active ? " on" : ""}`} onClick={() => { setForm(f => ({ ...f, active: !f.active })); }}>
                <div className="cp-tok" />
              </div>
              <span style={{ fontSize: 13, color: "#1a1208" }}>Active</span>
            </div>

            <div className="cp-modal-actions">
              <button className="cp-btn cp-btn-secondary" onClick={() => { setModalOpen(false); }}>Cancel</button>
              <button className="cp-btn cp-btn-primary" onClick={() => { void submit(); }} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}