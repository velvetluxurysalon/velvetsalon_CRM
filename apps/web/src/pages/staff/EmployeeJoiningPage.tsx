import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import { useAuth } from "../../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// ─── Types ──────────────────────────────────────────────────────────────────
interface JoiningFormState {
  staffId: string;
  dateOfJoining: string;

  fullName: string;
  preferredName: string;
  mobileNumber: string;
  whatsappNumber: string;
  dateOfBirth: string;
  currentAddress: string;

  emergencyContactName: string;
  emergencyRelationship: string;
  emergencyPhone: string;

  position: string;
  department: string;
  previousEmployer: string;
  totalExperience: string;
  agreedSalary: string;
  employmentType: string;
  probationPeriod: string;
  weeklyOff: string;

  skills: string[];
  strongestSkill: string;
  trainingRequired: string;

  documents: string[];

  aadhaarNumber: string;
  panNumber: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;

  declarationAccepted: boolean;
  signatureName: string;
  declarationDate: string;

  documentsVerified: "" | "yes" | "no";
  skillAssessment: "" | "Beginner" | "Intermediate" | "Advanced" | "Expert";
  joiningApprovedBy: string;
  probationReviewDate: string;
  managerRemarks: string;
  managerSignature: string;
}

const emptyForm: JoiningFormState = {
  staffId: "", dateOfJoining: "",
  fullName: "", preferredName: "", mobileNumber: "", whatsappNumber: "",
  dateOfBirth: "", currentAddress: "",
  emergencyContactName: "", emergencyRelationship: "", emergencyPhone: "",
  position: "", department: "", previousEmployer: "", totalExperience: "",
  agreedSalary: "", employmentType: "", probationPeriod: "", weeklyOff: "",
  skills: [], strongestSkill: "", trainingRequired: "",
  documents: [],
  aadhaarNumber: "", panNumber: "", bankName: "", accountHolderName: "",
  accountNumber: "", ifscCode: "",
  declarationAccepted: false, signatureName: "", declarationDate: "",
  documentsVerified: "", skillAssessment: "", joiningApprovedBy: "",
  probationReviewDate: "", managerRemarks: "", managerSignature: "",
};

const SKILL_GROUPS: Record<string, string[]> = {
  Hair: ["Haircut", "Styling", "Colour", "Hair Spa", "Keratin", "Smoothening"],
  "Beauty / Grooming": ["Beard", "Facial", "Threading", "Waxing", "Bleach", "Manicure", "Pedicure", "Massage"],
  Specialized: ["Bridal", "Customer Consultation", "Premium Treatments"],
};

const DOCUMENT_OPTIONS = ["ID Proof", "PAN", "Address Proof", "Photograph", "Experience Certificate", "Bank Details"];
const SKILL_LEVELS: JoiningFormState["skillAssessment"][] = ["Beginner", "Intermediate", "Advanced", "Expert"];

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const paths: Record<string, string> = {
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    check: "M20 6L9 17l-5-5",
    id: "M2 4h20v16H2zM6 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM3 18c0-2 2-3.5 5-3.5s5 1.5 5 3.5M14 8h6M14 12h6M14 16h4",
    bank: "M3 21h18M3 10h18M5 6l7-4 7 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3",
    signature: "M3 17c3-6 5 4 8-2 2-4 4 4 7-3M4 21h16",
    briefcase: "M3 7h18v13H3zM8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3M3 12h18",
    tag: "M20.59 13.41L11 3.83A2 2 0 0 0 9.59 3.17H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .66 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.52-4.52a2 2 0 0 0 0-2.83zM7 7h.01",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
    calendar: "M3 4h18v18H3zM3 10h18M8 2v4M16 2v4",
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

// Same underlying <input type="checkbox">/<input type="radio"> as before —
// only the visual wrapper changed, so all onChange/checked behaviour is unchanged.
const CheckOption = ({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: () => void }) => (
  <label className={`ej-chip${checked ? " checked" : ""}`}>
    <input type="checkbox" checked={checked} onChange={onChange} />
    {checked && <Ic n="check" s={11} />}
    {label}
  </label>
);

const RadioOption = ({
  name, label, checked, onChange,
}: { name: string; label: string; checked: boolean; onChange: () => void }) => (
  <label className={`ej-chip${checked ? " checked" : ""}`}>
    <input type="radio" name={name} checked={checked} onChange={onChange} />
    {checked && <Ic n="check" s={11} />}
    {label}
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

  const toggleInArray = (field: "skills" | "documents", value: string) =>
    { setForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((v) => v !== value)
        : [...f[field], value],
    })); };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.declarationAccepted) {
      setStatus("error");
      return;
    }
    setSubmitting(true);
    setStatus("idle");
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
        .ej-meta{display:flex;flex-direction:column;gap:8px}
        .ej-meta-row{display:flex;align-items:center;justify-content:flex-end;gap:8px}
        .ej-meta-lbl{font-size:11px;font-weight:500;color:#1a1208}
        .ej-meta-inp{width:150px;height:30px;border:1px solid #e0d5c0;border-radius:6px;background:#faf8f4;padding:0 8px;text-align:right;font-family:'Jost',sans-serif;font-size:12px;color:#2c1f0e;outline:none;transition:border-color .2s}
        .ej-meta-inp:focus{border-color:#d4af37;background:#fff}

        .ej-card{background:#fff;border:1px solid #ede5d6;border-radius:12px;overflow:hidden}
        .ej-ch{padding:14px 20px;border-bottom:1px solid #f0e8d8;display:flex;align-items:center;gap:10px}
        .ej-num{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:600;color:#d4af37;background:#1a1208;border-radius:6px;min-width:26px;height:22px;display:flex;align-items:center;justify-content:center;padding:0 4px}
        .ej-ct{font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:#1a1208;display:flex;align-items:center;gap:7px}
        .ej-cb{padding:20px}

        .ej-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
        .ej-grid.cols-3{grid-template-columns:repeat(3,1fr)}
        .ej-field{display:flex;flex-direction:column;gap:6px}
        .ej-form-lbl{font-size:12px;font-weight:500;color:#2C1810}
        .ej-req{color:#8B5A2B}
        .ej-inp{height:38px;border:1px solid #e0d5c0;border-radius:8px;background:#fff;padding:0 12px;font-family:'Jost',sans-serif;font-size:13px;color:#2c1f0e;outline:none;width:100%;transition:border-color .2s}
        .ej-inp:focus{border-color:#d4af37}
        .ej-inp::placeholder{color:#8a7560;opacity:.6}

        .ej-skill-group{margin-bottom:16px}
        .ej-skill-group:last-of-type{margin-bottom:0}
        .ej-skill-group-lbl{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8B5A2B;margin-bottom:8px}
        .ej-chip-row{display:flex;flex-wrap:wrap;gap:8px}
        .ej-chip{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 14px;border-radius:20px;border:1.5px solid #e0d5c0;background:#fff;font-family:'Jost',sans-serif;font-size:12px;font-weight:500;color:#6b5740;cursor:pointer;transition:all .15s;user-select:none;white-space:nowrap}
        .ej-chip:hover{border-color:#d4af37}
        .ej-chip.checked{background:#1a1208;border-color:#1a1208;color:#d4af37}
        .ej-chip input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}

        .ej-quote{font-size:13px;font-style:italic;line-height:1.6;color:#5c4a3a;background:#faf8f4;border:1px solid #ede5d6;border-radius:8px;padding:14px 16px;margin-bottom:16px}
        .ej-agree{display:flex;align-items:center;gap:8px;font-size:13px;color:#2C1810;margin-bottom:16px;cursor:pointer}
        .ej-agree input{width:16px;height:16px;accent-color:#8B5A2B}

        .ej-mgmt-box{background:#faf5e8;border:1px solid #e5d8b8;border-radius:10px;padding:18px}
        .ej-mgmt-row{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-bottom:14px}
        .ej-mgmt-row:last-of-type{margin-bottom:0}
        .ej-mgmt-lbl{font-size:12px;font-weight:500;color:#1a1208;min-width:150px}
        .ej-mgmt-chips{display:flex;flex-wrap:wrap;gap:8px}
        .ej-mgmt-fields{margin-top:16px;padding-top:16px;border-top:1px solid #e5d8b8}

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
          .ej-meta{width:100%}
          .ej-meta-row{justify-content:space-between}
          .ej-meta-inp{width:130px}
          .ej-grid{grid-template-columns:1fr}
          .ej-grid.cols-3{grid-template-columns:1fr}
          .ej-ch{padding:12px 14px}
          .ej-cb{padding:14px}
          .ej-mgmt-lbl{min-width:0;width:100%}
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
            <div className="ej-meta">
              <div className="ej-meta-row">
                <span className="ej-meta-lbl">Staff ID:</span>
                <input className="ej-meta-inp" value={form.staffId} onChange={update("staffId")} />
              </div>
              <div className="ej-meta-row">
                <span className="ej-meta-lbl">Date of Joining:</span>
                <input type="date" className="ej-meta-inp" value={form.dateOfJoining} onChange={update("dateOfJoining")} />
              </div>
            </div>
          </div>

         <form
  onSubmit={(e) => {
    void handleSubmit(e);
  }}
  className="ej-wrap"
>
            {/* 01 Personal Details */}
            <SectionCard number="01" icon="user" title="Personal Details">
              <div className="ej-grid">
                <Field label="Full Name" required>
                  <input className="ej-inp" value={form.fullName} onChange={update("fullName")} required />
                </Field>
                <Field label="Preferred Name">
                  <input className="ej-inp" value={form.preferredName} onChange={update("preferredName")} />
                </Field>
                <Field label="Mobile Number" required>
                  <input className="ej-inp" value={form.mobileNumber} onChange={update("mobileNumber")} required />
                </Field>
                <Field label="WhatsApp Number">
                  <input className="ej-inp" value={form.whatsappNumber} onChange={update("whatsappNumber")} />
                </Field>
                <Field label="Date of Birth">
                  <input type="date" className="ej-inp" value={form.dateOfBirth} onChange={update("dateOfBirth")} />
                </Field>
                <Field label="Current Address">
                  <input className="ej-inp" value={form.currentAddress} onChange={update("currentAddress")} />
                </Field>
              </div>
            </SectionCard>

            {/* 02 Emergency Contact */}
            <SectionCard number="02" icon="phone" title="Emergency Contact">
              <div className="ej-grid cols-3">
                <Field label="Contact Name" required>
                  <input className="ej-inp" value={form.emergencyContactName} onChange={update("emergencyContactName")} required />
                </Field>
                <Field label="Relationship">
                  <input className="ej-inp" value={form.emergencyRelationship} onChange={update("emergencyRelationship")} />
                </Field>
                <Field label="Phone Number" required>
                  <input className="ej-inp" value={form.emergencyPhone} onChange={update("emergencyPhone")} required />
                </Field>
              </div>
            </SectionCard>

            {/* 03 Employment Details */}
            <SectionCard number="03" icon="briefcase" title="Employment Details">
              <div className="ej-grid">
                <Field label="Position / Designation" required>
                  <input className="ej-inp" value={form.position} onChange={update("position")} required />
                </Field>
                <Field label="Department" required>
                  <input className="ej-inp" value={form.department} onChange={update("department")} required />
                </Field>
                <Field label="Previous Salon / Employer">
                  <input className="ej-inp" value={form.previousEmployer} onChange={update("previousEmployer")} />
                </Field>
                <Field label="Total Experience">
                  <input className="ej-inp" value={form.totalExperience} onChange={update("totalExperience")} />
                </Field>
                <Field label="Agreed Salary">
                  <input className="ej-inp" value={form.agreedSalary} onChange={update("agreedSalary")} />
                </Field>
                <Field label="Employment Type">
                  <input className="ej-inp" value={form.employmentType} onChange={update("employmentType")} placeholder="Full-time / Part-time" />
                </Field>
                <Field label="Probation Period">
                  <input className="ej-inp" value={form.probationPeriod} onChange={update("probationPeriod")} />
                </Field>
                <Field label="Weekly Off">
                  <input className="ej-inp" value={form.weeklyOff} onChange={update("weeklyOff")} />
                </Field>
              </div>
            </SectionCard>

            {/* 04 Skills & Experience */}
            <SectionCard number="04" icon="star" title="Skills & Experience">
              <div>
                {Object.entries(SKILL_GROUPS).map(([group, options]) => (
                  <div key={group} className="ej-skill-group">
                    <div className="ej-skill-group-lbl">{group}</div>
                    <div className="ej-chip-row">
                      {options.map((opt) => (
                        <CheckOption
                          key={opt}
                          label={opt}
                          checked={form.skills.includes(opt)}
                          onChange={() => { toggleInArray("skills", opt); }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="ej-grid" style={{ paddingTop: 4 }}>
                  <Field label="Strongest Skill">
                    <input className="ej-inp" value={form.strongestSkill} onChange={update("strongestSkill")} />
                  </Field>
                  <Field label="Training Required">
                    <input className="ej-inp" value={form.trainingRequired} onChange={update("trainingRequired")} />
                  </Field>
                </div>
              </div>
            </SectionCard>

            {/* 05 Document Checklist */}
            <SectionCard number="05" icon="file" title="Document Checklist">
              <div className="ej-chip-row">
                {DOCUMENT_OPTIONS.map((doc) => (
                  <CheckOption
                    key={doc}
                    label={doc}
                    checked={form.documents.includes(doc)}
                    onChange={() => { toggleInArray("documents", doc); }}
                  />
                ))}
              </div>
            </SectionCard>

            {/* 06 ID / Proof Details */}
            <SectionCard number="06" icon="id" title="ID / Proof Details">
              <div className="ej-grid">
                <Field label="Aadhaar Number">
                  <input className="ej-inp" value={form.aadhaarNumber} onChange={update("aadhaarNumber")} />
                </Field>
                <Field label="PAN Number">
                  <input className="ej-inp" value={form.panNumber} onChange={update("panNumber")} />
                </Field>
                <Field label="Bank Name">
                  <input className="ej-inp" value={form.bankName} onChange={update("bankName")} />
                </Field>
                <Field label="Account Holder Name">
                  <input className="ej-inp" value={form.accountHolderName} onChange={update("accountHolderName")} />
                </Field>
                <Field label="Account Number">
                  <input className="ej-inp" value={form.accountNumber} onChange={update("accountNumber")} />
                </Field>
                <Field label="IFSC Code">
                  <input className="ej-inp" value={form.ifscCode} onChange={update("ifscCode")} />
                </Field>
              </div>
            </SectionCard>

            {/* 07 Employee Declaration */}
            <SectionCard number="07" icon="signature" title="Employee Declaration">
              <div className="ej-quote">
                "I confirm that the information provided by me is true and complete. I agree to follow VELVET's
                workplace, hygiene, customer-service, confidentiality and operational standards and understand that
                my skills and performance may be evaluated."
              </div>
              <label className="ej-agree">
                <input
                  type="checkbox"
                  checked={form.declarationAccepted}
                  onChange={(e) => { setForm((f) => ({ ...f, declarationAccepted: e.target.checked })); }}
                />
                I agree to the declaration above
              </label>
              <div className="ej-grid">
                <Field label="Employee Signature (typed name)" required>
                  <input className="ej-inp" value={form.signatureName} onChange={update("signatureName")} required />
                </Field>
                <Field label="Date">
                  <input type="date" className="ej-inp" value={form.declarationDate} onChange={update("declarationDate")} />
                </Field>
              </div>
            </SectionCard>

            {/* 08 Management Use Only */}
            <SectionCard number="08" icon="shield" title="Management Use Only">
              <div className="ej-mgmt-box">
                <div className="ej-mgmt-row">
                  <span className="ej-mgmt-lbl">Documents Verified:</span>
                  <div className="ej-mgmt-chips">
                    <RadioOption
                      name="documentsVerified"
                      label="Yes"
                      checked={form.documentsVerified === "yes"}
                      onChange={() => { setForm((f) => ({ ...f, documentsVerified: "yes" })); }}
                    />
                    <RadioOption
                      name="documentsVerified"
                      label="No"
                      checked={form.documentsVerified === "no"}
                      onChange={() => { setForm((f) => ({ ...f, documentsVerified: "no" })); }}
                    />
                  </div>
                </div>
                <div className="ej-mgmt-row">
                  <span className="ej-mgmt-lbl">Skill Assessment:</span>
                  <div className="ej-mgmt-chips">
                    {SKILL_LEVELS.map((level) => (
                      <RadioOption
                        key={level}
                        name="skillAssessment"
                        label={level as string}
                        checked={form.skillAssessment === level}
                        onChange={() => { setForm((f) => ({ ...f, skillAssessment: level })); }}
                      />
                    ))}
                  </div>
                </div>
                <div className="ej-mgmt-fields">
                  <div className="ej-grid">
                    <Field label="Joining Approved By">
                      <input className="ej-inp" value={form.joiningApprovedBy} onChange={update("joiningApprovedBy")} />
                    </Field>
                    <Field label="Probation Review Date">
                      <input type="date" className="ej-inp" value={form.probationReviewDate} onChange={update("probationReviewDate")} />
                    </Field>
                    <Field label="Manager Remarks">
                      <input className="ej-inp" value={form.managerRemarks} onChange={update("managerRemarks")} />
                    </Field>
                    <Field label="Manager Signature">
                      <input className="ej-inp" value={form.managerSignature} onChange={update("managerSignature")} />
                    </Field>
                  </div>
                </div>
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
                  {!form.declarationAccepted
                    ? "Please accept the declaration to submit."
                    : submitError ?? "Something went wrong — try again."}
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