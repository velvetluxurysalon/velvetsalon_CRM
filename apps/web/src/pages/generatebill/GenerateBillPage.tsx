import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

type PaymentMethod = 'cash' | 'card' | 'upi';

interface BillRow {
  _id: string;
  billNumber: string;
  customer: { name: string; phone: string } | null;
  phone: string;
  items: {
    serviceId?: string;
    serviceName: string;
    staffId?: string;
    price: number;
    duration?: number;
    originalPrice?: number;
  }[];
  subtotal: number;
  membershipDiscount?: number;
  discountAmount?: number;
  loyaltyRedeemed?: number;
  referralDiscount?: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: 'paid' | 'pending';
  createdAt: string;
  notes?: string;
  date?: string;
}

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
const billDate = (b: BillRow) => (b.date ?? b.createdAt).slice(0, 10);

const PAGE_SIZE = 25;

export default function GenerateBillPage() {
  const { isAdmin } = useAuth();
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [payFilter, setPayFilter] = useState<'all' | PaymentMethod>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);
  const navigate = useNavigate();
  const [viewBill, setViewBill] = useState<BillRow | null>(null);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API}/staff-roles`, { headers: hdr() });
        if (!res.ok) return;
        const list = (await res.json()) as { _id: string; name: string }[];
        const map: Record<string, string> = {};
        for (const s of list) map[s._id] = s.name;
        setStaffNames(map);
      } catch {
        /* advisory: staff column shows — */
      }
    })();
  }, []);

  const deleteBill = async (b: BillRow) => {
    if (!window.confirm(`Delete bill #${b.billNumber}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/bills/${b._id}`, { method: 'DELETE', headers: hdr() });
      if (!res.ok) throw new Error();
      setBills((prev) => prev.filter((x) => x._id !== b._id));
      if (viewBill?._id === b._id) setViewBill(null);
    } catch {
      setError('Failed to delete bill.');
    }
  };

  const editBill = (b: BillRow) => {
    void navigate('/billing', { state: { editBill: b } });
  };

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/bills?limit=100000`, { headers: hdr() });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as BillRow[];
      setBills(
        [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load bills.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBills();
  }, [fetchBills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (payFilter !== 'all' && b.paymentMethod !== payFilter) return false;
      const d = billDate(b);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      if (q) {
        const hay = `${b.billNumber} ${b.customer?.name ?? ''} ${b.phone} ${b.items
          .map((i) => i.serviceName)
          .join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bills, search, statusFilter, payFilter, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, payFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paidTotal = filtered.filter((b) => b.status === 'paid').reduce((s, b) => s + b.total, 0);

  const downloadPdf = async (billNumber: string) => {
    setDownloading(billNumber);
    try {
      const res = await fetch(`${API}/bills/${billNumber}/invoice`, { headers: hdr() });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${billNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to download invoice.');
    } finally {
      setDownloading(null);
    }
  };

  if (!isAdmin) {
    return <div style={{ padding: 40, fontFamily: "'Jost',sans-serif" }}>Admin access only.</div>;
  }

  const inp: React.CSSProperties = {
    height: 34,
    border: '1px solid #e0d5c0',
    borderRadius: 8,
    background: '#faf8f4',
    padding: '0 10px',
    fontFamily: "'Jost',sans-serif",
    fontSize: 13,
    color: '#2c1f0e',
    outline: 'none',
  };
  const btn: React.CSSProperties = {
    height: 32,
    padding: '0 14px',
    border: '1px solid #ede5d6',
    borderRadius: 8,
    background: '#faf8f4',
    color: '#6b5740',
    fontFamily: "'Jost',sans-serif",
    fontSize: 11,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 10,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: '#8a7560',
    fontWeight: 500,
    borderBottom: '1px solid #f0e8d8',
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    color: '#1a1208',
    borderBottom: '1px solid #f5f0e8',
    verticalAlign: 'middle',
  };

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: '#f5f0e8',
        fontFamily: "'Jost',sans-serif",
        padding: '22px 28px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: '#1a1208' }}>
            All Bills
          </div>
          <div style={{ fontSize: 12, color: '#8a7560' }}>
            {filtered.length} bills · Paid total {fmtCur(paidTotal)}
          </div>
        </div>
        <button
          style={btn}
          onClick={() => {
            void fetchBills();
          }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          style={{ ...inp, width: 240 }}
          placeholder="Search bill no, name, phone, service…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
        <select
          style={inp}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | 'paid' | 'pending');
          }}
        >
          <option value="all">All status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>
        <select
          style={inp}
          value={payFilter}
          onChange={(e) => {
            setPayFilter(e.target.value as 'all' | PaymentMethod);
          }}
        >
          <option value="all">All payments</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="upi">UPI</option>
        </select>
        <input
          style={inp}
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
          }}
          title="From date"
        />
        <input
          style={inp}
          type="date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
          }}
          title="To date"
        />
      </div>

      {error && (
        <div
          style={{
            background: '#fff5f5',
            border: '1px solid #f5c6c6',
            color: '#c0392b',
            padding: '9px 14px',
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div
        style={{
          background: '#fff',
          border: '1px solid #ede5d6',
          borderRadius: 12,
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>Bill No</th>
              <th style={th}>Date</th>
              <th style={th}>Customer</th>
              <th style={th}>Phone</th>
              <th style={th}>Services</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th>
              <th style={th}>Payment</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td style={{ ...td, textAlign: 'center', color: '#c5b89a' }} colSpan={9}>
                  {loading ? 'Loading bills…' : 'No bills found'}
                </td>
              </tr>
            )}
            {pageRows.map((b) => (
              <tr key={b._id}>
                <td style={{ ...td, fontWeight: 500 }}>#{b.billNumber}</td>
                <td style={td}>{billDate(b)}</td>
                <td style={td}>{b.customer?.name ?? 'Walk-in'}</td>
                <td style={td}>{b.phone}</td>
                <td style={{ ...td, maxWidth: 260, color: '#6b5740' }}>
                  {b.items.map((i) => i.serviceName).join(', ')}
                </td>
                <td style={{ ...td, textAlign: 'right', color: '#b8860b', fontWeight: 500 }}>
                  {fmtCur(b.total)}
                </td>
                <td style={{ ...td, textTransform: 'uppercase', fontSize: 11 }}>
                  {b.paymentMethod}
                </td>
                <td style={td}>
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      padding: '2px 9px',
                      borderRadius: 20,
                      background: b.status === 'paid' ? '#eaf3de' : '#fffbeb',
                      color: b.status === 'paid' ? '#3b6d11' : '#b45309',
                    }}
                  >
                    {b.status}
                  </span>
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{ ...btn, height: 28, padding: '0 10px' }}
                      onClick={() => {
                        setViewBill(b);
                      }}
                    >
                      View
                    </button>
                    <button
                      style={{ ...btn, height: 28, padding: '0 10px' }}
                      onClick={() => {
                        editBill(b);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      style={{ ...btn, height: 28, padding: '0 10px' }}
                      disabled={downloading === b.billNumber}
                      onClick={() => {
                        void downloadPdf(b.billNumber);
                      }}
                    >
                      {downloading === b.billNumber ? '…' : 'PDF'}
                    </button>
                    <button
                      style={{
                        ...btn,
                        height: 28,
                        padding: '0 10px',
                        color: '#c0392b',
                        borderColor: '#f5c6c6',
                      }}
                      onClick={() => {
                        void deleteBill(b);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          marginTop: 14,
          fontSize: 12,
          color: '#6b5740',
        }}
      >
        <button
          style={btn}
          disabled={page <= 1}
          onClick={() => {
            setPage((p) => p - 1);
          }}
        >
          Prev
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          style={btn}
          disabled={page >= totalPages}
          onClick={() => {
            setPage((p) => p + 1);
          }}
        >
          Next
        </button>
      </div>

      {viewBill && (
        <div
          onClick={() => {
            setViewBill(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26,18,8,.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 560,
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px 28px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24 }}>
                  Invoice
                </div>
                <div style={{ fontSize: 12, color: '#8a7560' }}>
                  #{viewBill.billNumber} · {billDate(viewBill)}
                </div>
              </div>
              <button
                style={btn}
                onClick={() => {
                  setViewBill(null);
                }}
              >
                Close
              </button>
            </div>

            <div
              style={{
                background: '#faf8f4',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '.15em', color: '#8a7560' }}>BILL TO</div>
              <div style={{ fontWeight: 500 }}>{viewBill.customer?.name ?? 'Walk-in Customer'}</div>
              <div style={{ fontSize: 12, color: '#6b5740' }}>{viewBill.phone}</div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Service</th>
                  <th style={th}>Staff</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {viewBill.items.map((it, i) => (
                  <tr key={i}>
                    <td style={td}>{it.serviceName}</td>
                    <td style={{ ...td, color: '#6b5740' }}>
                      {(it.staffId && staffNames[it.staffId]) || '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {fmtCur(it.originalPrice ?? it.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(
              [
                ['Subtotal', viewBill.subtotal, false],
                ['Membership Discount', viewBill.membershipDiscount ?? 0, true],
                ['Discount', viewBill.discountAmount ?? 0, true],
                ['Loyalty Redeemed', viewBill.loyaltyRedeemed ?? 0, true],
                ['Referral Reward', viewBill.referralDiscount ?? 0, true],
              ] as [string, number, boolean][]
            )
              .filter(([label, v]) => label === 'Subtotal' || v > 0)
              .map(([label, v, isDisc]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    padding: '3px 0',
                    color: isDisc ? '#2e7d32' : '#6b5740',
                  }}
                >
                  <span>{label}</span>
                  <span>
                    {isDisc ? '−' : ''}
                    {fmtCur(v)}
                  </span>
                </div>
              ))}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderTop: '2px solid #1a1208',
                marginTop: 8,
                paddingTop: 10,
              }}
            >
              <span style={{ fontSize: 10, letterSpacing: '.18em', color: '#8a7560' }}>TOTAL</span>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28 }}>
                {fmtCur(viewBill.total)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6b5740', marginTop: 8 }}>
              {viewBill.status === 'paid' ? 'Paid' : 'Pending'} via{' '}
              {viewBill.paymentMethod.toUpperCase()}
            </div>
            {viewBill.notes && (
              <div style={{ fontSize: 12, color: '#6b5740', fontStyle: 'italic', marginTop: 8 }}>
                Note: {viewBill.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
