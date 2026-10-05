import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import { useAuth } from "../../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// ─── Types ──────────────────────────────────────────────────────────────────
interface JoiningFormState {
  fullName: string;
  mobileNumber: string;
  position: string;
  totalExperience: string;
}

const emptyForm: JoiningFormState = {
  fullName: "",
  mobileNumber: "",
  position: "",
  totalExperience: "",
};

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const paths: Record<string, string> = {
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {(paths[n] ?? "").split("M").filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
    </svg>
  );
};

// ─── Reusable field bits ────────────────────────────────────────────────────
const SectionCard = ({
  number, icon, title, children,
}: { number: string; icon: string; title: string; children: React.ReactNode }) => (
  <section className="ej-card">
    <div className="ej-ch">
      <span className="ej-num">{number}</span>
      <div className="ej-ct"><Ic n={icon} s={13} />{title}</div>
    </div>
    <div className="ej-cb">{children}</div>
  </section>
);

const Field = ({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) => (
  <label className="ej-field">
    <span className="ej-form-lbl">
      {label} {required && <span className="ej-req">*</span>}
    </span>
    {children}
  </label>
);

// Velvet crest — bordered square from the printed letterhead, now holding
// the actual salon logo image instead of a drawn diamond.
const Crest = () => (
  <div className="ej-crest">
    <img src="/assets/logo.webp" alt="Velvet" className="ej-crest-img" />
  </div>
);

export default function EmployeeJoiningPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<JoiningFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (field: keyof JoiningFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      { setForm((f) => ({ ...f, [field]: e.target.value })); };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus("idle");
    setSubmitError(null);
    try {
      const res = await fetch(`${API_BASE}/api/employee-joining`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message ?? body?.error ?? `Request failed (${String(res.status)})`);
      }
      setStatus("success");
      setForm(emptyForm);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : null);
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .ej-page{min-height:100vh;background:#f5f0e8;font-family:'Jost',sans-serif;color:#2c1f0e;padding:24px}
        .ej-wrap{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:16px}

        .ej-topbar{background:#fff;border:1px solid #ede5d6;border-radius:12px;padding:20px 24px;display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px}
        .ej-brand{display:flex;align-items:center;gap:12px}
        .ej-crest{width:40px;height:40px;flex-shrink:0;border:1px solid #d4af37;display:flex;align-items:center;justify-content:center;padding:5px;background:#fff}
        .ej-crest-img{width:100%;height:100%;object-fit:contain}
        .ej-brand-name{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#1a1208}
        .ej-brand-sub{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B5A2B;margin-top:2px}
        .ej-brand-conf{font-size:11px;font-style:italic;color:#8a7560;margin-top:2px}

        .ej-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;overflow:hidden}
        .ej-ch{padding:14px 20px;border-bottom:1px solid #f0e8d8;display:flex;align-items:center;gap:10px}
        .ej-num{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:600;color:#d4af37;background:#1a1208;border-radius:6px;min-width:26px;height:22px;display:flex;align-items:center;justify-content:center;padding:0 4px}
        .ej-ct{font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:#1a1208;display:flex;align-items:center;gap:7px}
        .ej-cb{padding:20px}

        .ej-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
        .ej-field{display:flex;flex-direction:column;gap:6px}
        .ej-form-lbl{font-size:12px;font-weight:500;color:#2C1810}
        .ej-req{color:#8B5A2B}
        .ej-inp{height:38px;border:1px solid #e0d5c0;border-radius:8px;background:#fff;padding:0 12px;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e;outline:none;width:100%;transition:border-color .2s}
        .ej-inp:focus{border-color:#d4af37}
        .ej-inp::placeholder{color:#8a7560;opacity:.6}

        .ej-submit-bar{display:flex;align-items:center;gap:16px;padding:20px 4px 4px}
        .ej-btn-primary{height:44px;padding:0 26px;border:none;border-radius:8px;background:#1a1208;color:#d4af37;font-family:'Jost',sans-serif;font-size:12px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:opacity .15s;display:inline-flex;align-items:center;gap:8px}
        .ej-btn-primary:hover{opacity:.9}
        .ej-btn-primary:disabled{opacity:.5;cursor:not-allowed}
        .ej-spin{width:13px;height:13px;border:2px solid rgba(212,175,55,.35);border-top-color:#d4af37;border-radius:50%;animation:ej-spin .7s linear infinite}
        .ej-status-success{font-size:13px;color:#15803d;font-weight:500}
        .ej-status-error{font-size:13px;color:#b91c1c;font-weight:500}

        .ej-footer{text-align:center;padding:20px 4px 4px}
        .ej-footer-name{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#1a1208}
        .ej-footer-line{font-size:11px;color:#8a7560;margin-top:4px}
        .ej-footer-conf{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8a7560;opacity:.7;margin-top:10px}

        @keyframes ej-spin{to{transform:rotate(360deg)}}

        @media (max-width: 720px) {
          .ej-page{padding:14px}
          .ej-topbar{padding:16px;flex-direction:column;align-items:flex-start}
          .ej-grid{grid-template-columns:1fr}
          .ej-ch{padding:12px 14px}
          .ej-cb{padding:14px}
        }
      `}</style>

      <div className="ej-page">
        <div className="ej-wrap">
          {/* Header */}
          <div className="ej-topbar">
            <div className="ej-brand">
              <Crest />
              <div>
                <div className="ej-brand-name">Velvet</div>
                <div className="ej-brand-sub">Employee Joining Form</div>
                <div className="ej-brand-conf">Confidential — Internal HR &amp; Management Use Only</div>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="ej-wrap"
          >
            <SectionCard number="01" icon="user" title="Employee Details">
              <div className="ej-grid">
                <Field label="Full Name" required>
                  <input className="ej-inp" value={form.fullName} onChange={update("fullName")} required />
                </Field>
                <Field label="Mobile Number" required>
                  <input className="ej-inp" value={form.mobileNumber} onChange={update("mobileNumber")} required />
                </Field>
                <Field label="Position / Designation" required>
                  <input className="ej-inp" value={form.position} onChange={update("position")} required />
                </Field>
                <Field label="Total Experience">
                  <input className="ej-inp" value={form.totalExperience} onChange={update("totalExperience")} />
                </Field>
              </div>
            </SectionCard>

            {/* Submit */}
            <div className="ej-submit-bar">
              <button type="submit" disabled={submitting} className="ej-btn-primary">
                {submitting && <div className="ej-spin" />}
                {submitting ? "Saving..." : "Save Employee Record"}
              </button>
              {status === "success" && (
                <span className="ej-status-success">Saved successfully.</span>
              )}
              {status === "error" && (
                <span className="ej-status-error">
                  {submitError ?? "Something went wrong — try again."}
                </span>
              )}
            </div>
          </form>

          {/* Footer, echoing the printed letterhead */}
          <div className="ej-footer">
            <div className="ej-footer-name">VELVET Premium Unisex Salon</div>
            <div className="ej-footer-line">Lakshmi Nagar, Bhavani, Erode District, Tamil Nadu, India</div>
            <div className="ej-footer-line">+91 93456 78646 &nbsp;·&nbsp; @velvet_unisex &nbsp;·&nbsp; velvetluxurysalon.in</div>
            <div className="ej-footer-conf">Confidential — Internal HR Document</div>
          </div>
        </div>
      </div>
    </>
  );
}