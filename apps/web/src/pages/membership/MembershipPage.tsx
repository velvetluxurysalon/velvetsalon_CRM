import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type MembershipTier = "none" | "silver" | "gold" | "platinum";
type MainTab = "plans" | "members" | "wallet" | "referrals";

interface Customer {
  _id: string;
  name: string;
  phone: string;
  email: string;
  loyaltyPoints: number;
  membershipTier: MembershipTier;
  membershipExpiry: string;
  totalSpent: number;
  visitCount: number;
  referralCode: string;
  referredByCode: string;
  referrals: Referral[];
  lastVisit: string;
  hasAnnualPass: boolean;
  annualPassExpiry: string;
}

interface Referral {
  _id: string;
  referredName: string;
  referredPhone: string;
  date: string;
  status: "pending" | "converted" | "credited";
  reward: number;
}

interface WalletAction {
  customerId: string;
  type: "add" | "deduct";
  points: number;
  reason: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TIER_CFG: Record<MembershipTier, {
  label: string; color: string; bg: string; border: string;
  gradient: string; discount: number; pointsMultiplier: number;
  minSpend: number; perks: string[];
}> = {
  none: {
    label: "Standard", color: "#8a7560", bg: "#f5f0e8", border: "#e0d5c0",
    gradient: "linear-gradient(135deg,#e8e0d4,#d5ccbf)",
    discount: 0, pointsMultiplier: 1, minSpend: 0,
    perks: ["1× loyalty points", "Standard booking"],
  },
  silver: {
    label: "Silver", color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1",
    gradient: "linear-gradient(135deg,#475569,#64748b,#94a3b8)",
    discount: 10, pointsMultiplier: 1.5, minSpend: 2000,
    perks: ["10% off all services", "1.5× loyalty points", "15% birthday discount", "Priority support"],
  },
  gold: {
    label: "Gold", color: "#b8860b", bg: "#fefce8", border: "#fde68a",
    gradient: "linear-gradient(135deg,#92400e,#b45309,#d97706)",
    discount: 20, pointsMultiplier: 2, minSpend: 5000,
    perks: ["20% off all services", "2× loyalty points", "25% birthday discount", "Priority booking", "Free monthly hair wash"],
  },
  platinum: {
    label: "Platinum", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe",
    gradient: "linear-gradient(135deg,#3b0764,#6d28d9,#7c3aed)",
    discount: 30, pointsMultiplier: 3, minSpend: 10000,
    perks: ["30% off all services", "3× loyalty points", "Free birthday service", "Dedicated stylist", "Priority booking", "Guest discount 10%", "Monthly complimentary treatment"],
  },
};

interface WalletVault { label: string; pay: number; receive: number; }
const BANK_WALLET: { title: string; vaults: WalletVault[]; notes: string[] } = {
  title: "The Velvet Bank Wallet",
  vaults: [
    { label: "Silver Vault", pay: 2000, receive: 2400 },
    { label: "Gold Vault",   pay: 5000, receive: 6200 },
    { label: "Royal Vault",  pay: 10000, receive: 13000 },
  ],
  notes: [
    "Wallet balances remain strictly valid for 12 months from the date of purchase.",
    "Can be redeemed seamlessly across any grooming, luxury skin care, or chemical option on the menu.",
  ],
};

const ANNUAL_PASS: { title: string; price: string; perks: string[] } = {
  title: "Grooming Essentials Annual Pass",
  price: "₹2,999 / year",
  perks: [
    "6 Complimentary Haircuts: Valid for Basic or Advanced haircuts (limited to a maximum of 1 visit every 2 months).",
    "2 Complimentary Massages: Enjoy relaxing, premium Soothing Head Massages (Coconut or Olive variants).",
    "Flat 15% Off Discount: Enjoy immediate savings on all high-end premium chemical hair or skin care options.",
    "Priority slot configuration on weekends for ultimate comfort and minimized wait times.",
  ],
};
const ANNUAL_PASS_AMOUNT = 2999; // numeric amount for the UPI QR
const REFERRAL_REWARD = 100;

// ── UPI dynamic QR config (same pattern as BillingPage) ─────────────────────
const UPI_ID = "paytm.s209biv@pty";
const UPI_PAYEE_NAME = "Velvet Premium Unisex Salon";

const buildUpiQrSrc = (amount: number, note: string) => {
  const upiLink =
    `upi://pay?pa=${encodeURIComponent(UPI_ID)}` +
    `&pn=${encodeURIComponent(UPI_PAYEE_NAME)}` +
    `&am=${encodeURIComponent(amount.toFixed(2))}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(note)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(upiLink)}`;
};

// ─── API helpers ──────────────────────────────────────────────────────────────
const BASE = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/membership`;

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${String(res.status)})`;
    throw new Error(message);
  }
  return data as T;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const paths: Record<string, string> = {
    award:    "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12",
    star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    users:    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    gift:     "M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
    wallet:   "M21 12V7H5a2 2 0 0 1 0-4h14v4M21 12a2 2 0 0 1 0 4H5a2 2 0 0 1-2-2v-1M21 12h-3a2 2 0 0 0 0 4h3",
    plus:     "M12 5v14M5 12h14",
    minus:    "M5 12h14",
    search:   "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    check:    "M20 6L9 17l-5-5",
    x:        "M18 6L6 18M6 6l12 12",
    copy:     "M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
    whatsapp: "M12 2a10 10 0 0 1 8.93 14.47L22 22l-5.53-1.07A10 10 0 1 1 12 2z",
    refresh:  "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    phone:    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    tag:      "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
    trending: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
    crown:    "M2 20h20M5 20V10l7-7 7 7v10",
    vault:    "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 9v0",
    calendar: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18",
    userPlus: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6",
    trash:    "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16z",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[n]?.split("M").filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
    </svg>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => d
  ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  : "—";
const fmtCur = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const initials = (name: string) => name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 36, tier }: { name: string; size?: number; tier: MembershipTier }) => {
  const col = ["#d4af37","#8a7050","#b8860b","#6b5740"][name.charCodeAt(0) % 4];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: col, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.33, fontWeight: 500,
      fontFamily: "'Cormorant Garamond',serif", position: "relative",
      border: tier !== "none" ? `2px solid ${TIER_CFG[tier].color}` : "2px solid transparent",
    }}>
      {initials(name || "?")}
      {tier !== "none" && (
        <span style={{
          position: "absolute", bottom: -2, right: -2, width: 13, height: 13,
          borderRadius: "50%", background: TIER_CFG[tier].color,
          border: "1.5px solid #fff", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 7, color: "#fff",
        }}>◆</span>
      )}
    </div>
  );
};

// ─── Membership Card (decorative) ─────────────────────────────────────────────
const MemberCard = ({ tier, name, points, expiry, code }: {
  tier: MembershipTier; name: string; points: number; expiry: string; code: string;
}) => {
  const cfg = TIER_CFG[tier];
  return (
    <div style={{
      background: cfg.gradient, borderRadius: 16, padding: "22px 24px",
      color: "#fff", position: "relative", overflow: "hidden", height: 160,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <div style={{ position:"absolute", top:-30, right:-30, width:130, height:130, borderRadius:"50%", background:"rgba(255,255,255,0.07)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", bottom:-40, left:-20, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,0.05)", pointerEvents:"none" }}/>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.25em", textTransform:"uppercase", opacity:0.7 }}>Velvet CRM</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:300, marginTop:2 }}>{cfg.label}</div>
        </div>
        <div style={{ fontSize:22, opacity:0.8 }}>◆</div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
        <div>
          <div style={{ fontSize:13, fontWeight:500 }}>{name}</div>
          <div style={{ fontSize:10, opacity:0.65, marginTop:2, letterSpacing:"0.1em" }}>CODE: {code}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:18, fontFamily:"'Cormorant Garamond',serif" }}>{points.toLocaleString()} pts</div>
          {expiry && <div style={{ fontSize:10, opacity:0.65 }}>Exp: {fmtDate(expiry)}</div>}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MembershipPage() {
  const [customers, setCustomers]       = useState<Customer[]>([]);
  const [loading, setLoading]           = useState(true);
  const [apiError, setApiError]         = useState("");
  const [mainTab, setMainTab]           = useState<MainTab>("plans");
  const [search, setSearch]             = useState("");
  const [filterTier, setFilterTier]     = useState<MembershipTier | "all">("all");

  // wallet modal
  const [walletModal, setWalletModal]   = useState(false);
  const [walletTarget, setWalletTarget] = useState<Customer | null>(null);
  const [walletAction, setWalletAction] = useState<WalletAction>({ customerId:"", type:"add", points:0, reason:"" });
  const [walletSaving, setWalletSaving] = useState(false);

  // upgrade modal
  const [upgradeModal, setUpgradeModal]     = useState(false);
  const [upgradeTarget, setUpgradeTarget]   = useState<Customer | null>(null);
  const [upgradeTier, setUpgradeTier]       = useState<MembershipTier>("silver");
  const [upgradeExpiry, setUpgradeExpiry]   = useState("");
   const [upgradePassEnabled, setUpgradePassEnabled] = useState(false);
  const [upgradePassExpiry, setUpgradePassExpiry]   = useState("");
  const [upgradeSaving, setUpgradeSaving]   = useState(false);
  const [showUpgradeQr, setShowUpgradeQr]   = useState(false); // purely visual — doesn't gate submit

   // annual pass modal (standalone)
  const [passModal, setPassModal]       = useState(false);
  const [passTarget, setPassTarget]     = useState<Customer | null>(null);
  const [passExpiry, setPassExpiry]     = useState("");
  const [passSaving, setPassSaving]     = useState(false);
  const [showPassQr, setShowPassQr]     = useState(false); // purely visual — doesn't gate submit

  // add member modal
 // AFTER
// add member modal
const [addModal, setAddModal]         = useState(false);
const [addName, setAddName]           = useState("");
const [addPhone, setAddPhone]         = useState("");
const [addEmail, setAddEmail]         = useState("");
const [addSaving, setAddSaving]       = useState(false);

const [copiedCode, setCopiedCode]     = useState<string | null>(null);

// AFTER
// ── Auto-fill name + email when the typed phone matches an existing customer ──
// Only fills fields that are empty (or that WE previously auto-filled), so it
// never overwrites something the user typed themselves. A wrong/unmatched
// number leaves both fields untouched (and clears only what we auto-filled).
const [addLookupNotFound, setAddLookupNotFound] = useState(false);
const addAutoFilledRef = useRef<{ digits: string; name: string; email: string } | null>(null);

// AFTER
useEffect(() => {
  if (!addModal) return;
  const digits = addPhone.replace(/\D/g, "");

  if (digits.length < 10) {
    setAddLookupNotFound(false);
  }

  const match = digits.length >= 10
    ? customers.find(c => c.phone.replace(/\D/g, "") === digits)
    : undefined;

  // Snapshot the ref BEFORE we touch it — the setState updaters below run
  // asynchronously, so by the time they execute, addAutoFilledRef.current
  // may already have been reassigned to the NEW match. Comparing against
  // that live ref (instead of this snapshot) made the code think the old
  // autofilled name was something the user typed, so it refused to
  // overwrite it when switching straight from one match to another.
  const prevAutoFill = addAutoFilledRef.current;

  if (match) {
    setAddLookupNotFound(false);
    setAddName(n => {
      if (n && prevAutoFill?.name !== n) return n; // user typed their own name — keep it
      return match.name;
    });
    setAddEmail(em => {
      if (em && prevAutoFill?.email !== em) return em; // user typed their own email — keep it
      return match.email || "";
    });
    addAutoFilledRef.current = { digits, name: match.name, email: match.email || "" };
  } else if (prevAutoFill) {
    setAddName(n => (n === prevAutoFill.name ? "" : n));
    setAddEmail(em => (em === prevAutoFill.email ? "" : em));
    addAutoFilledRef.current = null;
    setAddLookupNotFound(digits.length >= 10);
  } else {
    setAddLookupNotFound(digits.length >= 10);
  }
}, [addPhone, customers, addModal]);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const data = await apiFetch<Customer[]>("/customers");
      setCustomers(data);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCustomers(); }, [fetchCustomers]);

  const filtered = useMemo(() => customers.filter(c =>
    (filterTier === "all" || c.membershipTier === filterTier) &&
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
  ), [customers, filterTier, search]);

  const stats = useMemo(() => ({
    total:    customers.length,
    silver:   customers.filter(c => c.membershipTier === "silver").length,
    gold:     customers.filter(c => c.membershipTier === "gold").length,
    platinum: customers.filter(c => c.membershipTier === "platinum").length,
    totalPts: customers.reduce((s, c) => s + c.loyaltyPoints, 0),
    totalReferrals: customers.reduce((s, c) => s + c.referrals.length, 0),
    convertedReferrals: customers.reduce((s, c) => s + c.referrals.filter(r => r.status === "converted").length, 0),
    rewardsGiven: customers.reduce((s, c) => s + c.referrals.filter(r => r.status === "credited").reduce((rs, r) => rs + r.reward, 0), 0),
  }), [customers]);

  // ── Wallet ──────────────────────────────────────────────────────────────────
  const openWallet = (c: Customer, type: "add" | "deduct") => {
    setWalletTarget(c);
    setWalletAction({ customerId: c._id, type, points: 0, reason: "" });
    setApiError("");
    setWalletModal(true);
  };

  const submitWallet = async () => {
    if (!walletAction.points || walletAction.points <= 0 || !walletTarget) return;
    setWalletSaving(true);
    try {
      const updated = await apiFetch<Customer>(`/customers/${walletTarget._id}/wallet`, {
        method: "PATCH",
        body: JSON.stringify({
          type:   walletAction.type,
          points: walletAction.points,
          reason: walletAction.reason,
        }),
      });
      setCustomers(prev => prev.map(c => c._id === updated._id ? updated : c));
      setWalletModal(false);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to update points");
    } finally {
      setWalletSaving(false);
    }
  };

  // ── Upgrade ─────────────────────────────────────────────────────────────────
    const openUpgrade = (c: Customer) => {
    setUpgradeTarget(c);
    setUpgradeTier(c.membershipTier === "none" ? "silver" : c.membershipTier);
    setUpgradeExpiry(c.membershipExpiry || "");
    setShowUpgradeQr(false);
    setUpgradePassEnabled(c.hasAnnualPass);
    if (c.hasAnnualPass && c.annualPassExpiry) {
      setUpgradePassExpiry(c.annualPassExpiry);
    } else {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      setUpgradePassExpiry(expiry.toISOString().slice(0, 10));
    }
    setApiError("");
    setUpgradeModal(true);
  };

  const submitUpgrade = async () => {
    if (!upgradeTarget) return;
    setUpgradeSaving(true);
    try {
      const updated = await apiFetch<Customer>(`/customers/${upgradeTarget._id}/upgrade`, {
        method: "PATCH",
        body: JSON.stringify({
          membershipTier:   upgradeTier,
          membershipExpiry: upgradeExpiry,
          hasAnnualPass:    upgradePassEnabled,
          annualPassExpiry: upgradePassEnabled ? upgradePassExpiry : "",
        }),
      });
      setCustomers(prev => prev.map(c => c._id === updated._id ? updated : c));
      setUpgradeModal(false);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to upgrade membership");
    } finally {
      setUpgradeSaving(false);
    }
  };

  // ── Add member ──────────────────────────────────────────────────────────────
  // AFTER
const openAdd = () => {
  setAddName(""); setAddPhone(""); setAddEmail("");
  setAddLookupNotFound(false);
  setApiError("");
  setAddModal(true);
};

  const submitAdd = async () => {
    if (!addName.trim() || !addPhone.trim()) {
      setApiError("Name and phone are required to add a member.");
      return;
    }
    setAddSaving(true);
    try {
      const newCustomer = await apiFetch<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify({ name: addName.trim(), phone: addPhone.trim(), email: addEmail.trim() }),
      });
      setCustomers(prev => [newCustomer, ...prev]);
      setAddModal(false);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddSaving(false);
    }
  };

  const removeCustomer = async (id: string) => {
    if (!confirm("Remove this member? This cannot be undone.")) return;
    try {
      await apiFetch(`/customers/${id}`, { method: "DELETE" });
      setCustomers(prev => prev.filter(c => c._id !== id));
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  // ── Annual Pass (standalone) ─────────────────────────────────────────────────
  const openPassModal = (c: Customer) => {
    setPassTarget(c);
    if (c.hasAnnualPass && c.annualPassExpiry) {
      setPassExpiry(c.annualPassExpiry);
    } else {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      setPassExpiry(expiry.toISOString().slice(0, 10));
    }
    setShowPassQr(false);
    setApiError("");
    setPassModal(true);
  };

  const submitPass = async () => {
    if (!passTarget || !passExpiry) return;
    setPassSaving(true);
    try {
      const updated = await apiFetch<Customer>(`/customers/${passTarget._id}/annual-pass`, {
        method: "PATCH",
        body: JSON.stringify({ annualPassExpiry: passExpiry }),
      });
      setCustomers(prev => prev.map(c => c._id === updated._id ? updated : c));
      setPassModal(false);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to update annual pass");
    } finally {
      setPassSaving(false);
    }
  };

  const removePass = async () => {
    if (!passTarget) return;
    setPassSaving(true);
    try {
      const updated = await apiFetch<Customer>(`/customers/${passTarget._id}/annual-pass`, {
        method: "DELETE",
      });
      setCustomers(prev => prev.map(c => c._id === updated._id ? updated : c));
      setPassModal(false);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to remove annual pass");
    } finally {
      setPassSaving(false);
    }
  };

  // ── Referral ────────────────────────────────────────────────────────────────
  const creditReferral = async (customerId: string, referralId: string) => {
    try {
      const updated = await apiFetch<Customer>(
        `/customers/${customerId}/referrals/${referralId}/credit`,
        { method: "PATCH" }
      );
      setCustomers(prev => prev.map(c => c._id === updated._id ? updated : c));
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to credit referral");
    }
  };

 const copyCode = (code: string) => {
  navigator.clipboard.writeText(code).then(() => {
    setCopiedCode(code);
    setTimeout(() => { setCopiedCode(null); }, 2000);
  }).catch(() => { /* clipboard write failed, ignore */ });
};

  const MAIN_TABS: { id: MainTab; label: string; icon: string }[] = [
    { id: "plans",    label: "Membership Plans", icon: "award"   },
    { id: "members",  label: "Members",          icon: "users"   },
    { id: "wallet",   label: "Wallet & Points",  icon: "wallet"  },
    { id: "referrals",label: "Referrals",        icon: "gift"    },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

       .mp-root{height:100%;display:flex;flex-direction:column;background:#f5f0e8;font-family:'Jost',sans-serif;color:#2c1f0e;overflow:hidden}

        .mp-topbar{height:60px;background:#fff;border-bottom:1px solid #ede5d6;display:flex;align-items:center;padding:0 28px;gap:14px;flex-shrink:0}
        .mp-page-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#1a1208}
        .mp-topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px}
        .mp-btn{height:36px;padding:0 16px;border:none;border-radius:8px;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s}
        .mp-btn-primary{background:#1a1208;color:#d4af37}.mp-btn-primary:hover{background:#2d2010}.mp-btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .mp-btn-secondary{background:#faf8f4;border:1px solid #ede5d6;color:#6b5740}.mp-btn-secondary:hover{border-color:#d4af37;background:#fffdf5}
        .mp-btn-sm{height:30px;padding:0 12px;font-size:10px}
        .mp-btn-gold{background:#d4af37;color:#1a1208}.mp-btn-gold:hover{background:#c9a227}

        .mp-error-banner{background:#fff5f5;border-bottom:1px solid #f5c6c6;padding:10px 28px;font-size:12px;color:#c0392b;display:flex;align-items:center;gap:8px}
        .mp-error-close{margin-left:auto;background:none;border:none;cursor:pointer;color:#c0392b}

        .mp-body{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}

        .mp-kpi-strip{background:#fff;border-bottom:1px solid #ede5d6;padding:16px 28px;display:flex;flex-wrap:wrap;row-gap:14px;gap:0;flex-shrink:0}
.mp-kpi{flex:1 1 130px;min-width:130px;padding:0 20px;border-right:1px solid #ede5d6;display:flex;flex-direction:column;gap:3px}

@media (max-width:480px){
  .mp-kpi{flex:1 1 45%;border-right:none;padding:0 10px 10px;border-bottom:1px solid #ede5d6}
}
        .mp-kpi:first-child{padding-left:0}.mp-kpi:last-child{border-right:none}
        .mp-kpi-label{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560}
        .mp-kpi-value{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:400;color:#1a1208;line-height:1}
        .mp-kpi-sub{font-size:10px;color:#8a7560}

       .mp-tabs{background:#fff;border-bottom:1px solid #ede5d6;padding:0 28px;display:flex;gap:0;flex-shrink:0;overflow-x:auto}
        .mp-tab{height:44px;padding:0 18px;border:none;background:none;cursor:pointer;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#8a7560;display:flex;align-items:center;gap:7px;border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap}
        .mp-tab:hover{color:#1a1208}.mp-tab.active{color:#1a1208;border-bottom-color:#d4af37}

        .mp-content{flex:1;overflow-y:auto;padding:28px}

        .mp-filter-bar{display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap}
        .mp-search-wrap{position:relative;flex:1;min-width:200px;max-width:320px}
        .mp-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#8a7560}
        .mp-search-input{width:100%;height:36px;border:1px solid #ede5d6;border-radius:8px;background:#fff;padding:0 12px 0 34px;font-family:'Jost',sans-serif;font-size:13px;font-weight:300;color:#2c1f0e;outline:none;transition:border-color .2s}
        .mp-search-input:focus{border-color:#d4af37}.mp-search-input::placeholder{color:#c5b89a}
        .mp-tier-chip{height:30px;padding:0 14px;border-radius:20px;border:1px solid #ede5d6;background:#fff;font-family:'Jost',sans-serif;font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;color:#8a7560;transition:all .15s;display:flex;align-items:center;gap:5px}
        .mp-tier-chip:hover{border-color:#d4af37}.mp-tier-chip.active{background:#1a1208;color:#d4af37;border-color:#1a1208}
        .mp-tier-dot{width:7px;height:7px;border-radius:50%}

        .mp-programs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}

@media (max-width:480px){
  .mp-programs-grid{grid-template-columns:1fr}
  .mp-program-header{padding:18px 18px 14px}
  .mp-program-body{padding:16px 18px 18px}
}
        .mp-program-card{border-radius:16px;overflow:hidden;border:1px solid #2a2014;background:#15110a;color:#f3e9d2;transition:box-shadow .2s,transform .2s}
        .mp-program-card:hover{box-shadow:0 8px 32px rgba(26,18,8,.25);transform:translateY(-3px)}
        .mp-program-header{padding:22px 24px 18px;border-bottom:1px solid #2a2014;position:relative}
        .mp-program-num{width:30px;height:30px;border-radius:50%;border:1px solid #d4af37;color:#d4af37;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:14px;margin-bottom:10px}
        .mp-program-title{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:400;letter-spacing:.04em;color:#f3e9d2}
        .mp-program-price-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
        .mp-program-price-chip{border:1px solid #d4af37;color:#d4af37;font-size:12px;letter-spacing:.06em;padding:5px 12px;border-radius:6px;font-family:'Jost',sans-serif}
        .mp-program-body{padding:20px 24px 22px}
        .mp-program-perks{list-style:none;display:flex;flex-direction:column;gap:12px}
        .mp-program-perk{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;color:#e8dcc0}
        .mp-program-perk-check{width:18px;height:18px;border-radius:50%;border:1px solid #d4af37;color:#d4af37;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;margin-top:1px}
        .mp-program-perk b{color:#f3e9d2;font-weight:500}
        .mp-vault-table{width:100%;border-collapse:collapse;margin-bottom:14px}
        .mp-vault-table td{padding:8px 0;font-size:13px;border-bottom:1px solid #2a2014;color:#e8dcc0}
        .mp-vault-table tr:last-child td{border-bottom:none}
        .mp-vault-name{font-family:'Cormorant Garamond',serif;color:#d4af37;font-size:15px}
        .mp-vault-arrow{text-align:center;color:#8a7560;width:30px}
        .mp-vault-amt{text-align:right;font-weight:500}
        .mp-program-notes{margin-top:14px;padding-top:14px;border-top:1px solid #2a2014;display:flex;flex-direction:column;gap:8px}
        .mp-program-note{font-size:11.5px;color:#a99876;line-height:1.5;display:flex;gap:7px}

        .mp-table-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;overflow:hidden}
        .mp-table{width:100%;border-collapse:collapse}
        .mp-table th{background:#faf8f4;padding:11px 16px;text-align:left;font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560;border-bottom:1px solid #ede5d6}
        .mp-table td{padding:13px 16px;font-size:13px;color:#2c1f0e;border-bottom:1px solid #f5f0e8;vertical-align:middle}
        .mp-table tr:last-child td{border-bottom:none}.mp-table tr:hover td{background:#fdfbf7}
        .mp-tier-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:500;letter-spacing:.06em;text-transform:uppercase}
        .mp-td-actions{display:flex;gap:6px;align-items:center}
        .mp-icon-btn{width:28px;height:28px;border:1px solid #ede5d6;border-radius:6px;background:#faf8f4;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b5740;transition:all .15s}
        .mp-icon-btn:hover{border-color:#d4af37;color:#b8860b;background:#fffdf5}
        .mp-icon-btn.danger:hover{border-color:#e74c3c;color:#e74c3c;background:#fff5f5}

        .mp-wallet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
        .mp-wallet-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:12px;transition:box-shadow .2s}
        .mp-wallet-card:hover{box-shadow:0 4px 20px rgba(44,31,14,.07)}
        .mp-wallet-top{display:flex;align-items:center;gap:12px}
        .mp-wallet-info{flex:1;min-width:0}
        .mp-wallet-name{font-size:14px;font-weight:400;color:#1a1208;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mp-wallet-phone{font-size:11px;color:#8a7560;margin-top:2px}
        .mp-pts-display{text-align:right}
        .mp-pts-val{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;color:#1a1208;line-height:1}
        .mp-pts-lbl{font-size:9px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560}
        .mp-pts-bar-track{height:4px;background:#f0e8d8;border-radius:4px;overflow:hidden}
        .mp-pts-bar-fill{height:4px;background:linear-gradient(90deg,#d4af37,#b8860b);border-radius:4px;transition:width .5s ease}
        .mp-wallet-actions{display:flex;gap:8px}
        .mp-wallet-btn{flex:1;height:30px;border-radius:6px;border:none;font-family:'Jost',sans-serif;font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .2s}
        .mp-wallet-btn-add{background:#eaf3de;color:#3b6d11}.mp-wallet-btn-add:hover{background:#d4edba}
        .mp-wallet-btn-deduct{background:#fcebeb;color:#a32d2d}.mp-wallet-btn-deduct:hover{background:#f5cccc}

        .mp-ref-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
        .mp-ref-stat-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:18px 20px}
        .mp-ref-stat-label{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8a7560;margin-bottom:8px}
        .mp-ref-stat-value{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:400;color:#1a1208;line-height:1}
        .mp-ref-stat-sub{font-size:11px;color:#8a7560;margin-top:4px}
        .mp-ref-row-cust{display:flex;align-items:center;gap:10px;margin-bottom:4px}
        .mp-ref-cust-name{font-size:13px;font-weight:400;color:#1a1208}
        .mp-ref-cust-code{font-size:10px;color:#b8860b;letter-spacing:.1em;font-family:'Cormorant Garamond',serif}
        .mp-ref-status-badge{padding:2px 9px;border-radius:20px;font-size:10px;font-weight:500;letter-spacing:.05em;text-transform:uppercase;display:inline-flex;align-items:center;gap:4px}
        .mp-ref-pending{background:#fef9ec;color:#92400e}
        .mp-ref-converted{background:#eaf3de;color:#3b6d11}
        .mp-ref-credited{background:#e8f5e9;color:#1b5e20}
        .mp-ref-credit-btn{height:26px;padding:0 10px;border:1px solid #25D366;border-radius:6px;background:#fff;color:#25D366;font-family:'Jost',sans-serif;font-size:10px;font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap}
        .mp-ref-credit-btn:hover{background:#25D366;color:#fff}
        .mp-copy-btn{height:26px;padding:0 10px;border:1px solid #ede5d6;border-radius:6px;background:#faf8f4;color:#6b5740;font-family:'Jost',sans-serif;font-size:10px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all .2s}
        .mp-copy-btn:hover{border-color:#d4af37;color:#b8860b}

        .mp-overlay{position:fixed;inset:0;background:rgba(26,18,8,.55);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;animation:mp-fadeIn .2s ease}
       .mp-modal{background:#fff;border-radius:16px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(26,18,8,.25);animation:mp-slideUp .3s ease;scrollbar-width:none;-ms-overflow-style:none}
.mp-modal::-webkit-scrollbar{display:none}
        .mp-modal-header{padding:24px 28px 16px;display:flex;align-items:flex-start;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1;border-bottom:1px solid #f0e8d8}
        .mp-modal-title{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;color:#1a1208}
        .mp-modal-sub{font-size:12px;color:#8a7560;margin-top:3px}
        .mp-modal-close{width:32px;height:32px;border:1px solid #ede5d6;border-radius:8px;background:#faf8f4;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b5740;transition:all .2s;flex-shrink:0}
        .mp-modal-close:hover{border-color:#e74c3c;color:#e74c3c;background:#fff5f5}
        .mp-modal-body{padding:22px 28px 28px;display:flex;flex-direction:column;gap:14px}
        .mp-form-field{display:flex;flex-direction:column;gap:6px}
        .mp-form-label{font-size:10px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#6b5740}
        .mp-form-input,.mp-form-select{height:42px;border:1px solid #e0d5c0;border-radius:8px;background:#fff;padding:0 14px;font-family:'Jost',sans-serif;font-size:13px;font-weight:300;color:#2c1f0e;outline:none;transition:border-color .2s,box-shadow .2s;width:100%}
        .mp-form-input:focus,.mp-form-select:focus{border-color:#d4af37;box-shadow:0 0 0 3px rgba(212,175,55,.1)}
        .mp-form-input::placeholder{color:#c5b89a}
        .mp-form-select{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
        .mp-type-toggle{display:flex;gap:8px}
        .mp-type-opt{flex:1;height:42px;border:1px solid #e0d5c0;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#8a7560;transition:all .2s}
        .mp-type-opt.add.active{border-color:#5a9e2f;background:#eaf3de;color:#3b6d11}
        .mp-type-opt.deduct.active{border-color:#c0392b;background:#fcebeb;color:#c0392b}
        .mp-modal-footer{display:flex;gap:10px;padding-top:4px}
        .mp-btn-full{flex:1;height:44px;font-size:12px}
        .mp-pts-preview{background:#faf5e8;border:1px solid #f0e4c0;border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between}
        .mp-pts-preview-label{font-size:12px;color:#6b5740}
        .mp-pts-preview-val{font-family:'Cormorant Garamond',serif;font-size:22px;color:#1a1208}

        .mp-tier-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .mp-tier-opt{padding:12px 8px;border:1px solid #e0d5c0;border-radius:8px;cursor:pointer;text-align:center;transition:all .2s}
        .mp-tier-opt:hover{border-color:#d4af37}
        .mp-tier-opt.selected{box-shadow:inset 0 0 0 2px #d4af37}
        .mp-tier-opt-name{font-size:12px;font-weight:500;letter-spacing:.06em}
        .mp-tier-opt-spend{font-size:10px;color:#8a7560;margin-top:3px}

        .mp-pass-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#faf8f4;border:1px solid #ede5d6;border-radius:10px;cursor:pointer;transition:border-color .2s}
        .mp-pass-toggle-row:hover{border-color:#d4af37}
        .mp-pass-toggle-row.enabled{background:#fef9ec;border-color:#fde68a}
        .mp-pass-toggle-left{display:flex;flex-direction:column;gap:3px}
        .mp-pass-toggle-title{font-size:13px;font-weight:500;color:#1a1208}
        .mp-pass-toggle-sub{font-size:11px;color:#8a7560}
        .mp-pass-switch{width:40px;height:22px;border-radius:11px;background:#e0d5c0;position:relative;transition:background .2s;flex-shrink:0}
        .mp-pass-switch.on{background:#d4af37}
        .mp-pass-switch-knob{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
        .mp-pass-switch.on .mp-pass-switch-knob{transform:translateX(18px)}
        .mp-pass-details{background:#15110a;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
        .mp-pass-detail-title{font-family:'Cormorant Garamond',serif;font-size:16px;color:#d4af37;margin-bottom:2px}
        .mp-pass-detail-perk{display:flex;gap:7px;font-size:11.5px;color:#e8dcc0;line-height:1.4}
        .mp-modal-divider{border:none;border-top:1px solid #f0e8d8;margin:2px 0}

        .mp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;color:#8a7560;gap:12px}
        .mp-empty-icon{opacity:.2}
        .mp-empty-text{font-size:14px;font-weight:300;letter-spacing:.06em}

        .mp-spinner{width:24px;height:24px;border:2px solid rgba(212,175,55,.3);border-top-color:#d4af37;border-radius:50%;animation:mp-spin .7s linear infinite;margin:40px auto;display:block}

        @keyframes mp-fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes mp-slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mp-spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="mp-root">

        {/* Topbar */}
        <header className="mp-topbar">
          <div className="mp-page-title">Membership & Rewards</div>
          <div className="mp-topbar-right">
            <button className="mp-btn mp-btn-secondary mp-btn-sm" onClick={openAdd}>
              <Ic n="userPlus" s={13}/> Add Member
            </button>
            <button className="mp-btn mp-btn-secondary mp-btn-sm" onClick={() => { void fetchCustomers(); }}>
  <Ic n="refresh" s={13}/> Refresh
</button>
          </div>
        </header>

        {apiError && (
          <div className="mp-error-banner">
            ⚠ {apiError}
            <button className="mp-error-close" onClick={() => { setApiError(""); }}><Ic n="x" s={14}/></button>
          </div>
        )}

        <div className="mp-body">

          {/* KPI strip */}
          <div className="mp-kpi-strip">
            {[
              { label:"Total Members",    value: stats.total,                     sub:`${String(stats.silver+stats.gold+stats.platinum)} with plans` },
{ label:"Silver Members",   value: stats.silver,                    sub:`${String(stats.total ? Math.round(stats.silver/stats.total*100) : 0)}% of customers` },
{ label:"Gold Members",     value: stats.gold,                      sub:`${String(stats.total ? Math.round(stats.gold/stats.total*100) : 0)}% of customers` },
{ label:"Platinum Members", value: stats.platinum,                  sub:`${String(stats.total ? Math.round(stats.platinum/stats.total*100) : 0)}% of customers` },
{ label:"Total Points",     value: stats.totalPts.toLocaleString(), sub:"across all customers" },
{ label:"Referral Rewards", value: fmtCur(stats.rewardsGiven),      sub:`${String(stats.convertedReferrals)} converted` },
            ].map(k => (
              <div key={k.label} className="mp-kpi">
                <span className="mp-kpi-label">{k.label}</span>
                <span className="mp-kpi-value">{k.value}</span>
                <span className="mp-kpi-sub">{k.sub}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="mp-tabs">
            {MAIN_TABS.map(t => (
              <button key={t.id} className={`mp-tab${mainTab===t.id?" active":""}`}
                onClick={() => { setMainTab(t.id); }}>
                <Ic n={t.icon} s={13}/>{t.label}
              </button>
            ))}
          </div>

          <div className="mp-content">

            {/* ── PLANS ── */}
            {mainTab === "plans" && (
              <div className="mp-programs-grid">
                <div className="mp-program-card">
                  <div className="mp-program-header">
                    <div className="mp-program-num">1</div>
                    <div className="mp-program-title">{BANK_WALLET.title}</div>
                    <div className="mp-program-price-row">
                      {BANK_WALLET.vaults.map(v => (
                        <span key={v.label} className="mp-program-price-chip">{fmtCur(v.pay)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="mp-program-body">
                    <table className="mp-vault-table">
                      <tbody>
                        {BANK_WALLET.vaults.map(v => (
                          <tr key={v.label}>
                            <td className="mp-vault-name">{v.label}</td>
                            <td>Pay {fmtCur(v.pay)}</td>
                            <td className="mp-vault-arrow">→</td>
                            <td className="mp-vault-amt">{fmtCur(v.receive)} balance</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mp-program-notes">
                      {BANK_WALLET.notes.map(n => (
                        <div key={n} className="mp-program-note">
                          <span style={{ color:"#d4af37" }}>✓</span>{n}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mp-program-card">
                  <div className="mp-program-header">
                    <div className="mp-program-num">2</div>
                    <div className="mp-program-title">{ANNUAL_PASS.title}</div>
                    <div className="mp-program-price-row">
                      <span className="mp-program-price-chip">{ANNUAL_PASS.price}</span>
                    </div>
                  </div>
                  <div className="mp-program-body">
                    <ul className="mp-program-perks">
                      {ANNUAL_PASS.perks.map(p => {
                        const [bold, ...rest] = p.split(": ");
                        return (
                          <li key={p} className="mp-program-perk">
                            <span className="mp-program-perk-check">✓</span>
                            <span>
                              {rest.length ? <><b>{bold}:</b> {rest.join(": ")}</> : p}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ── MEMBERS ── */}
            {mainTab === "members" && (
              <>
                <div className="mp-filter-bar">
                  <div className="mp-search-wrap">
                    <span className="mp-search-icon"><Ic n="search" s={14}/></span>
                    <input className="mp-search-input" placeholder="Search name or phone…"
                      value={search} onChange={e => { setSearch(e.target.value); }}/>
                  </div>
                  {(["all","silver","gold","platinum"] as const).map(t => (
                    <button key={t}
                      className={`mp-tier-chip${filterTier===t?" active":""}`}
                      onClick={() => { setFilterTier(t); }}>
                      {t !== "all" && <span className="mp-tier-dot" style={{ background: TIER_CFG[t as MembershipTier].color }}/>}
                      {t === "all" ? "All" : TIER_CFG[t as MembershipTier].label}
                    </button>
                  ))}
                  <span className="mp-tier-chip" style={{ cursor:"default", background:"#faf5e8", borderColor:"#f0e4c0", color:"#92400e" }}>
                    <Ic n="star" s={11}/> {customers.filter(c => c.hasAnnualPass).length} Annual Pass
                  </span>
                </div>
                {loading ? <div className="mp-spinner"/> : (
                  <div className="mp-table-card">
                    <table className="mp-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Tier</th>
                          <th>Points</th>
                          <th>Total Spend</th>
                          <th>Visits</th>
                          <th>Expiry</th>
                          <th>Annual Pass</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr>
                            <td colSpan={8}>
                              <div className="mp-empty">
                                <div className="mp-empty-icon"><Ic n="users" s={48}/></div>
                                <div className="mp-empty-text">No members yet — add your first member to get started</div>
                                <button className="mp-btn mp-btn-primary" onClick={openAdd}>
                                  <Ic n="userPlus" s={13}/> Add Member
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : filtered.map(c => {
                          const cfg = TIER_CFG[c.membershipTier];
                          return (
                            <tr key={c._id}>
                              <td>
                                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                  <Avatar name={c.name} size={32} tier={c.membershipTier}/>
                                  <div>
                                    <div style={{ fontWeight:400 }}>{c.name}</div>
                                    <div style={{ fontSize:11, color:"#8a7560" }}>{c.phone}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="mp-tier-badge" style={{ background:cfg.bg, color:cfg.color }}>
                                  {cfg.label}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, color:"#b8860b" }}>
  {c.loyaltyPoints.toLocaleString()}
</span>
</td>
<td style={{ color:"#b8860b", fontWeight:500 }}>{fmtCur(c.totalSpent)}</td>
<td style={{ color:"#6b5740" }}>{c.visitCount}</td>
                              <td style={{ fontSize:12, color:"#8a7560" }}>{c.membershipExpiry ? fmtDate(c.membershipExpiry) : "—"}</td>
                              <td>
                                {c.hasAnnualPass ? (
                                  <div style={{ display:"flex", flexDirection:"column", gap:2, cursor:"pointer" }}
                                    onClick={() => { openPassModal(c); }}>
                                    <span className="mp-tier-badge" style={{ background:"#fef9ec", color:"#92400e", width:"fit-content" }}>
                                      <Ic n="star" s={10}/> Active
                                    </span>
                                    <span style={{ fontSize:10, color:"#8a7560" }}>till {fmtDate(c.annualPassExpiry)}</span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize:12, color:"#c5b89a" }}>—</span>
                                )}
                              </td>
                              <td>
                                <div className="mp-td-actions">
                                  <button className="mp-btn mp-btn-secondary mp-btn-sm"
                                    onClick={() => { openUpgrade(c); }}>
                                    <Ic n="award" s={11}/> Upgrade
                                  </button>
                                  <button className="mp-icon-btn" title={c.hasAnnualPass ? "Manage Annual Pass" : "Assign Annual Pass"}
                                    onClick={() => { openPassModal(c); }}
                                    style={c.hasAnnualPass ? { borderColor:"#fde68a", color:"#92400e", background:"#fef9ec" } : undefined}>
                                    <Ic n="star" s={13}/>
                                  </button>
                                  <button className="mp-icon-btn" title="Add points"
                                    onClick={() => { openWallet(c, "add"); }}>
                                    <Ic n="plus" s={13}/>
                                  </button>
                                  <button className="mp-icon-btn danger" title="Remove member"
  onClick={() => { void removeCustomer(c._id); }}>
  <Ic n="trash" s={13}/>
</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── WALLET & POINTS ── */}
            {mainTab === "wallet" && (
              <>
                <div className="mp-filter-bar">
                  <div className="mp-search-wrap">
                    <span className="mp-search-icon"><Ic n="search" s={14}/></span>
                    <input className="mp-search-input" placeholder="Search customer…"
                      value={search} onChange={e => { setSearch(e.target.value); }}/>
                  </div>
                </div>
                {loading ? <div className="mp-spinner"/> : filtered.length === 0 ? (
                  <div className="mp-empty">
                    <div className="mp-empty-icon"><Ic n="wallet" s={48}/></div>
                    <div className="mp-empty-text">No members yet — add members to manage their points</div>
                    <button className="mp-btn mp-btn-primary" onClick={openAdd}>
                      <Ic n="userPlus" s={13}/> Add Member
                    </button>
                  </div>
                ) : (
                  <div className="mp-wallet-grid">
                    {filtered.map(c => {
  const maxPts = 5000;
  const pct = Math.min(100, Math.round((c.loyaltyPoints / maxPts) * 100));
  return (
    <div key={c._id} className="mp-wallet-card">
      <div className="mp-wallet-top">
        <Avatar name={c.name} size={40} tier={c.membershipTier}/>
        <div className="mp-wallet-info">
          <div className="mp-wallet-name">{c.name}</div>
          <div className="mp-wallet-phone">{c.phone}</div>
        </div>
        <div className="mp-pts-display">
          <div className="mp-pts-val">{c.loyaltyPoints.toLocaleString()}</div>
          <div className="mp-pts-lbl">points</div>
        </div>
      </div>
      <div>
        <div className="mp-pts-bar-track">
          <div className="mp-pts-bar-fill" style={{ width:`${String(pct)}%` }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
          <span style={{ fontSize:10, color:"#8a7560" }}>
            ≈ {fmtCur(Math.floor(c.loyaltyPoints/10))} value
          </span>
          <span style={{ fontSize:10, color:"#8a7560" }}>
            {TIER_CFG[c.membershipTier].label} · {TIER_CFG[c.membershipTier].pointsMultiplier}×
          </span>
        </div>
      </div>
      <MemberCard
        tier={c.membershipTier}
        name={c.name}
        points={c.loyaltyPoints}
        expiry={c.membershipExpiry}
        code={c.referralCode}
      />
                          <div className="mp-wallet-actions">
                            <button className="mp-wallet-btn mp-wallet-btn-add"
                              onClick={() => { openWallet(c, "add"); }}>
                              <Ic n="plus" s={12}/> Add Points
                            </button>
                            <button className="mp-wallet-btn mp-wallet-btn-deduct"
                              onClick={() => { openWallet(c, "deduct"); }}>
                              <Ic n="minus" s={12}/> Redeem
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── REFERRALS ── */}
            {mainTab === "referrals" && (
              <>
                <div className="mp-ref-summary">
                  {[
                    { label:"Total Referrals",    value: stats.totalReferrals,          sub:"across all customers"    },
                    { label:"Converted",           value: stats.convertedReferrals,      sub:"became paying customers" },
                    { label:"Reward per Referral", value: fmtCur(REFERRAL_REWARD),       sub:"credited on conversion"  },
                    { label:"Total Rewards Given", value: fmtCur(stats.rewardsGiven),    sub:"to referring customers"  },
                  ].map(s => (
                    <div key={s.label} className="mp-ref-stat-card">
                      <div className="mp-ref-stat-label">{s.label}</div>
                      <div className="mp-ref-stat-value">{s.value}</div>
                      <div className="mp-ref-stat-sub">{s.sub}</div>
                    </div>
                  ))}
                </div>
                {loading ? <div className="mp-spinner"/> : (
                  <div className="mp-table-card">
                    <table className="mp-table">
                      <thead>
                        <tr>
                          <th>Referrer</th>
                          <th>Referral Code</th>
                          <th>Referred</th>
                          <th>Phone</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Reward</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                       {customers.flatMap(c =>
  c.referrals.map(r => ({ ...r, referrer: c }))
).length === 0 ? (
  <tr>
    <td colSpan={8}>
      <div className="mp-empty">
        <div className="mp-empty-icon"><Ic n="gift" s={48}/></div>
        <div className="mp-empty-text">No referrals yet — they'll appear here once members start referring</div>
      </div>
    </td>
  </tr>
) : (
  customers.flatMap(c =>
    c.referrals.map(r => ({ ...r, referrer: c }))
  ).sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                            <tr key={r._id}>
                              <td>
                                <div className="mp-ref-row-cust">
                                  <Avatar name={r.referrer.name} size={28} tier={r.referrer.membershipTier}/>
                                  <div>
                                    <div className="mp-ref-cust-name">{r.referrer.name}</div>
                                    <div className="mp-ref-cust-code">{r.referrer.referralCode}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:15, letterSpacing:"0.1em" }}>
                                    {r.referrer.referralCode}
                                  </span>
                                  <button className="mp-copy-btn" onClick={() => { copyCode(r.referrer.referralCode); }}>
                                    <Ic n={copiedCode===r.referrer.referralCode ? "check":"copy"} s={11}/>
                                    {copiedCode===r.referrer.referralCode ? "Copied":"Copy"}
                                  </button>
                                </div>
                              </td>
                              <td style={{ fontWeight:400 }}>{r.referredName}</td>
                              <td style={{ color:"#6b5740", fontSize:12 }}>{r.referredPhone}</td>
                              <td style={{ fontSize:12, color:"#8a7560", whiteSpace:"nowrap" }}>{fmtDate(r.date)}</td>
                              <td>
                                <span className={`mp-ref-status-badge mp-ref-${r.status}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td style={{ color:"#b8860b", fontWeight:500 }}>{fmtCur(r.reward)}</td>
                              <td>
                                {r.status === "converted" && (
                                  <button className="mp-ref-credit-btn"
  onClick={() => { void creditReferral(r.referrer._id, r._id); }}>
  Credit Reward
</button>
                                )}
                                {r.status === "credited" && (
                                  <span style={{ fontSize:11, color:"#1b5e20" }}>✓ Credited</span>
                                )}
                                {r.status === "pending" && (
                                  <span style={{ fontSize:11, color:"#8a7560" }}>Awaiting visit</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Wallet Modal ── */}
        {walletModal && walletTarget && (
          <div className="mp-overlay" onClick={() => { setWalletModal(false); }}>
            <div className="mp-modal" onClick={e => { e.stopPropagation(); }}>
              <div className="mp-modal-header">
                <div>
                  <div className="mp-modal-title">Manage Points</div>
                  <div className="mp-modal-sub">{walletTarget.name} · {walletTarget.phone}</div>
                </div>
                <button className="mp-modal-close" onClick={() => { setWalletModal(false); }}><Ic n="x" s={14}/></button>
              </div>
              <div className="mp-modal-body">
                <div className="mp-pts-preview">
                  <span className="mp-pts-preview-label">Current Balance</span>
                  <span className="mp-pts-preview-val">{walletTarget.loyaltyPoints.toLocaleString()} pts</span>
                </div>
                <div className="mp-form-field">
                  <label className="mp-form-label">Action</label>
                  <div className="mp-type-toggle">
                    <button className={`mp-type-opt add${walletAction.type==="add"?" active":""}`}
                      onClick={() => { setWalletAction(a => ({ ...a, type:"add" })); }}>
                      <Ic n="plus" s={13}/> Add Points
                    </button>
                    <button className={`mp-type-opt deduct${walletAction.type==="deduct"?" active":""}`}
                      onClick={() => { setWalletAction(a => ({ ...a, type:"deduct" })); }}>
                      <Ic n="minus" s={13}/> Redeem / Deduct
                    </button>
                  </div>
                </div>
                <div className="mp-form-field">
                  <label className="mp-form-label">Points</label>
                  <input className="mp-form-input" type="number" min={1} placeholder="Enter points"
                    value={walletAction.points || ""}
                    onChange={e => { setWalletAction(a => ({ ...a, points: Number(e.target.value) })); }}/>
                </div>
                <div className="mp-form-field">
                  <label className="mp-form-label">Reason</label>
                  <input className="mp-form-input" placeholder="e.g. Birthday bonus, Service redemption…"
                    value={walletAction.reason}
                    onChange={e => { setWalletAction(a => ({ ...a, reason: e.target.value })); }}/>
                </div>
                {walletAction.points > 0 && (
                  <div className="mp-pts-preview">
                    <span className="mp-pts-preview-label">New Balance</span>
                    <span className="mp-pts-preview-val" style={{ color: walletAction.type==="add" ? "#3b6d11" : "#a32d2d" }}>
                      {Math.max(0, walletTarget.loyaltyPoints + (walletAction.type==="add" ? walletAction.points : -walletAction.points)).toLocaleString()} pts
                    </span>
                  </div>
                )}
                <div className="mp-modal-footer">
                  <button className="mp-btn mp-btn-secondary mp-btn-full" onClick={() => { setWalletModal(false); }}>Cancel</button>
                  <button className="mp-btn mp-btn-primary mp-btn-full" onClick={() => { void submitWallet(); }} disabled={walletSaving || !walletAction.points}>
                    {walletSaving ? "Saving…" : <><Ic n="check" s={14}/> Confirm</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Upgrade Modal ── */}
        {upgradeModal && upgradeTarget && (
          <div className="mp-overlay" onClick={() => { setUpgradeModal(false); }}>
            <div className="mp-modal" onClick={e => { e.stopPropagation(); }}>
              <div className="mp-modal-header">
                <div>
                  <div className="mp-modal-title">Upgrade Membership</div>
                  <div className="mp-modal-sub">{upgradeTarget.name} · currently {TIER_CFG[upgradeTarget.membershipTier].label}</div>
                </div>
                <button className="mp-modal-close" onClick={() => { setUpgradeModal(false); }}><Ic n="x" s={14}/></button>
              </div>
              <div className="mp-modal-body">
                <div className="mp-form-field">
                  <label className="mp-form-label">Membership Tier</label>
                  <div className="mp-tier-opts">
                    {(["silver","gold","platinum"] as MembershipTier[]).map(t => {
                      const cfg = TIER_CFG[t];
                      return (
                        <div key={t}
                          className={`mp-tier-opt${upgradeTier===t?" selected":""}`}
                          style={{ borderColor: upgradeTier===t ? cfg.color : "#e0d5c0" }}
                          onClick={() => { setUpgradeTier(t); }}>
                          <div className="mp-tier-opt-name" style={{ color: cfg.color }}>{cfg.label}</div>
                          <div className="mp-tier-opt-spend">from {fmtCur(cfg.minSpend)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mp-form-field">
                  <label className="mp-form-label">Tier Expiry Date</label>
                  <input type="date" className="mp-form-input" value={upgradeExpiry}
                    onChange={e => { setUpgradeExpiry(e.target.value); }}/>
                </div>
                <div style={{ background:"#faf8f4", border:"1px solid #f0e8d8", borderRadius:8, padding:"12px 16px" }}>
                  <div style={{ fontSize:10, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8a7560", marginBottom:8 }}>
                    {TIER_CFG[upgradeTier].label} Perks
                  </div>
                                    {TIER_CFG[upgradeTier].perks.map(p => (
                    <div key={p} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"#2c1f0e", marginBottom:5 }}>
                      <span style={{ color: TIER_CFG[upgradeTier].color, fontSize:11 }}>✓</span>{p}
                    </div>
                  ))}
                </div>

                {/* ── UPI Scan & Pay for the membership fee ── */}
                <div className="mp-form-field">
                  <label className="mp-form-label">Collect Payment</label>
                  <button
                    type="button"
                    className="mp-btn mp-btn-secondary"
                    style={{ width:"100%", justifyContent:"center" }}
                    onClick={() => { setShowUpgradeQr(v => !v); }}
                  >
                    <Ic n="wallet" s={13}/> {showUpgradeQr ? "Hide" : "Show"} Scan &amp; Pay QR
                  </button>

                  {showUpgradeQr && (
                    <div style={{
                      marginTop:12, padding:"22px", borderRadius:14,
                      background:"#fffdf5", border:"1px solid #e8d8a8",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:10,
                    }}>
                      <div style={{
                        display:"flex", alignItems:"center", gap:8, fontSize:11, fontWeight:500,
                        letterSpacing:"0.16em", textTransform:"uppercase", color:"#b8860b",
                      }}>
                        <Ic n="wallet" s={14}/> Scan &amp; Pay
                      </div>
                                           <img
                        src={buildUpiQrSrc(
                          TIER_CFG[upgradeTier].minSpend,
                          `${TIER_CFG[upgradeTier].label} Membership - Velvet Salon`
                        )}
                        alt={`Scan & Pay ₹${String(TIER_CFG[upgradeTier].minSpend)} via UPI`}
                        style={{ width:220, maxWidth:"100%", height:"auto", display:"block" }}
                      />
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:12, color:"#6b5740", fontWeight:500 }}>
                          Pay securely with Paytm / UPI
                        </div>
                        <div style={{ fontSize:11, color:"#8a7560", marginTop:2 }}>
                          {UPI_ID} · {fmtCur(TIER_CFG[upgradeTier].minSpend)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <hr className="mp-modal-divider"/>
                <div className="mp-form-field">
                  <label className="mp-form-label">Annual Pass</label>
                  <div
                    className={`mp-pass-toggle-row${upgradePassEnabled ? " enabled" : ""}`}
                    onClick={() => { setUpgradePassEnabled(p => !p); }}
                  >
                    <div className="mp-pass-toggle-left">
                      <div className="mp-pass-toggle-title">
                        {upgradeTarget.hasAnnualPass ? "Annual Pass — Active" : "Grooming Essentials Annual Pass"}
                      </div>
                      <div className="mp-pass-toggle-sub">
                        {upgradePassEnabled
                          ? `₹2,999 / year · toggle off to remove`
                          : upgradeTarget.hasAnnualPass
                            ? `Currently active till ${fmtDate(upgradeTarget.annualPassExpiry)} · toggle to manage`
                            : "₹2,999 / year · toggle on to assign"}
                      </div>
                    </div>
                    <div className={`mp-pass-switch${upgradePassEnabled ? " on" : ""}`}>
                      <div className="mp-pass-switch-knob"/>
                    </div>
                  </div>
                  {upgradePassEnabled && (
                    <>
                      <div className="mp-pass-details">
                        <div className="mp-pass-detail-title">{ANNUAL_PASS.title}</div>
                        {ANNUAL_PASS.perks.map(p => {
                          const [bold, ...rest] = p.split(": ");
                          return (
                            <div key={p} className="mp-pass-detail-perk">
                              <span style={{ color:"#d4af37", flexShrink:0 }}>✓</span>
                              <span>
                                {rest.length
                                  ? <><b style={{ color:"#f3e9d2" }}>{bold}:</b> {rest.join(": ")}</>
                                  : p}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mp-form-field" style={{ marginTop:4 }}>
                        <label className="mp-form-label">Pass Expiry Date</label>
                        <input type="date" className="mp-form-input" value={upgradePassExpiry}
                          onChange={e => { setUpgradePassExpiry(e.target.value); }}/>
                      </div>
                    </>
                  )}
                </div>
                <div className="mp-modal-footer">
                  <button className="mp-btn mp-btn-secondary mp-btn-full" onClick={() => { setUpgradeModal(false); }}>Cancel</button>
                 <button className="mp-btn mp-btn-primary mp-btn-full" onClick={() => { void submitUpgrade(); }} disabled={upgradeSaving || (upgradePassEnabled && !upgradePassExpiry)}>
                    {upgradeSaving ? "Saving…" : <><Ic n="check" s={14}/> Confirm Upgrade</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Annual Pass Standalone Modal ── */}
        {passModal && passTarget && (
          <div className="mp-overlay" onClick={() => { setPassModal(false); }}>
            <div className="mp-modal" onClick={e => { e.stopPropagation(); }}>
              <div className="mp-modal-header">
                <div>
                  <div className="mp-modal-title">Annual Pass</div>
                  <div className="mp-modal-sub">
                    {passTarget.name} · {passTarget.hasAnnualPass ? `active till ${fmtDate(passTarget.annualPassExpiry)}` : "not enrolled"}
                  </div>
                </div>
                <button className="mp-modal-close" onClick={() => { setPassModal(false); }}><Ic n="x" s={14}/></button>
              </div>
              <div className="mp-modal-body">
                <div style={{ background:"#15110a", borderRadius:12, padding:"18px 20px", color:"#f3e9d2" }}>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:"#d4af37", marginBottom:4 }}>
                    {ANNUAL_PASS.title}
                  </div>
                  <div style={{ fontSize:12, color:"#a99876", marginBottom:12 }}>{ANNUAL_PASS.price}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                    {ANNUAL_PASS.perks.map(p => {
                      const [bold, ...rest] = p.split(": ");
                      return (
                        <div key={p} style={{ display:"flex", gap:8, fontSize:11.5, lineHeight:1.4, color:"#e8dcc0" }}>
                          <span style={{ color:"#d4af37" }}>✓</span>
                          <span>{rest.length ? <><b style={{ color:"#f3e9d2" }}>{bold}:</b> {rest.join(": ")}</> : p}</span>
                        </div>
                      );
                                      })}
                  </div>
                </div>

                {/* ── UPI Scan & Pay for the Annual Pass fee ── */}
                <div className="mp-form-field">
                  <label className="mp-form-label">Collect Payment</label>
                  <button
                    type="button"
                    className="mp-btn mp-btn-secondary"
                    style={{ width:"100%", justifyContent:"center" }}
                    onClick={() => { setShowPassQr(v => !v); }}
                  >
                    <Ic n="wallet" s={13}/> {showPassQr ? "Hide" : "Show"} Scan &amp; Pay QR
                  </button>

                  {showPassQr && (
                    <div style={{
                      marginTop:12, padding:"22px", borderRadius:14,
                      background:"#fffdf5", border:"1px solid #e8d8a8",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:10,
                    }}>
                      <div style={{
                        display:"flex", alignItems:"center", gap:8, fontSize:11, fontWeight:500,
                        letterSpacing:"0.16em", textTransform:"uppercase", color:"#b8860b",
                      }}>
                        <Ic n="wallet" s={14}/> Scan &amp; Pay
                      </div>
                                           <img
                        src={buildUpiQrSrc(ANNUAL_PASS_AMOUNT, `${ANNUAL_PASS.title} - Velvet Salon`)}
                        alt={`Scan & Pay ₹${String(ANNUAL_PASS_AMOUNT)} via UPI`}
                        style={{ width:220, maxWidth:"100%", height:"auto", display:"block" }}
                      />
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:12, color:"#6b5740", fontWeight:500 }}>
                          Pay securely with Paytm / UPI
                        </div>
                        <div style={{ fontSize:11, color:"#8a7560", marginTop:2 }}>
                          {UPI_ID} · {fmtCur(ANNUAL_PASS_AMOUNT)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mp-form-field">
                  <label className="mp-form-label">Pass Expiry Date</label>
                  <input type="date" className="mp-form-input" value={passExpiry}
                    onChange={e => { setPassExpiry(e.target.value); }}/>
                </div>
                <div className="mp-modal-footer">
                  {passTarget.hasAnnualPass ? (
                    <>
                      <button className="mp-btn mp-btn-secondary mp-btn-full" onClick={() => { void removePass(); }} disabled={passSaving}
  style={{ borderColor:"#f5c6c6", color:"#c0392b" }}>
  {passSaving ? "Removing…" : <><Ic n="x" s={14}/> Remove Pass</>}
</button>
<button className="mp-btn mp-btn-primary mp-btn-full" onClick={() => { void submitPass(); }} disabled={passSaving || !passExpiry}>
  {passSaving ? "Saving…" : <><Ic n="check" s={14}/> Update Expiry</>}
</button>
                    </>
                  ) : (
                    <>
                      <button className="mp-btn mp-btn-secondary mp-btn-full" onClick={() => { setPassModal(false); }}>Cancel</button>
                      <button className="mp-btn mp-btn-primary mp-btn-full" onClick={() => { void submitPass(); }} disabled={passSaving || !passExpiry}>
  {passSaving ? "Saving…" : <><Ic n="check" s={14}/> Assign Pass</>}
</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Add Member Modal ── */}
        {addModal && (
          <div className="mp-overlay" onClick={() => { setAddModal(false); }}>
            <div className="mp-modal" onClick={e => { e.stopPropagation(); }}>
              <div className="mp-modal-header">
                <div>
                  <div className="mp-modal-title">Add Member</div>
                  <div className="mp-modal-sub">Create a new customer profile</div>
                </div>
                <button className="mp-modal-close" onClick={() => { setAddModal(false); }}><Ic n="x" s={14}/></button>
              </div>
              <div className="mp-modal-body">
                <div className="mp-form-field">
                  <label className="mp-form-label">Full Name</label>
                  <input className="mp-form-input" placeholder="e.g. Aarav Mehta"
                    value={addName} onChange={e => { setAddName(e.target.value); }}/>
                </div>
               
<div className="mp-form-field">
  <label className="mp-form-label">
    Phone
    {addLookupNotFound && (
      <span style={{ marginLeft: 8, fontSize: 10, color: "#a32d2d", textTransform: "none", letterSpacing: 0 }}>
        No customer found
      </span>
    )}
  </label>
  <input className="mp-form-input" placeholder="e.g. 9876543210"
    value={addPhone} onChange={e => { setAddPhone(e.target.value); }}/>
</div>
                <div className="mp-form-field">
                  <label className="mp-form-label">Email (optional)</label>
                  <input className="mp-form-input" placeholder="e.g. name@example.com"
                    value={addEmail} onChange={e => { setAddEmail(e.target.value); }}/>
                </div>
                <div className="mp-modal-footer">
                  <button className="mp-btn mp-btn-secondary mp-btn-full" onClick={() => { setAddModal(false); }}>Cancel</button>
                  <button className="mp-btn mp-btn-primary mp-btn-full" onClick={() => { void submitAdd(); }} disabled={addSaving}>
                    {addSaving ? "Saving…" : <><Ic n="check" s={14}/> Add Member</>}
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