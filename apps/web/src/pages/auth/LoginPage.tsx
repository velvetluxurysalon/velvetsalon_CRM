import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../../context/AuthContext";

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "admin",        label: "Admin",        desc: "Full access" },
  { value: "receptionist", label: "Receptionist", desc: "Bookings & billing" },
  { value: "staff",        label: "Staff",        desc: "Appointments only" },
];

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState<Role>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password, role);
      void navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .vl-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Jost', sans-serif;
          background: #faf8f4;
          color: #2c1f0e;
        }

        /* ── Left decorative panel ── */
        .vl-panel {
          display: none;
          flex: 1;
          position: relative;
          background: #1a1208;
          overflow: hidden;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }
        @media (min-width: 900px) { .vl-panel { display: flex; } }

        .vl-panel-bg {
          position: absolute; inset: 0;
          background:
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 40px,
              rgba(212,175,55,0.04) 40px,
              rgba(212,175,55,0.04) 41px
            );
        }

        .vl-panel-glow {
          position: absolute;
          width: 420px; height: 420px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .vl-panel-content {
          position: relative; z-index: 1;
          text-align: center;
          padding: 3rem;
          animation: vl-fadeUp 0.9s ease both;
        }

        .vl-logo-wrap {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 2.5rem;
        }
        .vl-logo-icon {
          width: 48px; height: 48px;
          border: 1px solid rgba(212,175,55,0.5);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #d4af37;
        }
        .vl-logo-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px;
          font-weight: 300;
          letter-spacing: 0.3em;
          color: #f5ecd4;
          text-transform: uppercase;
        }

        .vl-tagline {
          font-family: 'Cormorant Garamond', serif;
          font-size: 44px;
          font-weight: 300;
          line-height: 1.2;
          color: #f5ecd4;
          margin-bottom: 1rem;
        }
        .vl-tagline em { font-style: italic; color: #d4af37; }

        .vl-sub {
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0.12em;
          color: rgba(245,236,212,0.45);
          text-transform: uppercase;
          margin-bottom: 3rem;
        }

        .vl-divider {
          width: 60px; height: 1px;
          background: linear-gradient(90deg, transparent, #d4af37, transparent);
          margin: 0 auto 3rem;
        }

        .vl-features { list-style: none; display: flex; flex-direction: column; gap: 14px; text-align: left; }
        .vl-features li {
          display: flex; align-items: center; gap: 12px;
          font-size: 13px; font-weight: 300; letter-spacing: 0.06em;
          color: rgba(245,236,212,0.6);
        }
        .vl-feat-dot { width: 5px; height: 5px; border-radius: 50%; background: #d4af37; flex-shrink: 0; }

        /* ── Right form side ── */
        .vl-form-side {
          flex: 0 0 100%;
          display: flex; align-items: center; justify-content: center;
          padding: 2rem 1.5rem;
          animation: vl-fadeUp 0.7s ease both;
        }
        @media (min-width: 900px) { .vl-form-side { flex: 0 0 480px; } }

        .vl-form-card { width: 100%; max-width: 400px; }

        .vl-form-header { margin-bottom: 2.5rem; }
        .vl-form-eyebrow {
          font-size: 11px; font-weight: 500; letter-spacing: 0.2em;
          text-transform: uppercase; color: #b8860b; margin-bottom: 10px;
        }
        .vl-form-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 38px; font-weight: 300; line-height: 1.1; color: #1a1208;
        }
        .vl-form-title em { font-style: italic; color: #b8860b; }

        /* ── Role selector ── */
        .vl-roles { display: flex; gap: 8px; margin-bottom: 2rem; }
        .vl-role-btn {
          flex: 1;
          border: 1px solid #e0d5c0; background: #fff; border-radius: 8px;
          padding: 10px 6px; cursor: pointer; text-align: center;
          transition: all 0.2s ease; font-family: 'Jost', sans-serif;
        }
        .vl-role-btn:hover { border-color: #d4af37; background: #fffdf5; }
        .vl-role-btn.active {
          border-color: #d4af37; background: #fffdf5;
          box-shadow: inset 0 0 0 1px #d4af37;
        }
        .vl-role-label { font-size: 12px; font-weight: 500; color: #2c1f0e; display: block; margin-bottom: 2px; }
        .vl-role-desc { font-size: 10px; font-weight: 300; color: #8a7560; display: block; letter-spacing: 0.04em; }

        /* ── Fields ── */
        .vl-field { margin-bottom: 1.25rem; }
        .vl-label {
          display: block; font-size: 11px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase; color: #6b5740; margin-bottom: 8px;
        }
        .vl-input-wrap { position: relative; }
        .vl-input {
          width: 100%; height: 48px;
          border: 1px solid #e0d5c0; border-radius: 8px; background: #fff;
          padding: 0 16px;
          font-family: 'Jost', sans-serif; font-size: 14px; font-weight: 300; color: #2c1f0e;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .vl-input:focus { border-color: #d4af37; box-shadow: 0 0 0 3px rgba(212,175,55,0.12); }
        .vl-input::placeholder { color: #c5b89a; }
        .vl-input.has-icon { padding-right: 44px; }

        .vl-eye-btn {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #8a7560;
          padding: 4px; display: flex; transition: color 0.2s;
        }
        .vl-eye-btn:hover { color: #b8860b; }

        /* ── Error ── */
        .vl-error {
          display: flex; align-items: center; gap: 8px;
          background: #fff5f5; border: 1px solid #f5c6c6; border-radius: 8px;
          padding: 10px 14px; font-size: 13px; color: #c0392b;
          margin-bottom: 1.25rem; animation: vl-shake 0.3s ease;
        }

        /* ── Forgot ── */
        .vl-forgot { text-align: right; margin-bottom: 1.5rem; }
        .vl-forgot a {
          font-size: 12px; font-weight: 300; color: #8a7560;
          text-decoration: none; letter-spacing: 0.04em; transition: color 0.2s;
        }
        .vl-forgot a:hover { color: #b8860b; }

        /* ── Submit ── */
        .vl-btn {
          width: 100%; height: 50px; border: none; border-radius: 8px;
          background: #1a1208; color: #d4af37;
          font-family: 'Jost', sans-serif; font-size: 12px; font-weight: 500;
          letter-spacing: 0.2em; text-transform: uppercase;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          gap: 10px; transition: background 0.2s, transform 0.15s;
          position: relative; overflow: hidden; margin-top: 0.5rem;
        }
        .vl-btn:hover:not(:disabled) { background: #2d2010; }
        .vl-btn:active:not(:disabled) { transform: scale(0.98); }
        .vl-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .vl-btn-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(212,175,55,0.15) 50%, transparent 60%);
          transform: translateX(-100%);
          animation: vl-shimmer 2.2s infinite;
        }

        /* ── Footer ── */
        .vl-footer {
          margin-top: 2.5rem; padding-top: 2rem;
          border-top: 1px solid #ede5d6;
          text-align: center; font-size: 11px; font-weight: 300;
          letter-spacing: 0.08em; color: #b5a48a; text-transform: uppercase;
        }
        .vl-footer span { color: #d4af37; }
        .vl-credit {
          margin-top: 6px;
          font-size: 10px;
          letter-spacing: 0.05em;
          color: #c9bda3;
        }
        .vl-credit span { color: #b8860b; }

        /* ── Spinner ── */
        .vl-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(212,175,55,0.3);
          border-top-color: #d4af37;
          border-radius: 50%;
          animation: vl-spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* ── Keyframes ── */
        @keyframes vl-fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vl-spin { to { transform: rotate(360deg); } }
        @keyframes vl-shimmer {
          0%  { transform: translateX(-100%); }
          60% { transform: translateX(100%); }
          100%{ transform: translateX(100%); }
        }
        @keyframes vl-shake {
          0%, 100% { transform: translateX(0); }
          25%       { transform: translateX(-5px); }
          75%       { transform: translateX(5px); }
        }
      `}</style>

      <div className="vl-root">

        {/* ── Left panel ── */}
        <div className="vl-panel">
          <div className="vl-panel-bg" />
          <div className="vl-panel-glow" />
          <div className="vl-panel-content">
            <div className="vl-logo-wrap">
              <div className="vl-logo-icon">
  <img src="/assets/logo.webp" alt="Velvet" className="vl-logo-img" />
</div>
              <span className="vl-logo-text">Velvet</span>
            </div>
            <h1 className="vl-tagline">
              Where beauty<br />meets <em>precision</em>
            </h1>
            <p className="vl-sub">Premium Unisex Salon</p>
            <div className="vl-divider" />
            <ul className="vl-features">
              {[
                "Smart appointment scheduling",
                "Ready billing & invoices",
                "Loyalty points & memberships",
                "Real-time staff performance",
                "WhatsApp invoice sharing",
              ].map((f) => (
                <li key={f}><span className="vl-feat-dot" />{f}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Right form ── */}
        <div className="vl-form-side">
          <div className="vl-form-card">

            <div className="vl-form-header">
              <p className="vl-form-eyebrow">Salon CRM</p>
              <h2 className="vl-form-title">Welcome<br /><em>back</em></h2>
            </div>

            <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>

              {/* Role selector */}
              <div className="vl-roles" role="group" aria-label="Select your role">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`vl-role-btn${role === r.value ? " active" : ""}`}
                    onClick={() => { setRole(r.value); }}
                    aria-pressed={role === r.value}
                  >
                    <span className="vl-role-label">{r.label}</span>
                    <span className="vl-role-desc">{r.desc}</span>
                  </button>
                ))}
              </div>

              {/* Email */}
              <div className="vl-field">
                <label htmlFor="vl-email" className="vl-label">Email address</label>
                <div className="vl-input-wrap">
                  <input
                    id="vl-email"
                    type="email"
                    className="vl-input"
                    placeholder="you@velvetcrm.in"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="vl-field">
                <label htmlFor="vl-password" className="vl-label">Password</label>
                <div className="vl-input-wrap">
                  <input
                    id="vl-password"
                    type={showPassword ? "text" : "password"}
                    className="vl-input has-icon"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); }}
                  />
                  <button
                    type="button"
                    className="vl-eye-btn"
                    onClick={() => { setShowPassword((v) => !v); }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {/* Forgot */}
              {/* <div className="vl-forgot">
                <a href="/forgot-password">Forgot password?</a>
              </div> */}

              {/* Error */}
              {error && (
                <div className="vl-error" role="alert">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="vl-btn" disabled={loading}>
                <div className="vl-btn-shimmer" />
                {loading ? (
                  <><span className="vl-spinner" />Signing in…</>
                ) : (
                  "Sign in to CRM"
                )}
              </button>

            </form>

           <div className="vl-footer">
              <span>Velvet</span> Premium Unisex Salon 
              <div className="vl-credit">
  Powered by <span>Letnext Technologies</span>
  <br />
  Developer: Krishna Suthers Raj T G B
</div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}