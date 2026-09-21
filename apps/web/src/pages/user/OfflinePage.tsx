import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MotionStyle } from "framer-motion";

/**
 * OfflinePage
 * Full-screen "no internet connection" state for Velvet Premium Unisex Salon.
 * Detects browser connectivity live and auto-recovers when the network returns.
 *
 * Usage: render this in place of your app shell when `navigator.onLine` is
 * false, or mount it globally and let it show/hide itself via the hook below.
 */

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => { setIsOnline(true); };
const goOffline = () => { setIsOnline(false); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}

interface OfflinePageProps {
  onRetry?: () => void;
}

export default function OfflinePage({ onRetry }: OfflinePageProps) {
  const isOnline = useOnlineStatus();
  const [checking, setChecking] = useState(false);
  const [pulse, setPulse] = useState(0);

  // Gentle ambient pulse on the comb icon while offline — signals "waiting", not "broken"
  useEffect(() => {
    if (isOnline) return;
    const id = setInterval(() => { setPulse((p) => p + 1); }, 2400);
return () => { clearInterval(id); };
  }, [isOnline]);

  const handleRetry = useCallback(() => {
    setChecking(true);
    window.setTimeout(() => {
  setChecking(false);
  if (navigator.onLine) {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  }
}, 700);
  }, [onRetry]);

  // Auto-recover the moment the browser reports a connection again
 useEffect(() => {
  if (isOnline) {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  }
}, [isOnline, onRetry]);

  if (isOnline) return null;

  return (
    <div style={styles.page}>
      <style>{fontImports}</style>

      <div style={styles.card}>
                <motion.div
          key={pulse}
          initial={{ scale: 0.94, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={styles.iconWrap as MotionStyle}
        >
          <CombIcon />
        </motion.div>

        <p style={styles.eyebrow}>Velvet Premium Unisex Salon</p>
        <h1 style={styles.heading}>You've lost connection</h1>
        <p style={styles.body}>
          Your bookings and bills are saved — we just can't reach the salon
          right now. Check your Wi-Fi or mobile data, then try again.
        </p>

        <button
          style={{
            ...styles.button,
            ...(checking ? styles.buttonDisabled : {}),
          }}
          onClick={handleRetry}
          disabled={checking}
        >
          {checking ? "Checking connection…" : "Try again"}
        </button>

        <AnimatePresence>
          {checking && (
                       <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={styles.status as MotionStyle}
            >
              Reconnecting to Velvet…
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CombIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect
        x="10"
        y="14"
        width="36"
        height="10"
        rx="3"
        stroke="#8B5A2B"
        strokeWidth="2"
      />
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={i}
          x1={14 + i * 4}
          y1="24"
          x2={14 + i * 4}
          y2="42"
          stroke="#C8A96E"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      <line
        x1="8"
        y1="47"
        x2="48"
        y2="9"
        stroke="#2C1810"
        strokeWidth="1.5"
        strokeDasharray="1 5"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

const fontImports = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@400;500&display=swap');
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#FAF7F2",
    padding: 24,
  },
  card: {
    maxWidth: 420,
    width: "100%",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: "50%",
    background: "#FFFFFF",
    border: "1px solid rgba(200,169,110,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    boxShadow: "0 8px 24px rgba(44,24,16,0.06)",
  },
  eyebrow: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 12,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#8B5A2B",
    marginBottom: 10,
  },
  heading: {
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: 600,
    fontSize: 32,
    color: "#2C1810",
    margin: "0 0 12px",
  },
  body: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 15,
    lineHeight: 1.6,
    color: "#5A4636",
    margin: "0 0 28px",
  },
  button: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: "0.04em",
    color: "#FAF7F2",
    background: "#2C1810",
    border: "none",
    borderRadius: 4,
    padding: "13px 32px",
    cursor: "pointer",
    transition: "background 0.2s ease",
  },
  buttonDisabled: {
    background: "#8B5A2B",
    cursor: "default",
  },
  status: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 13,
    color: "#8B5A2B",
    marginTop: 16,
  },
};