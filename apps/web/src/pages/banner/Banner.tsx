import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ImageIcon,
  Tag,
  Megaphone,
  ChevronDown,
  X,
  Check,
  AlertCircle,
  Layers,
  Percent,
  Loader2,
  Upload,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type BannerType   = "hero" | "offer" | "combo";
type BannerStatus = "active" | "inactive" | "scheduled";

interface Banner {
  _id:        string;   // MongoDB _id from API
  type:       BannerType;
  title:      string;
  subtitle:   string;
  badge:      string;
  cta:        string;
  discount?:  string;
  targetPage: string;
  imageUrl:   string;
  status:     BannerStatus;
  startDate:  string;
  endDate:    string;
  order:      number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/banners`;

// Must match the key AuthContext.tsx uses: localStorage.setItem(TOKEN_KEY, JSON.stringify(data))
const TOKEN_KEY = "velvet_token";

// AuthContext stores a JSON-stringified AuthUser object ({ id, name, email, role, token }),
// not a raw JWT string — so we have to parse it and pull out the .token field.
function getAuthToken(): string | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is intentionally inferred at each call site (apiFetch<Banner>, apiFetch<Banner[]>, etc.)
async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ success: true; data: T } | { success: false; message: string }> {
  try {
    const token = getAuthToken();

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
    const json = (await res.json()) as ApiEnvelope<T>;
    if (!res.ok) {
      return { success: false, message: json.message ?? "Request failed" };
    }
    return { success: true, data: json.data as T };
  } catch {
    return { success: false, message: "Network error. Please try again." };
  }
}

// ── Cloudinary unsigned upload — lets the user pick a photo from their
// device (laptop file browser or mobile gallery/camera) instead of pasting
// a URL. Uploads directly from the browser to Cloudinary; no backend hop
// needed since the preset is unsigned. ──────────────────────────────────
const CLOUDINARY_CLOUD_NAME  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

async function uploadImageToCloudinary(file: File): Promise<{ success: true; url: string } | { success: false; message: string }> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    return { success: false, message: "Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET." };
  }
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData,
    });
    const json = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !json.secure_url) {
      return { success: false, message: json.error?.message ?? "Image upload failed." };
    }
    return { success: true, url: json.secure_url };
  } catch {
    return { success: false, message: "Network error while uploading image." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<BannerType, string> = {
  hero:  "Hero Slide",
  offer: "Offer Card",
  combo: "Combo Package",
};

const STATUS_CONFIG: Record<BannerStatus, { label: string; color: string; bg: string }> = {
  active:    { label: "Active",    color: "#2d7a4f", bg: "#e6f4ec" },
  inactive:  { label: "Inactive",  color: "#8a7560", bg: "#f0ebe3" },
  scheduled: { label: "Scheduled", color: "#8B5A2B", bg: "#fdf3e3" },
};

const PAGE_OPTIONS = ["home", "contact", "services", "gallery", "membership", "our-staff"];

const EMPTY_FORM: Omit<Banner, "_id"> = {
  type:       "hero",
  title:      "",
  subtitle:   "",
  badge:      "",
  cta:        "Book Now",
  discount:   "",
  targetPage: "home",
  imageUrl:   "",
  status:     "active",
  startDate:  "",
  endDate:    "",
  order:      1,
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD  (unchanged UI)
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 border flex items-start gap-4 ${
        accent
          ? "border-[#C8A96E]/40 bg-gradient-to-br from-[#2C1810] to-[#4A2C1A]"
          : "border-[#E8D9C0] bg-white"
      }`}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: accent
            ? "rgba(200,169,110,0.2)"
            : "linear-gradient(135deg,#C8A96E22,#8B5A2B11)",
        }}
      >
        <Icon size={18} className={accent ? "text-[#C8A96E]" : "text-[#8B5A2B]"} />
      </div>
      <div>
        <p
          className={`text-[11px] tracking-[0.18em] uppercase font-semibold mb-0.5 ${
            accent ? "text-[#A89070]" : "text-[#9E8572]"
          }`}
          style={{ fontFamily: "'Jost', sans-serif" }}
        >
          {label}
        </p>
        <p
          className={`font-bold leading-none ${accent ? "text-[#C8A96E]" : "text-[#2C1810]"}`}
          style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px" }}
        >
          {value}
        </p>
        <p
          className={`text-[11px] mt-1 ${accent ? "text-[#7A6050]" : "text-[#9E8572]"}`}
          style={{ fontFamily: "'Jost', sans-serif" }}
        >
          {sub}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD + SELECT helpers  (unchanged UI)
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[11px] font-semibold text-[#7A6050] mb-1.5 tracking-wide uppercase"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        className="w-full appearance-none border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all bg-white pr-8 cursor-pointer"
        style={{ fontFamily: "'Jost', sans-serif" }}
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E8572] pointer-events-none"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNER MODAL  (unchanged UI — only saving logic updated)
// ─────────────────────────────────────────────────────────────────────────────

function BannerModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial: Omit<Banner, "_id"> & { _id?: string };
  onSave:  (b: Omit<Banner, "_id"> & { _id?: string }) => Promise<void>;
  onClose: () => void;
  saving:  boolean;
}) {
  const [form, setForm]     = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState("");

  const set = (key: keyof typeof form, val: string | number) =>
    { setForm((f) => ({ ...f, [key]: val })); };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setUploadError("");
    setUploading(true);
    const result = await uploadImageToCloudinary(file);
    if (result.success) {
      set("imageUrl", result.url);
    } else {
      setUploadError(result.message);
    }
    setUploading(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim())    e.title     = "Title is required";
    if (!form.subtitle.trim()) e.subtitle  = "Subtitle is required";
    if (!form.badge.trim())    e.badge     = "Badge text is required";
    if (!form.startDate)       e.startDate = "Start date required";
    if (!form.endDate)         e.endDate   = "End date required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (validate()) await onSave(form);
  };

  const isEditing = !!initial._id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1A0A05]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#E8D9C0] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#E8D9C0] sticky top-0 bg-white rounded-t-3xl z-10">
          <div>
            <p
              className="text-[10px] tracking-[0.22em] uppercase text-[#C8A96E] font-semibold"
              style={{ fontFamily: "'Jost', sans-serif" }}
            >
              {isEditing ? "Edit Banner" : "New Banner"}
            </p>
            <h2
              className="text-[#2C1810] font-bold leading-tight"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "22px" }}
            >
              {isEditing ? form.title || "Edit Banner" : "Create Banner"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-full border border-[#E8D9C0] flex items-center justify-center text-[#9E8572] hover:bg-[#FAF7F2] transition-colors cursor-pointer bg-transparent disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          {/* Type & Status */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Banner Type" error={errors.type ?? ""}>
              <Select
                value={form.type}
                onChange={(v) => { set("type", v); }}
                options={[
                  { value: "hero",  label: "Hero Slide" },
                  { value: "offer", label: "Offer Card" },
                  { value: "combo", label: "Combo Package" },
                ]}
              />
            </Field>
            <Field label="Status" error={errors.status ?? ""}>
              <Select
                value={form.status}
                onChange={(v) => { set("status", v); }}
                options={[
                  { value: "active",    label: "Active" },
                  { value: "inactive",  label: "Inactive" },
                  { value: "scheduled", label: "Scheduled" },
                ]}
              />
            </Field>
          </div>

          {/* Title */}
          <Field label="Title" error={errors.title ?? ""}>
            <input
              className="w-full border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all"
              style={{ fontFamily: "'Jost', sans-serif" }}
              value={form.title}
              onChange={(e) => { set("title", e.target.value); }}
              placeholder="e.g. Sharp. Refined. Effortless."
            />
          </Field>

          {/* Subtitle */}
          <Field label="Subtitle / Description" error={errors.subtitle ?? ""}>
            <textarea
              className="w-full border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all resize-none"
              style={{ fontFamily: "'Jost', sans-serif" }}
              rows={2}
              value={form.subtitle}
              onChange={(e) => { set("subtitle", e.target.value); }}
              placeholder="Short description shown below the title"
            />
          </Field>

          {/* Badge, Discount, CTA */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Badge Text" error={errors.badge ?? ""}>
              <input
                className="w-full border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all"
                style={{ fontFamily: "'Jost', sans-serif" }}
                value={form.badge}
                onChange={(e) => { set("badge", e.target.value); }}
                placeholder="e.g. BESTSELLER"
              />
            </Field>
            <Field label="Discount (optional)" error="">
              <input
                className="w-full border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all"
                style={{ fontFamily: "'Jost', sans-serif" }}
                value={form.discount ?? ""}
                onChange={(e) => { set("discount", e.target.value); }}
                placeholder="e.g. 40% OFF"
              />
            </Field>
            <Field label="CTA Label" error="">
              <input
                className="w-full border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all"
                style={{ fontFamily: "'Jost', sans-serif" }}
                value={form.cta}
                onChange={(e) => { set("cta", e.target.value); }}
                placeholder="Book Now"
              />
            </Field>
          </div>

          {/* Target Page & Order */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Target Page" error="">
              <Select
                value={form.targetPage}
                onChange={(v) => { set("targetPage", v); }}
                options={PAGE_OPTIONS.map((p) => ({ value: p, label: p }))}
              />
            </Field>
            <Field label="Display Order" error="">
              <input
                type="number"
                min={1}
                className="w-full border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all"
                style={{ fontFamily: "'Jost', sans-serif" }}
                value={form.order}
                onChange={(e) => { set("order", Number(e.target.value)); }}
              />
            </Field>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" error={errors.startDate ?? ""}>
              <input
                type="date"
                className="w-full border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all"
                style={{ fontFamily: "'Jost', sans-serif" }}
                value={form.startDate}
                onChange={(e) => { set("startDate", e.target.value); }}
              />
            </Field>
            <Field label="End Date" error={errors.endDate ?? ""}>
              <input
                type="date"
                className="w-full border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all"
                style={{ fontFamily: "'Jost', sans-serif" }}
                value={form.endDate}
                onChange={(e) => { set("endDate", e.target.value); }}
              />
            </Field>
          </div>

                   {/* Image — upload from device (Cloudinary) or paste a URL */}
          <Field label="Banner Image" error="">
            <div className="flex flex-col gap-2">
              <label
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed cursor-pointer text-sm font-medium transition-colors w-fit ${
                  uploading
                    ? "border-[#E8D9C0] text-[#B0A090] cursor-not-allowed"
                    : "border-[#C8A96E] text-[#8B5A2B] hover:bg-[#FAF7F2]"
                }`}
                style={{ fontFamily: "'Jost', sans-serif" }}
              >
                {uploading ? (
                  <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                ) : (
                  <><Upload size={14} /> Choose Photo (camera / gallery / files)</>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { void handleFilePick(e); }}
                />
              </label>

              {uploadError && (
                <p className="text-[11px] text-red-500 flex items-center gap-1">
                  <AlertCircle size={10} /> {uploadError}
                </p>
              )}

              <input
                className="w-full border border-[#E8D9C0] rounded-xl px-4 py-2.5 text-sm text-[#2C1810] outline-none focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/15 transition-all"
                style={{ fontFamily: "'Jost', sans-serif" }}
                value={form.imageUrl}
                onChange={(e) => { set("imageUrl", e.target.value); }}
                placeholder="…or paste an image URL"
              />
            </div>
          </Field>

          {/* Preview */}
          {form.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-[#E8D9C0] relative h-36">
              <img
                src={form.imageUrl}
                alt="preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#2C1810]/70 to-transparent flex items-end p-4">
                {form.badge && (
                  <span
                    className="px-2 py-0.5 rounded-full text-white text-[9px] font-bold tracking-widest uppercase"
                    style={{
                      background: "linear-gradient(to right,#C8A96E,#8B5A2B)",
                      fontFamily: "'Jost', sans-serif",
                    }}
                  >
                    {form.badge}
                  </span>
                )}
                {form.discount && (
                  <span
                    className="ml-auto font-bold text-white"
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "22px" }}
                  >
                    {form.discount}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-[#E8D9C0] flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-3xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border border-[#E8D9C0] text-[#8a7560] text-sm font-medium hover:bg-[#FAF7F2] transition-colors cursor-pointer bg-transparent disabled:opacity-50"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold tracking-wide flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer border-none disabled:opacity-60"
            style={{
              background: "linear-gradient(to right,#C8A96E,#8B5A2B)",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : (
              <><Check size={14} /> {isEditing ? "Save Changes" : "Create Banner"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONFIRM  (unchanged UI)
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirm({
  title,
  onConfirm,
  onClose,
  deleting,
}: {
  title:    string;
  onConfirm: () => Promise<void>;
  onClose:  () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1A0A05]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-7 w-full max-w-sm border border-[#E8D9C0] shadow-2xl text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-400" />
        </div>
        <h3
          className="text-[#2C1810] font-bold mb-1"
          style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px" }}
        >
          Delete Banner?
        </h3>
        <p
          className="text-sm text-[#9E8572] mb-6 leading-relaxed"
          style={{ fontFamily: "'Jost', sans-serif" }}
        >
          &ldquo;{title}&rdquo; will be permanently removed from the website.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-5 py-2.5 rounded-xl border border-[#E8D9C0] text-[#8a7560] text-sm font-medium hover:bg-[#FAF7F2] transition-colors cursor-pointer bg-transparent disabled:opacity-50"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={() => { void onConfirm(); }}
            disabled={deleting}
            className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer border-none disabled:opacity-60 flex items-center gap-2"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : null}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNER CARD  (unchanged UI)
// ─────────────────────────────────────────────────────────────────────────────

// Same idea as HomePage's isBannerCurrentlyLive — endDate passing doesn't
// change the stored `status`, so we compute an "Expired" display state here
// purely for the badge. Doesn't touch banner.status or the toggle button.
function isBannerExpired(b: Banner): boolean {
  if (!b.endDate) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  return b.endDate.slice(0, 10) < todayStr;
}

function BannerCard({
  banner,
  onEdit,
  onDelete,
  onToggleStatus,
  toggling,
}: {
  banner:         Banner;
  onEdit:         () => void;
  onDelete:       () => void;
  onToggleStatus: () => void;
  toggling:       boolean;
}) {
  const expired = banner.status === "active" && isBannerExpired(banner);
  const st = expired
    ? { label: "Expired", color: "#B04A3C", bg: "#FBEAE7" }
    : STATUS_CONFIG[banner.status];
  const TypeIcon =
    banner.type === "hero" ? ImageIcon : banner.type === "offer" ? Tag : Percent;

  return (
    <div className="bg-white border border-[#E8D9C0] rounded-2xl overflow-hidden hover:border-[#C8A96E]/50 hover:shadow-[0_8px_32px_rgba(200,169,110,0.12)] transition-all duration-300 group">
      {/* Image strip */}
      <div className="relative h-28 overflow-hidden bg-[#FAF7F2]">
        {banner.imageUrl ? (
          <img
            src={banner.imageUrl}
            alt={banner.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={28} className="text-[#D4C4B0]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#2C1810]/60 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          <span
            className="px-2 py-0.5 rounded-full text-white text-[9px] font-bold tracking-widest uppercase"
            style={{
              background: "linear-gradient(to right,#C8A96E,#8B5A2B)",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            {banner.badge}
          </span>
        </div>
        {banner.discount && (
          <span
            className="absolute top-2 right-3 font-bold text-white drop-shadow"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px" }}
          >
            {banner.discount}
          </span>
        )}
        <div className="absolute bottom-2 left-3">
          <span
            className="text-[9px] text-white/70 tracking-wider"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            ORDER #{banner.order}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <TypeIcon size={11} className="text-[#C8A96E]" />
            <span
              className="text-[10px] tracking-[0.15em] uppercase text-[#C8A96E] font-semibold"
              style={{ fontFamily: "'Jost', sans-serif" }}
            >
              {TYPE_LABELS[banner.type]}
            </span>
          </div>
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
            style={{ color: st.color, background: st.bg, fontFamily: "'Jost', sans-serif" }}
          >
            {st.label}
          </span>
        </div>

        <h3
          className="text-[#2C1810] font-bold leading-tight mb-1 line-clamp-1"
          style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "17px" }}
        >
          {banner.title}
        </h3>
        <p
          className="text-xs text-[#9E8572] leading-relaxed mb-3 line-clamp-2"
          style={{ fontFamily: "'Jost', sans-serif" }}
        >
          {banner.subtitle}
        </p>

        <p className="text-[10px] text-[#B0A090] mb-3" style={{ fontFamily: "'Jost', sans-serif" }}>
          {banner.startDate} → {banner.endDate}
        </p>

        <div className="flex items-center gap-2 mb-4">
          <span
            className="px-2.5 py-0.5 rounded-full bg-[#F5EFE6] text-[#8B5A2B] text-[10px] font-semibold border border-[#E8D9C0]"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            {banner.cta}
          </span>
          <span className="text-[10px] text-[#B0A090]" style={{ fontFamily: "'Jost', sans-serif" }}>
            → /{banner.targetPage}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-[#F0EBE3] pt-3">
          <button
            onClick={onToggleStatus}
            disabled={toggling}
            title={banner.status === "active" ? "Deactivate" : "Activate"}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#E8D9C0] text-[#8a7560] text-[11px] font-medium hover:bg-[#FAF7F2] transition-colors cursor-pointer bg-transparent disabled:opacity-50"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            {toggling
              ? <Loader2 size={13} className="animate-spin" />
              : banner.status === "active"
                ? <EyeOff size={13} />
                : <Eye size={13} />}
            {banner.status === "active" ? "Pause" : "Activate"}
          </button>
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#C8A96E]/40 text-[#8B5A2B] text-[11px] font-medium hover:bg-[#C8A96E]/10 transition-colors cursor-pointer bg-transparent"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="w-9 flex items-center justify-center py-2 rounded-xl border border-red-100 text-red-400 hover:bg-red-50 transition-colors cursor-pointer bg-transparent"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BannerPage() {
  const [banners,      setBanners]      = useState<Banner[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filterType,   setFilterType]   = useState<"all" | BannerType>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | BannerStatus>("all");
  const [modal,        setModal]        = useState<
    null | { mode: "create" } | { mode: "edit"; banner: Banner }
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; error?: boolean } | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [togglingId,   setTogglingId]   = useState<string | null>(null);

  // ── toast helper ──
  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => { setToast(null); }, 2800);
  };

  // ── fetch all banners ──
  const fetchBanners = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<Banner[]>(API_BASE);
    if (res.success) {
      setBanners(res.data);
    } else {
      showToast(res.message, true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchBanners(); }, [fetchBanners]);

  // ── create / update ──
  const handleSave = async (data: Omit<Banner, "_id"> & { _id?: string }) => {
    setSaving(true);
    if (data._id) {
      // UPDATE — PATCH
      const res = await apiFetch<Banner>(`${API_BASE}/${data._id}`, {
        method: "PATCH",
        body:   JSON.stringify(data),
      });
      if (res.success) {
        setBanners((bs) => bs.map((b) => (b._id === data._id ? res.data : b)));
        showToast("Banner updated successfully.");
        setModal(null);
      } else {
        showToast(res.message, true);
      }
    } else {
      // CREATE — POST
      const res = await apiFetch<Banner>(API_BASE, {
        method: "POST",
        body:   JSON.stringify(data),
      });
      if (res.success) {
        setBanners((bs) => [...bs, res.data]);
        showToast("Banner created successfully.");
        setModal(null);
      } else {
        showToast(res.message, true);
      }
    }
    setSaving(false);
  };

  // ── delete ──
  const handleDelete = async (id: string) => {
    setDeleting(true);
    const res = await apiFetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (res.success) {
      setBanners((bs) => bs.filter((b) => b._id !== id));
      setDeleteTarget(null);
      showToast("Banner deleted.");
    } else {
      showToast(res.message, true);
    }
    setDeleting(false);
  };

  // ── toggle status ──
  const handleToggleStatus = async (id: string) => {
    setTogglingId(id);
    const res = await apiFetch<Banner>(`${API_BASE}/${id}/toggle-status`, { method: "PATCH" });
    if (res.success) {
      setBanners((bs) => bs.map((b) => (b._id === id ? res.data : b)));
    } else {
      showToast(res.message, true);
    }
    setTogglingId(null);
  };

  // ── filtered view ──
  const filtered = banners.filter((b) => {
    if (filterType   !== "all" && b.type   !== filterType)   return false;
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    return true;
  });

  const totalActive = banners.filter((b) => b.status === "active").length;
  const totalHero   = banners.filter((b) => b.type === "hero").length;
  const totalOffers = banners.filter((b) => b.type === "offer" || b.type === "combo").length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAF7F2]" style={{ fontFamily: "'Jost', sans-serif" }}>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[60] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl border animate-pulse ${
            toast.error
              ? "bg-red-600 border-red-400/30"
              : "bg-[#2C1810] border-[#C8A96E]/20"
          } text-white`}
        >
          {toast.error
            ? <AlertCircle size={14} className="text-red-200" />
            : <Check       size={14} className="text-[#C8A96E]" />}
          <span className="text-sm" style={{ fontFamily: "'Jost', sans-serif" }}>{toast.msg}</span>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <BannerModal
          initial={
            modal.mode === "edit"
              ? { ...modal.banner }
              : { ...EMPTY_FORM }
          }
          onSave={handleSave}
          onClose={() => { if (!saving) setModal(null); }}
          saving={saving}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <DeleteConfirm
          title={deleteTarget.title}
          onConfirm={() => handleDelete(deleteTarget._id)}
          onClose={() => { if (!deleting) setDeleteTarget(null); }}
          deleting={deleting}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-1">
              Content Management
            </p>
            <h1
              className="text-[#2C1810] font-bold leading-tight"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(26px,4vw,36px)" }}
            >
              Banners & Offers
            </h1>
            <p className="text-sm text-[#9E8572] mt-1">
              Manage hero slides, promotional offers and combo packages shown on the website.
            </p>
          </div>
          <button
            onClick={() => { setModal({ mode: "create" }); }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold tracking-wide border-none cursor-pointer hover:opacity-90 hover:shadow-lg transition-all duration-200 flex-shrink-0"
            style={{ background: "linear-gradient(to right,#C8A96E,#8B5A2B)" }}
          >
            <Plus size={16} /> New Banner
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Layers}   label="Total Banners" value={banners.length} sub="across all types" accent />
          <StatCard icon={Megaphone} label="Active Now"   value={totalActive}    sub="live on website" />
          <StatCard icon={ImageIcon} label="Hero Slides"  value={totalHero}      sub="carousel items"  />
          <StatCard icon={Tag}       label="Offers & Combos" value={totalOffers} sub="promotional cards" />
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-1.5 bg-white border border-[#E8D9C0] rounded-xl p-1">
            {(["all", "hero", "offer", "combo"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setFilterType(t); }}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide uppercase transition-all cursor-pointer border-none ${
                  filterType === t ? "text-white" : "text-[#9E8572] bg-transparent hover:bg-[#FAF7F2]"
                }`}
                style={filterType === t ? { background: "linear-gradient(to right,#C8A96E,#8B5A2B)" } : {}}
              >
                {t === "all" ? "All" : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 bg-white border border-[#E8D9C0] rounded-xl p-1">
            {(["all", "active", "inactive", "scheduled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); }}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide uppercase transition-all cursor-pointer border-none ${
                  filterStatus === s ? "text-white" : "text-[#9E8572] bg-transparent hover:bg-[#FAF7F2]"
                }`}
                style={filterStatus === s ? { background: "linear-gradient(to right,#C8A96E,#8B5A2B)" } : {}}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          <span className="ml-auto self-center text-sm text-[#9E8572]">
            {filtered.length} banner{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 size={32} className="animate-spin text-[#C8A96E]" />
            <p className="text-sm text-[#9E8572]" style={{ fontFamily: "'Jost', sans-serif" }}>
              Loading banners…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-[#E8D9C0] rounded-2xl p-16 text-center">
            <Megaphone size={36} className="text-[#D4C4B0] mx-auto mb-4" />
            <p
              className="text-[#2C1810] font-bold mb-1"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "22px" }}
            >
              No banners found
            </p>
            <p className="text-sm text-[#9E8572] mb-6">
              Try changing the filters or create a new banner.
            </p>
            <button
              onClick={() => { setModal({ mode: "create" }); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold cursor-pointer border-none hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(to right,#C8A96E,#8B5A2B)" }}
            >
              <Plus size={14} /> Create Banner
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered
              .sort((a, b) => a.order - b.order)
              .map((banner) => (
                <BannerCard
  key={banner._id}
  banner={banner}
  onEdit={() => { setModal({ mode: "edit", banner }); }}
  onDelete={() => { setDeleteTarget(banner); }}
  onToggleStatus={() => { void handleToggleStatus(banner._id); }}
  toggling={togglingId === banner._id}
/>
              ))}

            {/* Add new card */}
            <button
              onClick={() => { setModal({ mode: "create" }); }}
              className="min-h-[320px] bg-white border-2 border-dashed border-[#E8D9C0] rounded-2xl flex flex-col items-center justify-center gap-3 text-[#C8A96E] hover:border-[#C8A96E] hover:bg-[#FAF7F2] transition-all duration-300 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#C8A96E]/40 flex items-center justify-center group-hover:border-[#C8A96E] transition-colors">
                <Plus size={20} className="text-[#C8A96E]" />
              </div>
              <span
                className="text-[11px] tracking-[0.18em] uppercase font-semibold text-[#C8A96E]"
                style={{ fontFamily: "'Jost', sans-serif" }}
              >
                Add Banner
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}