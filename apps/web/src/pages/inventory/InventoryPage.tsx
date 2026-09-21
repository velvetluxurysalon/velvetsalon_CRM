import { useState, useMemo, useCallback, useEffect } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ProductCategory =
  | "Hair Care"
  | "Colour & Bleach"
  | "Skin Care"
  | "Nail Care"
  | "Tools & Equipment"
  | "Disposables"
  | "Other";

type StockStatus = "ok" | "low" | "critical" | "out";

interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  sku: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  costPrice: number;
  sellingPrice: number;
  location: string;
  notes: string;
  createdAt: string;
}

interface PurchaseEntry {
  id: string;
  productId: string;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
  supplier: string;
  invoiceNo: string;
  date: string;
  notes: string;
  addedBy: string;
}

interface UsageEntry {
  id: string;
  productId: string;
  quantity: number;
  reason: string;
  serviceRef?: string;
  date: string;
  notes: string;
}

// ─── Service Map types ──────────────────────────────────────────────────────────
interface ServiceConsumable {
  productName: string;
  quantity: number;
  unit: string;
}
interface ServiceMapEntry {
  _id: string;
  serviceId: string;
  serviceName: string;
  consumables: ServiceConsumable[];
}

// ─── Static config ──────────────────────────────────────────────────────────────
const CATEGORIES: ProductCategory[] = [
  "Hair Care",
  "Colour & Bleach",
  "Skin Care",
  "Nail Care",
  "Tools & Equipment",
  "Disposables",
  "Other",
];

const CAT_CFG: Record<
  ProductCategory,
  { color: string; bg: string; icon: string; tw: string; twBg: string }
> = {
  "Hair Care": {
    color: "#b8860b",
    bg: "#fefce8",
    icon: "✦",
    tw: "text-yellow-700",
    twBg: "bg-yellow-50",
  },
  "Colour & Bleach": {
    color: "#9333ea",
    bg: "#faf5ff",
    icon: "◈",
    tw: "text-purple-600",
    twBg: "bg-purple-50",
  },
  "Skin Care": {
    color: "#0369a1",
    bg: "#e0f2fe",
    icon: "◉",
    tw: "text-sky-700",
    twBg: "bg-sky-100",
  },
  "Nail Care": {
    color: "#be185d",
    bg: "#fdf2f8",
    icon: "◆",
    tw: "text-pink-700",
    twBg: "bg-pink-50",
  },
  "Tools & Equipment": {
    color: "#374151",
    bg: "#f3f4f6",
    icon: "⊕",
    tw: "text-gray-700",
    twBg: "bg-gray-100",
  },
  Disposables: {
    color: "#065f46",
    bg: "#ecfdf5",
    icon: "◎",
    tw: "text-emerald-800",
    twBg: "bg-emerald-50",
  },
  Other: {
    color: "#6b5740",
    bg: "#f5f0e8",
    icon: "○",
    tw: "text-stone-600",
    twBg: "bg-stone-100",
  },
};

const STATUS_CFG: Record<
  StockStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  ok: {
    label: "In Stock",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#86efac",
  },
  low: {
    label: "Low Stock",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fcd34d",
  },
  critical: {
    label: "Critical",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fca5a5",
  },
  out: {
    label: "Out of Stock",
    color: "#7f1d1d",
    bg: "#fef2f2",
    border: "#ef4444",
  },
};

const UNITS = [
  "ml",
  "L",
  "g",
  "kg",
  "pcs",
  "box",
  "pack",
  "pair",
  "roll",
  "bottle",
  "tube",
  "sachet",
];
const REASONS = ["service", "damaged", "expired", "sample", "other"];

// Static list of services to show in mapping UI
const SERVICES_LIST = [
  { id: "s1",  name: "Hair Cut" },
  { id: "s2",  name: "Hair Colour" },
  { id: "s3",  name: "Keratin Treatment" },
  { id: "s4",  name: "Hair Spa" },
  { id: "s5",  name: "Beard Styling" },
  { id: "s6",  name: "Clean Shave" },
  { id: "s7",  name: "Facial" },
  { id: "s8",  name: "Threading" },
  { id: "s9",  name: "Manicure" },
  { id: "s10", name: "Pedicure" },
  { id: "s11", name: "Waxing" },
  { id: "s12", name: "Massage" },
];

const todayStr = new Date().toISOString().slice(0, 10);

// ─── API helpers ────────────────────────────────────────────────────────────────
const API = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/inventory`;
const API_SVC_MAP = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/service-map`;

const hdr = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${(() => {
    try {
      return (
        (JSON.parse(localStorage.getItem("velvet_token") ?? "{}") as { token?: string }).token ?? ""
      );
    } catch {
      return "";
    }
  })()}`,
});

const fetchProducts = (): Promise<Product[]> =>
  fetch(API, { headers: hdr() }).then((r) => r.json());

const fetchPurchases = (): Promise<PurchaseEntry[]> =>
  fetch(`${API}/purchases`, { headers: hdr() }).then((r) => r.json());

const fetchUsage = (): Promise<UsageEntry[]> =>
  fetch(`${API}/usage`, { headers: hdr() }).then((r) => r.json());

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtCur = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (d: string) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const getStatus = (p: Product): StockStatus => {
  if (p.currentStock <= 0) return "out";
  if (p.currentStock <= p.lowStockThreshold * 0.5) return "critical";
  if (p.currentStock <= p.lowStockThreshold) return "low";
  return "ok";
};

const stockPct = (p: Product) =>
  Math.min(
    100,
    p.lowStockThreshold > 0
      ? Math.round((p.currentStock / (p.lowStockThreshold * 3)) * 100)
      : 100
  );

// ─── Icons ─────────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const p: Record<string, string> = {
    plus: "M12 5v14M5 12h14",
    search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    box: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
    alert:
      "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
    edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z",
    trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
    x: "M18 6L6 18M6 6l12 12",
    check: "M20 6L9 17l-5-5",
    refresh:
      "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    download:
      "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    chevD: "M6 9l6 6 6-6",
    chevR: "M9 18l6-6-6-6",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    tag: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
    truck:
      "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    minus: "M5 12h14",
    history:
      "M12 2a10 10 0 0 0-10 10M12 2v4M4.93 4.93l2.83 2.83M2 12h4M22 12a10 10 0 0 1-10 10M22 12h-4M19.07 19.07l-2.83-2.83M12 22v-4",
    link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    scissors: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12",
    zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  };
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {p[n]
        ?.split("M")
        .filter(Boolean)
        .map((d, i) => <path key={i} d={`M${d}`} />)}
    </svg>
  );
};

// ─── Stock Bar ──────────────────────────────────────────────────────────────────
const StockBar = ({ product }: { product: Product }) => {
  const status = getStatus(product);
  const pct = stockPct(product);
  const cfg = STATUS_CFG[status];
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
        <div
          className="h-1.5 rounded-full transition-[width] duration-300 ease-in-out"
          style={{ width: `${pct.toString()}%`, background: cfg.color }}
        />
      </div>
      <span
        className="text-[11px] font-semibold min-w-[28px] text-right"
        style={{ color: cfg.color }}
      >
        {product.currentStock}
      </span>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<PurchaseEntry[]>([]);
  const [usageLog, setUsageLog] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<ProductCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<StockStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [activeTab, setActiveTab] = useState<
    "stock" | "purchases" | "usage" | "alerts" | "mappings"
  >("stock");

  const [selected, setSelected] = useState<Product | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "history">("info");

  // ── Service Map state ─────────────────────────────────────────────────────────
  const [serviceMapEntries, setServiceMapEntries] = useState<ServiceMapEntry[]>([]);
  const [serviceMapLoading, setServiceMapLoading] = useState(false);
  const [serviceMapSaving, setServiceMapSaving] = useState(false);
  const [mapError, setMapError] = useState("");
  // Which service is expanded in the mapping UI
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  // Edit state for a service's consumables
  const [editingEntry, setEditingEntry] = useState<{ serviceId: string; consumables: ServiceConsumable[] } | null>(null);

  // Modals
  const [productModal, setProductModal] = useState<{
    mode: "add" | "edit";
    data: Partial<Product>;
  } | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<{
    productId: string;
    data: Partial<PurchaseEntry>;
  } | null>(null);
  const [usageModal, setUsageModal] = useState<{
    productId: string;
    data: Partial<UsageEntry>;
  } | null>(null);

  // ── Load inventory data ───────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prods, purs, usage] = await Promise.all([
          fetchProducts(),
          fetchPurchases(),
          fetchUsage(),
        ]);
        setProducts(prods);
        setPurchases(purs);
        setUsageLog(usage);
      } catch (err) {
        console.error("Failed to load inventory data", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // ── Load service map when tab is opened ──────────────────────────────────────
  const loadServiceMap = useCallback(async () => {
    setServiceMapLoading(true);
    setMapError("");
    try {
      const res = await fetch(API_SVC_MAP, { headers: hdr() });
      if (!res.ok) throw new Error("Failed to load service map");
      const data = (await res.json()) as ServiceMapEntry[];
      setServiceMapEntries(data);
    } catch (err) {
      setMapError("Could not load service mappings. Make sure the /api/service-map endpoint is running.");
      console.error(err);
    } finally {
      setServiceMapLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "mappings") {
      void loadServiceMap();
    }
  }, [activeTab, loadServiceMap]);

  // ── Save a service mapping entry ──────────────────────────────────────────────
  const saveServiceMapping = async () => {
    if (!editingEntry) return;
    setServiceMapSaving(true);
    setMapError("");
    try {
      const res = await fetch(API_SVC_MAP, {
        method: "POST",
        headers: hdr(),
        body: JSON.stringify({
          serviceId: editingEntry.serviceId,
          serviceName: SERVICES_LIST.find(s => s.id === editingEntry.serviceId)?.name ?? editingEntry.serviceId,
          consumables: editingEntry.consumables.filter(c => c.productName.trim()),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = (await res.json()) as ServiceMapEntry;
      setServiceMapEntries(prev => {
        const idx = prev.findIndex(e => e.serviceId === saved.serviceId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setEditingEntry(null);
      setExpandedServiceId(saved.serviceId);
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Failed to save mapping.");
    } finally {
      setServiceMapSaving(false);
    }
  };

  // ── Delete a consumable from editing state ────────────────────────────────────
  const removeConsumable = (idx: number) => {
    if (!editingEntry) return;
    const next = editingEntry.consumables.filter((_, i) => i !== idx);
    setEditingEntry({ ...editingEntry, consumables: next });
  };

  const addConsumable = () => {
    if (!editingEntry) return;
    setEditingEntry({
      ...editingEntry,
      consumables: [...editingEntry.consumables, { productName: "", quantity: 1, unit: "ml" }],
    });
  };

  const updateConsumable = (idx: number, field: keyof ServiceConsumable, value: string | number) => {
    if (!editingEntry) return;
    const next = editingEntry.consumables.map((c, i) =>
      i === idx ? { ...c, [field]: value } : c
    );
    setEditingEntry({ ...editingEntry, consumables: next });
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchSearch =
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.brand.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase());
        const matchCat = filterCat === "all" || p.category === filterCat;
        const matchStatus =
          filterStatus === "all" || getStatus(p) === filterStatus;
        return matchSearch && matchCat && matchStatus;
      }),
    [products, search, filterCat, filterStatus]
  );

  const lowAlerts = products.filter(
    (p) =>
      getStatus(p) === "low" ||
      getStatus(p) === "critical" ||
      getStatus(p) === "out"
  );

  const totalValue = products.reduce(
    (sum, p) => sum + p.currentStock * p.costPrice,
    0
  );

  const totalPurchasedThisMonth = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return purchases
      .filter((p) => p.date.startsWith(prefix))
      .reduce((s, p) => s + p.totalCost, 0);
  }, [purchases]);

  // ── Product CRUD ──────────────────────────────────────────────────────────────
  const saveProduct = async () => {
    if (!productModal) return;
    const d = productModal.data;
    if (!d.name?.trim()) return;

    try {
      if (productModal.mode === "add") {
        const body = {
          name: d.name.trim(),
          brand: d.brand ?? "",
          category: d.category ?? "Other",
          sku: d.sku ?? "",
          unit: d.unit ?? "pcs",
          currentStock: d.currentStock ?? 0,
          lowStockThreshold: d.lowStockThreshold ?? 10,
          costPrice: d.costPrice ?? 0,
          sellingPrice: d.sellingPrice ?? 0,
          location: d.location ?? "",
          notes: d.notes ?? "",
        };
        const res = await fetch(API, {
          method: "POST",
          headers: hdr(),
          body: JSON.stringify(body),
        });
        const np = (await res.json()) as Product;
        setProducts((prev) => [np, ...prev]);
        setSelected(np);
      } else {
        const res = await fetch(`${API}/${d.id ?? ""}`, {
  method: "PUT",
  headers: hdr(),
  body: JSON.stringify(d),
});
        const updated = (await res.json()) as Product;
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        if (selected?.id === updated.id) setSelected(updated);
      }
    } catch (err) {
      console.error("Failed to save product", err);
    }
    setProductModal(null);
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm("Delete this product? All history will be lost."))
      return;
    try {
      await fetch(`${API}/${id}`, { method: "DELETE", headers: hdr() });
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setPurchases((prev) => prev.filter((p) => p.productId !== id));
      setUsageLog((prev) => prev.filter((u) => u.productId !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      console.error("Failed to delete product", err);
    }
  };

  const savePurchase = async () => {
    if (!purchaseModal) return;
    const d = purchaseModal.data;
    if (!d.quantity || !d.costPerUnit) return;
const qty = d.quantity;
const cpu = d.costPerUnit;

    try {
      const res = await fetch(`${API}/${purchaseModal.productId}/purchase`, {
        method: "POST",
        headers: hdr(),
        body: JSON.stringify({
          quantity: qty,
          costPerUnit: cpu,
          totalCost: qty * cpu,
          supplier: d.supplier ?? "",
          invoiceNo: d.invoiceNo ?? "",
          date: d.date ?? todayStr,
          notes: d.notes ?? "",
          addedBy: "Admin",
        }),
      });
      const { entry, product } = (await res.json()) as {
  entry: PurchaseEntry;
  product: Product;
};
      setPurchases((prev) => [entry, ...prev]);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
      if (selected?.id === product.id) setSelected(product);
    } catch (err) {
      console.error("Failed to save purchase", err);
    }
    setPurchaseModal(null);
  };

  const saveUsage = async () => {
    if (!usageModal) return;
    const d = usageModal.data;
    if (!d.quantity) return;
const qty = d.quantity;

    try {
      const res = await fetch(`${API}/${usageModal.productId}/usage`, {
        method: "POST",
        headers: hdr(),
        body: JSON.stringify({
          quantity: qty,
          reason: d.reason ?? "service",
          serviceRef: d.serviceRef ?? "",
          date: d.date ?? todayStr,
          notes: d.notes ?? "",
        }),
      });
      const { entry, product } = (await res.json()) as {
  entry: UsageEntry;
  product: Product;
};
      setUsageLog((prev) => [entry, ...prev]);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
      if (selected?.id === product.id) setSelected(product);
    } catch (err) {
      console.error("Failed to save usage", err);
    }
    setUsageModal(null);
  };

  const exportCSV = useCallback(() => {
    const rows = [
      [
        "SKU","Name","Brand","Category","Unit","Stock","Low Threshold",
        "Status","Cost/Unit","Sell/Unit","Stock Value","Location","Notes",
      ],
      ...products.map((p) => [
        p.sku, p.name, p.brand, p.category, p.unit, p.currentStock,
        p.lowStockThreshold, STATUS_CFG[getStatus(p)].label,
        p.costPrice, p.sellingPrice,
        (p.currentStock * p.costPrice).toFixed(2),
        p.location, p.notes,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v)}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `inventory_${todayStr}.csv`;
    a.click();
  }, [products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#f5f0e8]">
        <div className="text-[#8a7560] text-sm font-light tracking-widest uppercase">
          Loading inventory…
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500&display=swap');
        .font-cormorant { font-family: 'Cormorant Garamond', serif; }
        .font-jost { font-family: 'Jost', sans-serif; }
        body, * { font-family: 'Jost', sans-serif; }
        @keyframes inv-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes inv-slide { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes inv-spin { to { transform: rotate(360deg); } }
        .inv-overlay { animation: inv-fade .2s ease; }
        .inv-modal  { animation: inv-slide .25s ease; }
        .inv-tab-active { border-bottom: 2px solid #d4af37; color: #1a1208; }
        .inv-detail-tab-active { border-bottom: 2px solid #d4af37; color: #1a1208; }
        .inv-row-selected td:first-child { box-shadow: inset 3px 0 0 #d4af37; }
        select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238a7560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; }
        .inv-spin { width:14px;height:14px;border:2px solid rgba(212,175,55,.3);border-top-color:#d4af37;border-radius:50%;animation:inv-spin .7s linear infinite;flex-shrink:0;display:inline-block; }

        /* Service Mappings tab */
        .sm-service-row { border:1px solid #ede5d6; border-radius:10px; overflow:hidden; margin-bottom:8px; transition:box-shadow .15s; }
        .sm-service-row:hover { box-shadow:0 2px 8px rgba(26,18,8,.07); }
        .sm-service-hd { display:flex; align-items:center; gap:10px; padding:12px 16px; cursor:pointer; user-select:none; background:#fff; flex-wrap:wrap; }
        .sm-service-hd:hover { background:#fdfbf7; }
        .sm-svc-badge { font-size:10px; font-weight:500; letter-spacing:.07em; text-transform:uppercase; padding:2px 10px; border-radius:20px; background:#f5f0e8; color:#8a7560; white-space:nowrap; }
        .sm-consumable-count { font-size:11px; color:#8a7560; margin-left:auto; }
        .sm-chevron { color:#c5b89a; transition:transform .2s; }
        .sm-chevron.open { transform:rotate(90deg); }
        .sm-service-body { padding:14px 16px 16px; background:#faf8f4; border-top:1px solid #f0e8d8; animation:inv-fade .2s ease; }

        /* Consumable rows in edit */
        .sm-consumable-edit-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
        .sm-inp { height:34px; border:1px solid #e0d5c0; border-radius:7px; background:#fff; padding:0 10px; font-family:'Jost',sans-serif; font-size:12px; color:#2c1f0e; outline:none; transition:border-color .2s; }
        .sm-inp:focus { border-color:#d4af37; }
        .sm-inp-name { flex:1; min-width:120px; }
        .sm-inp-qty { width:70px; text-align:right; }
        .sm-inp-unit { width:74px; appearance:none; cursor:pointer; padding-right:24px; }
        .sm-del-btn { width:28px; height:28px; border:1px solid #ede5d6; border-radius:6px; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#c5b89a; flex-shrink:0; transition:all .15s; }
        .sm-del-btn:hover { border-color:#e74c3c; color:#e74c3c; background:#fff5f5; }
        .sm-add-row-btn { display:flex; align-items:center; gap:6px; background:none; border:1.5px dashed #d4af37; border-radius:7px; padding:6px 12px; font-family:'Jost',sans-serif; font-size:11px; font-weight:500; letter-spacing:.1em; text-transform:uppercase; color:#b8860b; cursor:pointer; transition:all .18s; margin-top:4px; }
        .sm-add-row-btn:hover { background:#fffdf5; }
        .sm-actions { display:flex; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid #e8dfc8; flex-wrap:wrap; }
        .sm-save-btn { height:32px; padding:0 16px; background:#1a1208; color:#d4af37; border:none; border-radius:7px; font-family:'Jost',sans-serif; font-size:11px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; gap:5px; transition:background .18s; }
        .sm-save-btn:hover { background:#2d2010; }
        .sm-save-btn:disabled { opacity:.5; cursor:not-allowed; }
        .sm-cancel-btn { height:32px; padding:0 14px; background:#faf8f4; color:#6b5740; border:1px solid #ede5d6; border-radius:7px; font-family:'Jost',sans-serif; font-size:11px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all .18s; }
        .sm-cancel-btn:hover { border-color:#d4af37; background:#fffdf5; }
        .sm-edit-btn { height:28px; padding:0 12px; background:none; border:1px solid #ede5d6; border-radius:6px; font-family:'Jost',sans-serif; font-size:10px; font-weight:500; letter-spacing:.1em; text-transform:uppercase; color:#6b5740; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all .15s; margin-left:auto; }
        .sm-edit-btn:hover { border-color:#d4af37; color:#b8860b; background:#fffdf5; }

        /* Read-only consumable tags */
        .sm-ctag { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:500; padding:3px 9px; border-radius:20px; background:#f5f0e8; color:#6b5740; border:1px solid #e8dfc8; margin:2px; }
        .sm-empty-note { font-size:12px; color:#c5b89a; font-style:italic; }

        .sm-error { background:#fff5f5; border:1px solid #fca5a5; border-radius:8px; padding:10px 14px; font-size:12px; color:#c0392b; display:flex; align-items:center; gap:7px; margin-bottom:12px; }
        .sm-datalist-hint { font-size:10px; color:#8a7560; margin-top:3px; padding-left:2px; }
      `}</style>

      <div className="flex flex-col h-full bg-[#f5f0e8] font-jost text-[#2c1f0e] overflow-hidden">

        {/* ── Topbar ── */}
        <header className="min-h-[60px] bg-white border-b border-[#ede5d6] flex items-center flex-wrap px-4 sm:px-7 py-2 sm:py-0 gap-2 sm:gap-3.5 shrink-0">
          <div className="font-cormorant text-[18px] sm:text-[22px] font-normal text-[#1a1208]">
            Inventory
          </div>
          <div className="ml-auto flex items-center flex-wrap gap-2 sm:gap-2.5">
            <button
              className="h-[30px] px-2.5 sm:px-3 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[#6b5740] text-[10px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center gap-1.5 hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all"
              onClick={exportCSV}
            >
              <Ic n="download" s={13} />
              <span className="hidden xs:inline">Export CSV</span>
            </button>
            <button
              className="h-9 px-3 sm:px-4 bg-[#1a1208] text-[#d4af37] border-none rounded-lg text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center gap-1.5 hover:bg-[#2d2010] transition-all"
              onClick={() =>
                { setProductModal({
                  mode: "add",
                  data: {
                    category: "Hair Care",
                    unit: "ml",
                    currentStock: 0,
                    lowStockThreshold: 10,
                    costPrice: 0,
                    sellingPrice: 0,
                  },
                }); }
              }
            >
              <Ic n="plus" s={14} />
              <span className="hidden xs:inline">Add Product</span>
            </button>
          </div>
        </header>

        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_340px] flex-1 overflow-y-auto lg:overflow-hidden">

          {/* ════ LEFT ════ */}
          <div className="overflow-y-visible lg:overflow-y-auto p-3 sm:p-5 lg:pl-7 flex flex-col gap-3 sm:gap-3.5 min-w-0">

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-white border border-[#ede5d6] rounded-xl p-3 sm:p-4 flex flex-col gap-1">
                <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8a7560]">Total Products</div>
                <div className="font-cormorant text-[22px] sm:text-[28px] font-normal text-[#1a1208] leading-none">{products.length}</div>
                <div className="text-[11px] text-[#8a7560]">{products.filter((p) => getStatus(p) === "ok").length} in stock</div>
              </div>
              <div className="bg-white border border-[#ede5d6] rounded-xl p-3 sm:p-4 flex flex-col gap-1">
                <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8a7560]">Stock Value</div>
                <div className="font-cormorant text-[18px] sm:text-[22px] font-normal text-[#1a1208] leading-none">{fmtCur(totalValue)}</div>
                <div className="text-[11px] text-[#8a7560]">At cost price</div>
              </div>
              <div className="bg-white border border-[#ede5d6] rounded-xl p-3 sm:p-4 flex flex-col gap-1">
                <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8a7560]">Low / Out</div>
                <div className={`font-cormorant text-[22px] sm:text-[28px] font-normal leading-none ${lowAlerts.length > 0 ? "text-red-600" : "text-green-700"}`}>{lowAlerts.length}</div>
                <div className="text-[11px] text-[#8a7560]">Need attention</div>
              </div>
              <div className="bg-white border border-[#ede5d6] rounded-xl p-3 sm:p-4 flex flex-col gap-1">
                <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8a7560]">Purchased (this month)</div>
                <div className="font-cormorant text-[18px] sm:text-[22px] font-normal text-[#1a1208] leading-none">{fmtCur(totalPurchasedThisMonth)}</div>
                <div className="text-[11px] text-[#8a7560]">
                  {purchases.filter((p) => p.date.startsWith(new Date().toISOString().slice(0, 7))).length} entries
                </div>
              </div>
            </div>

            {/* Main card */}
            <div className="bg-white border border-[#ede5d6] rounded-xl overflow-hidden flex-1">

              {/* Tabs */}
              <div className="flex px-3 sm:px-[18px] border-b border-[#f0e8d8] bg-white shrink-0 overflow-x-auto">
                {(
                  [
                    { id: "stock",     label: "Products",         icon: "box" },
                    { id: "purchases", label: "Purchases",        icon: "truck" },
                    { id: "usage",     label: "Usage Log",        icon: "minus" },
                    { id: "alerts",    label: "Alerts",           icon: "alert",    badge: lowAlerts.length },
                    { id: "mappings",  label: "Service Mappings", icon: "link" },
                  ] as {
                    id: typeof activeTab;
                    label: string;
                    icon: string;
                    badge?: number;
                  }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    className={`h-[42px] px-2.5 sm:px-3.5 border-none bg-transparent cursor-pointer text-[11px] font-medium tracking-[0.1em] uppercase flex items-center gap-1.5 border-b-2 border-transparent transition-all whitespace-nowrap text-[#8a7560] hover:text-[#1a1208] ${activeTab === t.id ? "inv-tab-active" : ""}`}
                    onClick={() => { setActiveTab(t.id); }}
                  >
                    <Ic n={t.icon} s={13} />
                    {t.label}
                    {t.badge ? (
                      <span className="min-w-[16px] h-4 rounded-full bg-red-600 text-white text-[9px] font-semibold flex items-center justify-center px-1">
                        {t.badge}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {/* ── Stock tab ── */}
              {activeTab === "stock" && (
                <>
                  <div className="px-3 sm:px-[18px] py-3.5 flex gap-2.5 items-center flex-wrap border-b border-[#f0e8d8]">
                    <div className="relative flex-1 min-w-[160px]">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a7560] pointer-events-none">
                        <Ic n="search" s={13} />
                      </span>
                      <input
                        className="w-full h-[34px] border border-[#ede5d6] rounded-lg bg-[#faf8f4] pl-8 pr-3 text-[13px] font-light text-[#2c1f0e] outline-none transition-colors placeholder:text-[#c5b89a] focus:border-[#d4af37]"
                        placeholder="Search name, brand, SKU…"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); }}
                      />
                    </div>
                    <select
                      className="h-[34px] border border-[#ede5d6] rounded-lg bg-[#faf8f4] pl-2.5 pr-7 text-xs text-[#2c1f0e] outline-none appearance-none cursor-pointer transition-colors focus:border-[#d4af37]"
                      value={filterCat}
                      onChange={(e) => { setFilterCat(e.target.value as ProductCategory | "all"); }}
                    >
                      <option value="all">All Categories</option>
                      {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <select
                      className="h-[34px] border border-[#ede5d6] rounded-lg bg-[#faf8f4] pl-2.5 pr-7 text-xs text-[#2c1f0e] outline-none appearance-none cursor-pointer transition-colors focus:border-[#d4af37]"
                      value={filterStatus}
                      onChange={(e) => { setFilterStatus(e.target.value as StockStatus | "all"); }}
                    >
                      <option value="all">All Status</option>
                      {(Object.entries(STATUS_CFG) as [StockStatus, (typeof STATUS_CFG)[StockStatus]][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-1 ml-auto">
                      {(["list", "grid"] as const).map((m) => (
                        <button
                          key={m}
                          className={`w-[30px] h-[30px] border rounded-lg flex items-center justify-center cursor-pointer transition-all ${viewMode === m ? "bg-[#d4af37] text-[#1a1208] border-[#d4af37]" : "border-[#ede5d6] bg-[#faf8f4] text-[#6b5740] hover:border-[#d4af37]"}`}
                          onClick={() => { setViewMode(m); }}
                        >
                          <Ic n={m} s={13} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {viewMode === "list" ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse min-w-[720px]">
                        <thead>
                          <tr>
                            {["Product","Category","Stock","Status","Cost/Unit","Value","Actions"].map((h) => (
                              <th key={h} className="bg-[#faf8f4] px-4 py-2.5 text-left text-[10px] font-medium tracking-[0.12em] uppercase text-[#8a7560] border-b border-[#ede5d6] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 && (
                            <tr><td colSpan={7} className="text-center text-[#8a7560] p-8 text-[13px]">No products found</td></tr>
                          )}
                          {filtered.map((p) => {
                            const status = getStatus(p);
                            const scfg = STATUS_CFG[status];
                            const ccfg = CAT_CFG[p.category];
                            return (
                              <tr
                                key={p.id}
                                className={`border-b border-[#f5f0e8] last:border-none cursor-pointer hover:bg-[#fdfbf7] transition-colors ${selected?.id === p.id ? "bg-[#faf5e8] inv-row-selected" : ""}`}
                                onClick={() => { setSelected(p); setDetailTab("info"); }}
                              >
                                <td className="px-4 py-[11px] text-xs text-[#2c1f0e] align-middle">
                                  <div className="font-medium text-[#1a1208] text-[13px]">{p.name}</div>
                                  <div className="text-[10px] text-[#8a7560] mt-0.5">{p.brand} · {p.sku}</div>
                                </td>
                                <td className="px-4 py-[11px] text-xs text-[#2c1f0e] align-middle">
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${ccfg.tw} ${ccfg.twBg}`}>{ccfg.icon} {p.category}</span>
                                </td>
                                <td className="px-4 py-[11px] text-xs text-[#2c1f0e] align-middle min-w-[130px]">
                                  <StockBar product={p} />
                                  <div className="text-[10px] text-[#8a7560] mt-0.5">{p.currentStock} {p.unit} · min {p.lowStockThreshold}</div>
                                </td>
                                <td className="px-4 py-[11px] text-xs text-[#2c1f0e] align-middle">
                                  <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap border tracking-[0.04em]" style={{ background: scfg.bg, color: scfg.color, borderColor: scfg.border }}>{scfg.label}</span>
                                </td>
                                <td className="px-4 py-[11px] text-xs text-[#6b5740] align-middle">₹{p.costPrice}/{p.unit}</td>
                                <td className="px-4 py-[11px] text-xs text-[#b8860b] font-medium align-middle">{fmtCur(p.currentStock * p.costPrice)}</td>
                                <td className="px-4 py-[11px] text-xs text-[#2c1f0e] align-middle">
                                  <div className="flex gap-1.5">
                                    <button className="w-[30px] h-[30px] border border-green-300 rounded-[7px] bg-[#faf8f4] flex items-center justify-center text-green-700 cursor-pointer hover:border-[#d4af37] transition-all" title="Add Purchase" onClick={(e) => { e.stopPropagation(); setPurchaseModal({ productId: p.id, data: { date: todayStr, costPerUnit: p.costPrice } }); }}><Ic n="truck" s={12} /></button>
                                    <button className="w-[30px] h-[30px] border border-yellow-300 rounded-[7px] bg-[#faf8f4] flex items-center justify-center text-amber-700 cursor-pointer hover:border-[#d4af37] transition-all" title="Log Usage" onClick={(e) => { e.stopPropagation(); setUsageModal({ productId: p.id, data: { date: todayStr, reason: "service", quantity: 1 } }); }}><Ic n="minus" s={12} /></button>
                                    <button className="w-[30px] h-[30px] border border-[#ede5d6] rounded-[7px] bg-[#faf8f4] flex items-center justify-center text-[#6b5740] cursor-pointer hover:border-[#d4af37] hover:text-[#b8860b] transition-all" title="Edit" onClick={(e) => { e.stopPropagation(); setProductModal({ mode: "edit", data: { ...p } }); }}><Ic n="edit" s={12} /></button>
                                    <button className="w-[30px] h-[30px] border border-[#ede5d6] rounded-[7px] bg-[#faf8f4] flex items-center justify-center text-[#6b5740] cursor-pointer hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Delete" onClick={(e) => { e.stopPropagation(); void deleteProduct(p.id); }}><Ic n="trash" s={12} /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 sm:p-[18px] grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                      {filtered.map((p) => {
                        const status = getStatus(p);
                        const scfg = STATUS_CFG[status];
                        const ccfg = CAT_CFG[p.category];
                        return (
                          <div key={p.id} onClick={() => { setSelected(p); setDetailTab("info"); }} className={`bg-white rounded-xl p-3.5 cursor-pointer transition-all ${selected?.id === p.id ? "border-2 border-[#1a1208]" : "border border-[#ede5d6]"}`}>
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${ccfg.tw} ${ccfg.twBg}`}>{ccfg.icon} {p.category}</span>
                              <span className="text-[9px] font-medium px-2.5 py-0.5 rounded-full border tracking-[0.04em]" style={{ background: scfg.bg, color: scfg.color, borderColor: scfg.border }}>{scfg.label}</span>
                            </div>
                            <div className="text-[13px] font-medium text-[#1a1208] mb-0.5 leading-snug">{p.name}</div>
                            <div className="text-[10px] text-[#8a7560] mb-2.5">{p.brand}</div>
                            <StockBar product={p} />
                            <div className="text-[10px] text-[#8a7560] mt-1">{p.currentStock} {p.unit} · min {p.lowStockThreshold}</div>
                            <div className="text-[11px] text-[#b8860b] font-medium mt-1.5">{fmtCur(p.currentStock * p.costPrice)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* ── Purchases tab ── */}
              {activeTab === "purchases" && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[720px]">
                    <thead>
                      <tr>{["Date","Product","Qty","Cost/Unit","Total","Supplier","Invoice","Notes"].map((h) => (<th key={h} className="bg-[#faf8f4] px-4 py-2.5 text-left text-[10px] font-medium tracking-[0.12em] uppercase text-[#8a7560] border-b border-[#ede5d6] whitespace-nowrap">{h}</th>))}</tr>
                    </thead>
                    <tbody>
                      {purchases.length === 0 && (<tr><td colSpan={8} className="text-center text-[#8a7560] p-8 text-[13px]">No purchase entries yet</td></tr>)}
                      {purchases.map((entry) => {
                        const prod = products.find((p) => p.id === entry.productId);
                        return (
                          <tr key={entry.id} className="border-b border-[#f5f0e8] last:border-none">
                            <td className="px-4 py-[11px] text-xs text-[#2c1f0e] whitespace-nowrap">{fmtDate(entry.date)}</td>
                            <td className="px-4 py-[11px] text-xs text-[#2c1f0e]"><div className="font-medium text-[12px]">{prod?.name ?? "—"}</div><div className="text-[10px] text-[#8a7560]">{prod?.brand}</div></td>
                            <td className="px-4 py-[11px] text-xs text-green-700 font-semibold">+{entry.quantity} {prod?.unit}</td>
                            <td className="px-4 py-[11px] text-xs text-[#6b5740]">₹{entry.costPerUnit}</td>
                            <td className="px-4 py-[11px] text-xs text-[#b8860b] font-medium">{fmtCur(entry.totalCost)}</td>
                            <td className="px-4 py-[11px] text-xs text-[#6b5740]">{entry.supplier || "—"}</td>
                            <td className="px-4 py-[11px] text-[11px] text-[#8a7560]">{entry.invoiceNo || "—"}</td>
                            <td className="px-4 py-[11px] text-[11px] text-[#8a7560]">{entry.notes || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Usage log tab ── */}
              {activeTab === "usage" && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[640px]">
                    <thead>
                      <tr>{["Date","Product","Qty Used","Reason","Service Ref","Notes"].map((h) => (<th key={h} className="bg-[#faf8f4] px-4 py-2.5 text-left text-[10px] font-medium tracking-[0.12em] uppercase text-[#8a7560] border-b border-[#ede5d6] whitespace-nowrap">{h}</th>))}</tr>
                    </thead>
                    <tbody>
                      {usageLog.length === 0 && (<tr><td colSpan={6} className="text-center text-[#8a7560] p-8 text-[13px]">No usage entries yet</td></tr>)}
                      {usageLog.map((entry) => {
                        const prod = products.find((p) => p.id === entry.productId);
                        return (
                          <tr key={entry.id} className="border-b border-[#f5f0e8] last:border-none">
                            <td className="px-4 py-[11px] text-xs text-[#2c1f0e] whitespace-nowrap">{fmtDate(entry.date)}</td>
                            <td className="px-4 py-[11px] text-xs text-[#2c1f0e]"><div className="font-medium text-[12px]">{prod?.name ?? "—"}</div><div className="text-[10px] text-[#8a7560]">{prod?.brand}</div></td>
                            <td className="px-4 py-[11px] text-xs text-red-600 font-semibold">−{entry.quantity} {prod?.unit}</td>
                            <td className="px-4 py-[11px] text-xs text-[#2c1f0e]"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${entry.reason === "service" ? "bg-green-50 text-green-700" : entry.reason === "damaged" ? "bg-red-50 text-red-700" : "bg-[#faf8f4] text-[#6b5740]"}`}>{entry.reason}</span></td>
                            <td className="px-4 py-[11px] text-[11px] text-[#8a7560]">{entry.serviceRef || "—"}</td>
                            <td className="px-4 py-[11px] text-[11px] text-[#8a7560]">{entry.notes || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Alerts tab ── */}
              {activeTab === "alerts" && (
                <div>
                  {lowAlerts.length === 0 ? (
                    <div className="p-10 text-center text-[#8a7560] text-[13px]">✓ All products are sufficiently stocked.</div>
                  ) : (
                    lowAlerts.map((p) => {
                      const status = getStatus(p);
                      const scfg = STATUS_CFG[status];
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-3 sm:px-[18px] py-3 border-b border-[#f5f0e8] last:border-none cursor-pointer hover:bg-[#fdfbf7] transition-colors flex-wrap" onClick={() => { setSelected(p); setActiveTab("stock"); setDetailTab("info"); }}>
                          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: scfg.bg, color: scfg.color }}><Ic n="alert" s={16} /></div>
                          <div className="flex-1 min-w-[140px]">
                            <div className="font-medium text-[13px] text-[#1a1208]">{p.name}</div>
                            <div className="text-[11px] text-[#8a7560] mt-0.5">{p.brand} · {p.category}</div>
                            <div className="mt-1.5"><StockBar product={p} /></div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full border tracking-[0.04em]" style={{ background: scfg.bg, color: scfg.color, borderColor: scfg.border }}>{scfg.label}</span>
                            <div className="text-[10px] text-[#8a7560] mt-1">{p.currentStock} / {p.lowStockThreshold} {p.unit} min</div>
                          </div>
                          <button className="ml-0 sm:ml-2 h-[30px] px-3 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[#6b5740] text-[10px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center gap-1.5 hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all shrink-0" onClick={(e) => { e.stopPropagation(); setPurchaseModal({ productId: p.id, data: { date: todayStr, costPerUnit: p.costPrice } }); }}><Ic n="truck" s={12} />Restock</button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── Service Mappings tab ── */}
              {activeTab === "mappings" && (
                <div className="p-3 sm:p-[18px]">

                  {/* Header row */}
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <div className="text-[13px] font-medium text-[#1a1208]">Service → Product Mappings</div>
                      <div className="text-[11px] text-[#8a7560] mt-0.5">
                        Define which products are consumed when each service is billed. Changes take effect immediately.
                      </div>
                    </div>
                    <button
                      className="h-[30px] px-3 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[#6b5740] text-[10px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center gap-1.5 hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all"
                      onClick={() => void loadServiceMap()}
                      disabled={serviceMapLoading}
                    >
                      {serviceMapLoading ? <span className="inv-spin"/> : <Ic n="refresh" s={12} />}
                      Refresh
                    </button>
                  </div>

                  {/* Error banner */}
                  {mapError && (
                    <div className="sm-error">
                      <Ic n="alert" s={13}/>{mapError}
                      <button style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"#c0392b" }} onClick={() => { setMapError(""); }}><Ic n="x" s={13}/></button>
                    </div>
                  )}

                  {serviceMapLoading ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-[#8a7560] text-[12px]">
                      <span className="inv-spin"/>Loading mappings…
                    </div>
                  ) : (
                    <>
                      {/* Datalist for product autocomplete */}
                      <datalist id="sm-products-list">
                        {products.map(p => <option key={p.id} value={p.name}/>)}
                      </datalist>

                      {SERVICES_LIST.map(svc => {
                        const entry = serviceMapEntries.find(e => e.serviceId === svc.id);
                        const isExpanded = expandedServiceId === svc.id;
                        const isEditing = editingEntry?.serviceId === svc.id;
                        const consumables = entry?.consumables ?? [];

                        return (
                          <div key={svc.id} className="sm-service-row">
                            {/* Service header */}
                            <div
                              className="sm-service-hd"
                              onClick={() => {
                                if (isEditing) return; // don't collapse while editing
                                setExpandedServiceId(isExpanded ? null : svc.id);
                              }}
                            >
                              <span className="sm-svc-badge">{svc.id}</span>
                              <span style={{ fontSize:13, fontWeight:500, color:"#1a1208" }}>{svc.name}</span>
                              <span className="sm-consumable-count">
                                {consumables.length === 0
                                  ? <span style={{ color:"#e2a84b" }}>Not mapped</span>
                                  : `${String(consumables.length)} product${consumables.length !== 1 ? "s" : ""}`}
                              </span>

                              {/* Edit button — only show when not already editing */}
                              {!isEditing && (
                                <button
                                  className="sm-edit-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedServiceId(svc.id);
                                    setEditingEntry({
                                      serviceId: svc.id,
                                      consumables: consumables.length > 0
                                        ? consumables.map(c => ({ ...c }))
                                        : [{ productName: "", quantity: 1, unit: "ml" }],
                                    });
                                  }}
                                >
                                  <Ic n="edit" s={11}/>Edit
                                </button>
                              )}

                              <span className={`sm-chevron${isExpanded || isEditing ? " open" : ""}`} style={{ marginLeft: isEditing ? 0 : undefined }}>
                                <Ic n="chevR" s={14}/>
                              </span>
                            </div>

                            {/* Expanded read view */}
                            {isExpanded && !isEditing && (
                              <div className="sm-service-body">
                                {consumables.length === 0 ? (
                                  <div className="sm-empty-note">No products mapped yet — click Edit to add some.</div>
                                ) : (
                                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                                    {consumables.map((c, i) => (
                                      <span key={i} className="sm-ctag">
                                        <Ic n="box" s={9}/>
                                        {c.quantity}{c.unit} {c.productName}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Edit form */}
                            {isEditing && (
  <div className="sm-service-body">
                                <div style={{ fontSize:10, fontWeight:500, letterSpacing:".14em", textTransform:"uppercase", color:"#8a7560", marginBottom:10 }}>
                                  Products consumed per billing
                                </div>

                                {editingEntry.consumables.map((c, idx) => (
                                  <div key={idx} className="sm-consumable-edit-row">
                                    <input
                                      className="sm-inp sm-inp-name"
                                      list="sm-products-list"
                                      placeholder="Product name…"
                                      value={c.productName}
                                      onChange={e => { updateConsumable(idx, "productName", e.target.value); }}
                                    />
                                    <input
                                      className="sm-inp sm-inp-qty"
                                      type="number"
                                      min={0.1}
                                      step={0.5}
                                      placeholder="Qty"
                                      value={c.quantity}
                                      onChange={e => { updateConsumable(idx, "quantity", Number(e.target.value)); }}
                                    />
                                    <select
                                      className="sm-inp sm-inp-unit"
                                      value={c.unit}
                                      onChange={e => { updateConsumable(idx, "unit", e.target.value); }}
                                    >
                                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    <button className="sm-del-btn" onClick={() => { removeConsumable(idx); }}>
                                      <Ic n="x" s={11}/>
                                    </button>
                                  </div>
                                ))}

                                <div className="sm-datalist-hint">
                                  Tip: start typing a product name — your inventory products will appear as suggestions.
                                </div>

                                <button className="sm-add-row-btn" onClick={addConsumable}>
                                  <Ic n="plus" s={12}/>Add product
                                </button>

                                <div className="sm-actions">
                                  <button
                                    className="sm-save-btn"
                                    disabled={serviceMapSaving}
                                    onClick={() => void saveServiceMapping()}
                                  >
                                    {serviceMapSaving
                                      ? <><span className="inv-spin"/>Saving…</>
                                      : <><Ic n="check" s={12}/>Save mapping</>
                                    }
                                  </button>
                                  <button
                                    className="sm-cancel-btn"
                                    onClick={() => { setEditingEntry(null); }}
                                  >
                                    <Ic n="x" s={11}/>Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
          {/* end left */}

          {/* ════ RIGHT PANEL ════ */}
          <div className="bg-white border-t lg:border-t-0 lg:border-l border-[#ede5d6] flex flex-col overflow-hidden min-h-[260px] lg:min-h-0">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#8a7560] p-5 text-center">
                <div className="opacity-15"><Ic n="box" s={56} /></div>
                <div className="font-cormorant text-[20px] font-light">Select a product</div>
                <div className="text-[12px] font-light">Click any product to view details</div>
              </div>
            ) : (
              (() => {
                const status = getStatus(selected);
                const scfg = STATUS_CFG[status];
                const pctVal = stockPct(selected);
                const prodPurchases = purchases.filter((p) => p.productId === selected.id);
                const prodUsage = usageLog.filter((u) => u.productId === selected.id);
                return (
                  <>
                    <div className="px-5 pt-[18px] pb-3.5 border-b border-[#f0e8d8] shrink-0">
                      <div className="font-cormorant text-[20px] font-normal text-[#1a1208]">{selected.name}</div>
                      <div className="text-[11px] text-[#8a7560] mt-0.5">{selected.brand} · {selected.sku}</div>
                    </div>

                    <div className="flex border-b border-[#f0e8d8] shrink-0">
                      {(["info", "history"] as const).map((t) => (
                        <button key={t} className={`flex-1 h-[38px] border-none bg-transparent cursor-pointer text-[10px] font-medium tracking-[0.1em] uppercase border-b-2 border-transparent transition-all text-[#8a7560] hover:text-[#1a1208] ${detailTab === t ? "inv-detail-tab-active" : ""}`} onClick={() => { setDetailTab(t); }}>
                          {t === "info" ? "Details" : "History"}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      {detailTab === "info" && (
                        <>
                          <div className="rounded-xl p-[18px] mb-3.5 text-[#d4af37] bg-gradient-to-br from-[#1a1208] to-[#2d2010]">
                            <div className="text-[11px] opacity-65 tracking-[0.12em] uppercase">Current Stock</div>
                            <div className="flex items-baseline gap-2">
                              <div className="font-cormorant text-[48px] font-light leading-none">{selected.currentStock}</div>
                              <div className="text-[14px] opacity-65">{selected.unit}</div>
                            </div>
                            <div className="bg-white/15 rounded-full h-1.5 my-3">
                              <div className="h-1.5 rounded-full bg-[#d4af37] transition-[width] duration-300 ease-in-out" style={{ width: `${pctVal.toString()}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] opacity-60">
                              <span>0</span>
                              <span>Min: {selected.lowStockThreshold} {selected.unit}</span>
                            </div>
                            <div className="mt-3 inline-block">
                              <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full border tracking-[0.04em]" style={{ background: scfg.bg, color: scfg.color, borderColor: scfg.border }}>{scfg.label}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <button className="h-9 px-4 border border-green-300 rounded-lg bg-white text-green-700 text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center justify-center gap-1.5 hover:bg-green-50 transition-all" onClick={() => { setPurchaseModal({ productId: selected.id, data: { date: todayStr, costPerUnit: selected.costPrice } }); }}><Ic n="truck" s={13} />Add Purchase</button>
                            <button className="h-9 px-4 border border-yellow-300 rounded-lg bg-white text-amber-700 text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center justify-center gap-1.5 hover:bg-amber-50 transition-all" onClick={() => { setUsageModal({ productId: selected.id, data: { date: todayStr, reason: "service", quantity: 1 } }); }}><Ic n="minus" s={13} />Log Usage</button>
                          </div>

                          {[
                            { label: "Category", value: (<span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CAT_CFG[selected.category].tw} ${CAT_CFG[selected.category].twBg}`}>{CAT_CFG[selected.category].icon} {selected.category}</span>) },
                            { label: "Unit", value: selected.unit },
                           { label: "Low Threshold", value: `${selected.lowStockThreshold.toString()} ${selected.unit}` },
{ label: "Cost Price", value: `₹${selected.costPrice.toString()}/${selected.unit}` },
{ label: "Sell Price", value: selected.sellingPrice > 0 ? `₹${selected.sellingPrice.toString()}/${selected.unit}` : "—" },
                            { label: "Stock Value", value: (<span className="text-[#b8860b] font-medium">{fmtCur(selected.currentStock * selected.costPrice)}</span>) },
                            { label: "Location", value: selected.location || "—" },
                            ...(selected.notes ? [{ label: "Notes", value: selected.notes }] : []),
                            { label: "Added On", value: fmtDate(selected.createdAt) },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex gap-2.5 mb-[9px] items-start">
                              <span className="text-[11px] text-[#8a7560] min-w-[100px] shrink-0 pt-px">{label}</span>
                              <span className="text-[13px] text-[#1a1208]">{value}</span>
                            </div>
                          ))}
                        </>
                      )}

                      {detailTab === "history" && (
                        <>
                          {prodPurchases.length + prodUsage.length === 0 && (
                            <div className="text-[#8a7560] text-[13px] text-center py-5">No history yet.</div>
                          )}
                          {[
                            ...prodPurchases.map((e) => ({ type: "purchase" as const, date: e.date, qty: e.quantity, label: `Purchased from ${e.supplier || "supplier"}`,sub: `Invoice: ${e.invoiceNo || "—"} · ₹${e.costPerUnit.toString()}/unit`, id: e.id })),
                            ...prodUsage.map((e) => ({ type: "usage" as const, date: e.date, qty: -e.quantity, label: `Used — ${e.reason}`, sub: e.serviceRef ? `Ref: ${e.serviceRef}` : e.notes || "", id: e.id })),
                          ]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((item) => (
                              <div key={item.id} className="py-2.5 border-b border-[#f5f0e8] last:border-none flex gap-2.5 items-start">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold mt-0.5 ${item.type === "purchase" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{item.type === "purchase" ? "+" : "−"}</div>
                                <div className="flex-1">
                                  <div className="text-[12px] font-medium text-[#1a1208]">{item.label}</div>
                                  {item.sub && <div className="text-[10px] text-[#8a7560] mt-0.5">{item.sub}</div>}
                                  <div className="text-[10px] text-[#8a7560] mt-0.5">{fmtDate(item.date)}</div>
                                </div>
                                <div className={`text-[13px] font-semibold min-w-[40px] text-right ${item.qty > 0 ? "text-green-700" : "text-red-600"}`}>{item.qty > 0 ? "+" : ""}{item.qty} {selected.unit}</div>
                              </div>
                            ))}
                        </>
                      )}
                    </div>

                    <div className="px-5 py-3.5 border-t border-[#f0e8d8] flex gap-2 shrink-0">
                      <button className="flex-1 h-9 px-4 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[#6b5740] text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center justify-center gap-1.5 hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all" onClick={() => { setProductModal({ mode: "edit", data: { ...selected } }); }}><Ic n="edit" s={13} />Edit</button>
                      <button className="w-[30px] h-[30px] border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] cursor-pointer hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0" onClick={() => void deleteProduct(selected.id)} title="Delete product"><Ic n="trash" s={13} /></button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* ════ Add/Edit Product Modal ════ */}
      {productModal && (
        <div className="inv-overlay fixed inset-0 bg-[rgba(26,18,8,0.5)] flex items-center justify-center z-[200] p-3 sm:p-5" onClick={() => { setProductModal(null); }}>
          <div className="inv-modal bg-white rounded-2xl w-full max-w-[520px] max-h-[92vh] overflow-y-auto shadow-[0_20px_60px_rgba(26,18,8,0.25)]" onClick={(e) => { e.stopPropagation(); }}>
            <div className="px-4 sm:px-6 pt-5 pb-3.5 flex items-center justify-between border-b border-[#f0e8d8] sticky top-0 bg-white z-10">
              <div className="font-cormorant text-[20px] sm:text-[22px] font-normal text-[#1a1208]">{productModal.mode === "add" ? "Add Product" : "Edit Product"}</div>
              <button className="w-[30px] h-[30px] border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] cursor-pointer hover:border-[#d4af37] hover:text-[#b8860b] transition-all" onClick={() => { setProductModal(null); }}><Ic n="x" s={14} /></button>
            </div>
            <div className="px-4 sm:px-6 py-[18px] flex flex-col gap-[13px]">
              {[
                { label: "Product Name *", field: "name", placeholder: "e.g. Wella Koleston Perfect", type: "text" },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">{label}</div>
                  <input className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder={placeholder} value={(productModal.data as Record<string, string | undefined>)[field] ?? ""}onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, [field]: e.target.value } } : m); }} />
                </div>
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Brand</div>
                  <input className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="Brand name" value={productModal.data.brand ?? ""} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, brand: e.target.value } } : m); }} />
                </div>
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">SKU</div>
                  <input className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="e.g. WKP-60ML" value={productModal.data.sku ?? ""} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, sku: e.target.value } } : m); }} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Category</div>
                  <select className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white pl-3 pr-7 text-[13px] text-[#2c1f0e] outline-none w-full appearance-none cursor-pointer transition-colors focus:border-[#d4af37]" value={productModal.data.category ?? "Other"} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, category: e.target.value as ProductCategory } } : m); }}>
                    {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Unit</div>
                  <select className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white pl-3 pr-7 text-[13px] text-[#2c1f0e] outline-none w-full appearance-none cursor-pointer transition-colors focus:border-[#d4af37]" value={productModal.data.unit ?? "pcs"} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, unit: e.target.value } } : m); }}>
                    {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Current Stock</div>
                  <input type="number" min={0} className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="0" value={productModal.data.currentStock ?? ""} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, currentStock: Number(e.target.value) } } : m); }} />
                </div>
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Low Stock Alert At</div>
                  <input type="number" min={0} className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="10" value={productModal.data.lowStockThreshold ?? ""} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, lowStockThreshold: Number(e.target.value) } } : m); }} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Cost Price (₹/unit)</div>
                  <input type="number" min={0} step={0.01} className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="0" value={productModal.data.costPrice ?? ""} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, costPrice: Number(e.target.value) } } : m); }} />
                </div>
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Sell Price (₹/unit)</div>
                  <input type="number" min={0} step={0.01} className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="0" value={productModal.data.sellingPrice ?? ""} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, sellingPrice: Number(e.target.value) } } : m); }} />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Storage Location</div>
                <input className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="e.g. Shelf A1, Store Room" value={productModal.data.location ?? ""} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, location: e.target.value } } : m); }} />
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Notes</div>
                <textarea className="border border-[#e0d5c0] rounded-lg bg-white px-3 py-2.5 text-[13px] text-[#2c1f0e] outline-none w-full min-h-16 resize-y transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="Allergies, usage instructions, reorder notes…" value={productModal.data.notes ?? ""} onChange={(e) => { setProductModal((m) => m ? { ...m, data: { ...m.data, notes: e.target.value } } : m); }} />
              </div>
            </div>
            <div className="flex gap-2 px-4 sm:px-6 pb-5">
              <button className="flex-1 h-9 px-4 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[#6b5740] text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center justify-center gap-1.5 hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all" onClick={() => { setProductModal(null); }}>Cancel</button>
              <button className="flex-1 h-9 px-4 bg-[#1a1208] text-[#d4af37] border-none rounded-lg text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center justify-center gap-1.5 hover:bg-[#2d2010] transition-all" onClick={() => void saveProduct()}><Ic n="check" s={13} />{productModal.mode === "add" ? "Add Product" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ Purchase Entry Modal ════ */}
      {purchaseModal && (
        <div className="inv-overlay fixed inset-0 bg-[rgba(26,18,8,0.5)] flex items-center justify-center z-[200] p-3 sm:p-5" onClick={() => { setPurchaseModal(null); }}>
          <div className="inv-modal bg-white rounded-2xl w-full max-w-[520px] max-h-[92vh] overflow-y-auto shadow-[0_20px_60px_rgba(26,18,8,0.25)]" onClick={(e) => { e.stopPropagation(); }}>
            <div className="px-4 sm:px-6 pt-5 pb-3.5 flex items-center justify-between border-b border-[#f0e8d8] sticky top-0 bg-white z-10">
              <div>
                <div className="font-cormorant text-[20px] sm:text-[22px] font-normal text-[#1a1208]">Add Purchase Entry</div>
                <div className="text-[12px] text-[#8a7560] mt-0.5">{products.find((p) => p.id === purchaseModal.productId)?.name}</div>
              </div>
              <button className="w-[30px] h-[30px] border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] cursor-pointer hover:border-[#d4af37] hover:text-[#b8860b] transition-all" onClick={() => { setPurchaseModal(null); }}><Ic n="x" s={14} /></button>
            </div>
            <div className="px-4 sm:px-6 py-[18px] flex flex-col gap-[13px]">
              <div className="bg-green-50 border border-green-300 rounded-lg px-3.5 py-2.5 text-[12px] text-green-700 font-medium">↑ Stock will increase by the quantity entered</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Quantity *</div>
                  <input type="number" min={1} className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="0" value={purchaseModal.data.quantity ?? ""} onChange={(e) => { setPurchaseModal((m) => m ? { ...m, data: { ...m.data, quantity: Number(e.target.value) } } : m); }} />
                </div>
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Cost Per Unit (₹) *</div>
                  <input type="number" min={0} step={0.01} className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="0" value={purchaseModal.data.costPerUnit ?? ""} onChange={(e) => { setPurchaseModal((m) => m ? { ...m, data: { ...m.data, costPerUnit: Number(e.target.value) } } : m); }} />
                </div>
              </div>
              {purchaseModal.data.quantity && purchaseModal.data.costPerUnit && (
  <div className="bg-[#faf8f4] border border-[#ede5d6] rounded-lg px-3.5 py-2.5 flex justify-between items-center">
    <span className="text-[12px] text-[#6b5740]">Total Cost</span>
    <span className="font-cormorant text-[22px] text-[#b8860b] font-semibold">{fmtCur(purchaseModal.data.quantity * purchaseModal.data.costPerUnit)}</span>
  </div>
)}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Supplier</div>
                  <input className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="Supplier name" value={purchaseModal.data.supplier ?? ""} onChange={(e) => { setPurchaseModal((m) => m ? { ...m, data: { ...m.data, supplier: e.target.value } } : m); }} />
                </div>
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Invoice No</div>
                  <input className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="Invoice #" value={purchaseModal.data.invoiceNo ?? ""} onChange={(e) => { setPurchaseModal((m) => m ? { ...m, data: { ...m.data, invoiceNo: e.target.value } } : m); }} />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Purchase Date</div>
                <input type="date" className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37]" value={purchaseModal.data.date ?? todayStr} onChange={(e) => { setPurchaseModal((m) => m ? { ...m, data: { ...m.data, date: e.target.value } } : m); }} />
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Notes</div>
                <textarea className="border border-[#e0d5c0] rounded-lg bg-white px-3 py-2.5 text-[13px] text-[#2c1f0e] outline-none w-full min-h-16 resize-y transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="Optional notes…" value={purchaseModal.data.notes ?? ""} onChange={(e) => { setPurchaseModal((m) => m ? { ...m, data: { ...m.data, notes: e.target.value } } : m); }} />
              </div>
            </div>
            <div className="flex gap-2 px-4 sm:px-6 pb-5">
              <button className="flex-1 h-9 px-4 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[#6b5740] text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center justify-center gap-1.5 hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all" onClick={() => { setPurchaseModal(null); }}>Cancel</button>
              <button className="flex-1 h-9 px-4 bg-[#1a1208] text-[#d4af37] border-none rounded-lg text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center justify-center gap-1.5 hover:bg-[#2d2010] transition-all" onClick={() => void savePurchase()}><Ic n="truck" s={13} />Add Stock</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ Usage Entry Modal ════ */}
      {usageModal && (
        <div className="inv-overlay fixed inset-0 bg-[rgba(26,18,8,0.5)] flex items-center justify-center z-[200] p-3 sm:p-5" onClick={() => { setUsageModal(null); }}>
          <div className="inv-modal bg-white rounded-2xl w-full max-w-[520px] max-h-[92vh] overflow-y-auto shadow-[0_20px_60px_rgba(26,18,8,0.25)]" onClick={(e) => { e.stopPropagation(); }}>
            <div className="px-4 sm:px-6 pt-5 pb-3.5 flex items-center justify-between border-b border-[#f0e8d8] sticky top-0 bg-white z-10">
              <div>
                <div className="font-cormorant text-[20px] sm:text-[22px] font-normal text-[#1a1208]">Log Usage / Deduction</div>
                <div className="text-[12px] text-[#8a7560] mt-0.5">
                  {products.find((p) => p.id === usageModal.productId)?.name}
                  {" · "}
                  <strong className="text-[#1a1208]">{products.find((p) => p.id === usageModal.productId)?.currentStock} {products.find((p) => p.id === usageModal.productId)?.unit} in stock</strong>
                </div>
              </div>
              <button className="w-[30px] h-[30px] border border-[#ede5d6] rounded-lg bg-[#faf8f4] flex items-center justify-center text-[#6b5740] cursor-pointer hover:border-[#d4af37] hover:text-[#b8860b] transition-all" onClick={() => { setUsageModal(null); }}><Ic n="x" s={14} /></button>
            </div>
            <div className="px-4 sm:px-6 py-[18px] flex flex-col gap-[13px]">
              <div className="bg-red-50 border border-red-300 rounded-lg px-3.5 py-2.5 text-[12px] text-red-600 font-medium">↓ Stock will decrease by the quantity entered</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Quantity Used *</div>
                  <input type="number" min={1} className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="0" value={usageModal.data.quantity ?? ""} onChange={(e) => { setUsageModal((m) => m ? { ...m, data: { ...m.data, quantity: Number(e.target.value) } } : m); }} />
                </div>
                <div>
                  <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Reason</div>
                  <select className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white pl-3 pr-7 text-[13px] text-[#2c1f0e] outline-none w-full appearance-none cursor-pointer transition-colors focus:border-[#d4af37]" value={usageModal.data.reason ?? "service"} onChange={(e) => { setUsageModal((m) => m ? { ...m, data: { ...m.data, reason: e.target.value } } : m); }}>
                    {REASONS.map((r) => (<option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Date</div>
                <input type="date" className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37]" value={usageModal.data.date ?? todayStr} onChange={(e) => { setUsageModal((m) => m ? { ...m, data: { ...m.data, date: e.target.value } } : m); }} />
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Service Reference (optional)</div>
                <input className="h-[38px] border border-[#e0d5c0] rounded-lg bg-white px-3 text-[13px] text-[#2c1f0e] outline-none w-full transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="e.g. Booking #1234, Customer name" value={usageModal.data.serviceRef ?? ""} onChange={(e) => { setUsageModal((m) => m ? { ...m, data: { ...m.data, serviceRef: e.target.value } } : m); }} />
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#6b5740] mb-1.5">Notes</div>
                <textarea className="border border-[#e0d5c0] rounded-lg bg-white px-3 py-2.5 text-[13px] text-[#2c1f0e] outline-none w-full min-h-16 resize-y transition-colors focus:border-[#d4af37] placeholder:text-[#c5b89a]" placeholder="Optional notes…" value={usageModal.data.notes ?? ""} onChange={(e) => { setUsageModal((m) => m ? { ...m, data: { ...m.data, notes: e.target.value } } : m); }} />
              </div>
            </div>
            <div className="flex gap-2 px-4 sm:px-6 pb-5">
              <button className="flex-1 h-9 px-4 border border-[#ede5d6] rounded-lg bg-[#faf8f4] text-[#6b5740] text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center justify-center gap-1.5 hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all" onClick={() => { setUsageModal(null); }}>Cancel</button>
              <button className="flex-1 h-9 px-4 bg-[#1a1208] text-[#d4af37] border-none rounded-lg text-[11px] font-medium tracking-[0.14em] uppercase cursor-pointer flex items-center justify-center gap-1.5 hover:bg-[#2d2010] transition-all" onClick={() => void saveUsage()}><Ic n="minus" s={13} />Deduct Stock</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}