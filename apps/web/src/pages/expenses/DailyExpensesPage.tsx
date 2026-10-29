import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────────
type PayMethod = 'cash' | 'card' | 'upi';

interface Expense {
  _id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: PayMethod;
  createdBy?: string;
}

// ─── Config ────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Tea / Snacks',
  'Cleaning',
  'Salon Supplies',
  'Electricity',
  'Rent',
  'Salary Advance',
  'Transport',
  'Maintenance',
  'Marketing',
  'Other',
];
const DEFAULT_CATEGORY: string = CATEGORIES[0] ?? 'Other';

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
const toYmd = (d: Date) =>
  `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = toYmd(new Date());
const monthStartStr = (() => {
  const d = new Date();
  return toYmd(new Date(d.getFullYear(), d.getMonth(), 1));
})();

// ─── Component ─────────────────────────────────────────────────────────────────
export default function DailyExpensesPage() {
  const { isAdmin } = useAuth();

  // filters
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);
  const [filterCat, setFilterCat] = useState('All');

  // data
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ from, to, category: filterCat });
      const res = await fetch(`${API}/daily-expenses?${qs.toString()}`, { headers: hdr() });
      if (!res.ok) throw new Error(await res.text());
      setRows((await res.json()) as Expense[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [from, to, filterCat]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.category, (m.get(r.category) ?? 0) + r.amount);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const byMethod = useMemo(() => {
    const m: Record<PayMethod, number> = { cash: 0, card: 0, upi: 0 };
    for (const r of rows) m[r.paymentMethod] += r.amount;
    return m;
  }, [rows]);

  const resetForm = () => {
    setEditingId(null);
    setDate(todayStr);
    setCategory(DEFAULT_CATEGORY);
    setDescription('');
    setAmount('');
    setPayMethod('cash');
  };

  const saveExpense = async () => {
    if (!category.trim() || !amount || amount <= 0) {
      setError('Enter a category and an amount greater than 0.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingId ? `${API}/daily-expenses/${editingId}` : `${API}/daily-expenses`;
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: hdr(),
        body: JSON.stringify({
          date,
          category,
          description,
          amount,
          paymentMethod: payMethod,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      resetForm();
      void fetchRows();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r: Expense) => {
    setEditingId(r._id);
    setDate(r.date);
    setCategory(r.category);
    setDescription(r.description);
    setAmount(r.amount);
    setPayMethod(r.paymentMethod);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteExpense = async (r: Expense) => {
    if (!window.confirm(`Delete ${fmtCur(r.amount)} (${r.category})? This cannot be undone.`))
      return;
    try {
      const res = await fetch(`${API}/daily-expenses/${r._id}`, {
        method: 'DELETE',
        headers: hdr(),
      });
      if (!res.ok) throw new Error(await res.text());
      if (editingId === r._id) resetForm();
      void fetchRows();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete expense.');
    }
  };

  const exportExcel = () => {
    const data = rows.map((r) => ({
      Date: r.date,
      Category: r.category,
      Description: r.description,
      Amount: r.amount,
      'Payment Method': r.paymentMethod,
      'Added By': r.createdBy ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `expenses_${from}_to_${to}.xlsx`);
  };

  const setQuick = (kind: 'today' | 'month') => {
    setFrom(kind === 'today' ? todayStr : monthStartStr);
    setTo(todayStr);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Jost:wght@300;400;500&display=swap');
        .ex-page{min-height:100%;width:100%;background:#f5f0e8;font-family:'Jost',sans-serif;color:#2c1f0e;padding:22px 28px;display:flex;flex-direction:column;gap:16px;overflow-y:auto}
        .ex-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .ex-title{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:400;color:#1a1208}
        .ex-top-right{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
        .ex-err{background:#fff5f5;border:1px solid #f5c6c6;color:#c0392b;padding:9px 14px;border-radius:8px;font-size:12px;display:flex;justify-content:space-between;align-items:center}
        .ex-err button{background:none;border:none;color:#c0392b;cursor:pointer;font-size:14px}
        .ex-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;overflow:hidden}
        .ex-ch{padding:13px 18px;border-bottom:1px solid #f0e8d8;font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#8a7560}
        .ex-cb{padding:16px 18px}
        .ex-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;align-items:end}
        .ex-field label{display:block;font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560;margin-bottom:5px}
        .ex-inp,.ex-sel{width:100%;height:38px;border:1px solid #e0d5c0;border-radius:8px;background:#faf8f4;padding:0 10px;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e;outline:none}
        .ex-inp:focus,.ex-sel:focus{border-color:#d4af37;background:#fff}
        .ex-btn{height:38px;padding:0 16px;border:none;border-radius:8px;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:all .18s;white-space:nowrap}
        .ex-btn-primary{background:#1a1208;color:#d4af37}.ex-btn-primary:hover{background:#2d2010}.ex-btn-primary:disabled{opacity:.55;cursor:not-allowed}
        .ex-btn-sec{background:#faf8f4;border:1px solid #ede5d6;color:#6b5740}.ex-btn-sec:hover{border-color:#d4af37;background:#fffdf5}
        .ex-btn-sm{height:30px;padding:0 12px;font-size:10px}
        .ex-pay{display:flex;border:1px solid #ede5d6;border-radius:8px;overflow:hidden;height:38px}
        .ex-pay button{flex:1;border:none;background:#faf8f4;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#8a7560;cursor:pointer}
        .ex-pay button.on{background:#1a1208;color:#d4af37}
        .ex-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
        .ex-stat{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:14px 16px}
        .ex-stat-lbl{font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#8a7560}
        .ex-stat-val{font-family:'Cormorant Garamond',serif;font-size:28px;color:#1a1208;margin-top:4px}
        .ex-stat.total{background:#1a1208}.ex-stat.total .ex-stat-lbl{color:#d4af37}.ex-stat.total .ex-stat-val{color:#f5ecd4}
        .ex-tbl-wrap{overflow-x:auto}
        .ex-tbl{width:100%;border-collapse:collapse;min-width:620px}
        .ex-tbl th{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560;padding:0 12px 10px;text-align:left}
        .ex-tbl td{padding:11px 12px;border-top:1px solid #f5f0e8;font-size:13px;vertical-align:middle}
        .ex-tbl .r{text-align:right}
        .ex-tag{display:inline-block;font-size:10px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;padding:2px 9px;border-radius:20px;background:#f5f0e8;color:#6b5740;border:1px solid #e8dfc8}
        .ex-cat-row{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:12px}
        .ex-cat-bar{height:6px;border-radius:4px;background:#d4af37}
        .ex-empty{text-align:center;padding:30px 0;color:#c5b89a;font-size:13px;font-weight:300}
        @media (max-width:600px){.ex-page{padding:14px 12px}.ex-top-right{width:100%;margin-left:0}}
      `}</style>

      <div className="ex-page">
        <div className="ex-top">
          <div className="ex-title">Daily Expenses</div>
          <div className="ex-top-right">
            <button
              className="ex-btn ex-btn-sec ex-btn-sm"
              onClick={() => {
                setQuick('today');
              }}
            >
              Today
            </button>
            <button
              className="ex-btn ex-btn-sec ex-btn-sm"
              onClick={() => {
                setQuick('month');
              }}
            >
              This Month
            </button>
            <button
              className="ex-btn ex-btn-sec ex-btn-sm"
              onClick={exportExcel}
              disabled={rows.length === 0}
            >
              Export Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="ex-err">
            <span>⚠ {error}</span>
            <button
              onClick={() => {
                setError('');
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Add / Edit form */}
        <div className="ex-card">
          <div className="ex-ch">{editingId ? 'Edit Expense' : 'Add Expense'}</div>
          <div className="ex-cb">
            <div className="ex-form">
              <div className="ex-field">
                <label>Date</label>
                <input
                  className="ex-inp"
                  type="date"
                  max={todayStr}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                  }}
                />
              </div>
              <div className="ex-field">
                <label>Category</label>
                <select
                  className="ex-sel"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ex-field">
                <label>Amount (₹)</label>
                <input
                  className="ex-inp"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value === '' ? '' : Number(e.target.value));
                  }}
                />
              </div>
              <div className="ex-field" style={{ gridColumn: 'span 2' }}>
                <label>Description (optional)</label>
                <input
                  className="ex-inp"
                  placeholder="e.g. Tea for staff, shampoo refill…"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                  }}
                />
              </div>
              <div className="ex-field">
                <label>Paid By</label>
                <div className="ex-pay">
                  {(['cash', 'card', 'upi'] as PayMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={payMethod === m ? 'on' : ''}
                      onClick={() => {
                        setPayMethod(m);
                      }}
                    >
                      {m === 'upi' ? 'UPI' : m}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="ex-btn ex-btn-primary"
                  disabled={saving}
                  onClick={() => {
                    void saveExpense();
                  }}
                >
                  {saving ? 'Saving…' : editingId ? 'Update' : 'Add Expense'}
                </button>
                {editingId && (
                  <button className="ex-btn ex-btn-sec" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="ex-card">
          <div className="ex-ch">Filter</div>
          <div className="ex-cb">
            <div className="ex-form">
              <div className="ex-field">
                <label>From</label>
                <input
                  className="ex-inp"
                  type="date"
                  max={todayStr}
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                  }}
                />
              </div>
              <div className="ex-field">
                <label>To</label>
                <input
                  className="ex-inp"
                  type="date"
                  max={todayStr}
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                  }}
                />
              </div>
              <div className="ex-field">
                <label>Category</label>
                <select
                  className="ex-sel"
                  value={filterCat}
                  onChange={(e) => {
                    setFilterCat(e.target.value);
                  }}
                >
                  <option value="All">All</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="ex-stats">
          <div className="ex-stat total">
            <div className="ex-stat-lbl">Total Expenses</div>
            <div className="ex-stat-val">{fmtCur(total)}</div>
          </div>
          <div className="ex-stat">
            <div className="ex-stat-lbl">Cash</div>
            <div className="ex-stat-val">{fmtCur(byMethod.cash)}</div>
          </div>
          <div className="ex-stat">
            <div className="ex-stat-lbl">UPI</div>
            <div className="ex-stat-val">{fmtCur(byMethod.upi)}</div>
          </div>
          <div className="ex-stat">
            <div className="ex-stat-lbl">Card</div>
            <div className="ex-stat-val">{fmtCur(byMethod.card)}</div>
          </div>
        </div>

        {/* Category breakdown */}
        {byCategory.length > 0 && (
          <div className="ex-card">
            <div className="ex-ch">By Category</div>
            <div className="ex-cb">
              {byCategory.map(([cat, amt]) => (
                <div key={cat} className="ex-cat-row">
                  <span style={{ width: 130, flexShrink: 0 }}>{cat}</span>
                  <div style={{ flex: 1 }}>
                    <div
                      className="ex-cat-bar"
                      style={{ width: `${String(total > 0 ? (amt / total) * 100 : 0)}%` }}
                    />
                  </div>
                  <span style={{ width: 90, textAlign: 'right', fontWeight: 500 }}>
                    {fmtCur(amt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        <div className="ex-card">
          <div className="ex-ch">
            Expenses ({rows.length}){loading ? ' · loading…' : ''}
          </div>
          <div className="ex-cb ex-tbl-wrap">
            {rows.length === 0 && !loading ? (
              <div className="ex-empty">No expenses for this period</div>
            ) : (
              <table className="ex-tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Paid By</th>
                    <th className="r">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id}>
                      <td>{new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN')}</td>
                      <td>{r.category}</td>
                      <td style={{ color: '#6b5740' }}>{r.description || '—'}</td>
                      <td>
                        <span className="ex-tag">{r.paymentMethod}</span>
                      </td>
                      <td className="r" style={{ fontWeight: 500 }}>
                        {fmtCur(r.amount)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button
                          className="ex-btn ex-btn-sec ex-btn-sm"
                          onClick={() => {
                            startEdit(r);
                          }}
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            className="ex-btn ex-btn-sec ex-btn-sm"
                            style={{ marginLeft: 6, color: '#c0392b' }}
                            onClick={() => {
                              void deleteExpense(r);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
