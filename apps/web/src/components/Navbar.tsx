import { NAV_LINKS, type Page } from "../pages/user/salonData";
import type { JSX } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

interface NavbarProps {
  scrolled: boolean;
}

// Page id -> actual route path. Keep this in sync with the routes in App.tsx.
const PAGE_ROUTES: Record<Page, string> = {
  home: "/",
  services: "/services",
  gallery: "/gallery",
  membership: "/membership-plans",
  franchise: "/franchise",
  contact: "/contact",
};

// Reverse lookup: current pathname -> which nav id should show as active.
function pageForPath(pathname: string): Page {
  const match = (Object.entries(PAGE_ROUTES) as [Page, string][]).find(
    ([, path]) => path === pathname
  );
  return match ? match[0] : "home";
}

// Map each nav link id to a simple SVG icon
const NAV_ICONS: Record<string, JSX.Element> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),
  services: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 2a5 5 0 0 1 5 5c0 2.1-1.2 3.9-3 4.7V13h1a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h1v-1a1 1 0 0 1 1-1h1v-1.3A5 5 0 0 1 7 7a5 5 0 0 1 5-5z" />
    </svg>
  ),
  staff: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  ),
  membership: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  franchise: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 21h18" />
      <path d="M5 21V8l7-4 7 4v13" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 12h.01M15 12h.01M9 8h.01M15 8h.01" />
    </svg>
  ),
  contact: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.46 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.37 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 21 16v.92z" />
    </svg>
  ),
};

export default function Navbar({ scrolled }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const page = pageForPath(location.pathname);

  const handleNav = (p: Page) => {
    void navigate(PAGE_ROUTES[p]);
  };

  return (
    <>
      {/* ── TOP NAVBAR (always visible: fixed) ─────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 px-2 sm:px-4 lg:px-6 pt-2 sm:pt-3 pointer-events-none">
        <nav
          className={[
            "pointer-events-auto max-w-[1200px] mx-auto h-14 sm:h-16 px-3 lg:px-4",
            "flex items-center gap-2 rounded-2xl border border-[#e8dfcc]",
            "bg-[#faf6ee]/90 backdrop-blur-md transition-shadow duration-300",
            scrolled
              ? "shadow-[0_10px_32px_rgba(26,18,8,0.14)]"
              : "shadow-[0_2px_12px_rgba(26,18,8,0.05)]",
          ].join(" ")}
        >
          {/* Logo */}
          <Link
            to={PAGE_ROUTES.home}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer mr-auto no-underline min-w-0"
          >
            <img
              src="/assets/logo.webp"
              alt="Velvet Premium Unisex Salon logo"
              className="h-9 sm:h-11 w-auto object-contain shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span
                className="text-[20px] sm:text-[24px] xl:text-[28px] font-semibold tracking-[0.03em] text-[#1a1208] leading-none whitespace-nowrap"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                Velvet
                <sup className="text-[11px] sm:text-[14px] align-super ml-[1px] tracking-normal">®</sup>
              </span>
              <span
                className="text-[8px] sm:text-[10px] xl:text-[11px] font-semibold tracking-[0.22em] sm:tracking-[0.26em] uppercase text-[#6b5640] mt-0.5 whitespace-nowrap"
                style={{ fontFamily: "'Jost', sans-serif" }}
              >
                Unisex Salon
              </span>
            </div>
          </Link>

          {/* Desktop links (laptop and up) */}
          <div className="hidden lg:flex items-center gap-0.5 xl:gap-1">
            {NAV_LINKS.map((l) => {
              const isActive = page === l.id;
              return (
                <Link
                  key={l.id}
                  to={PAGE_ROUTES[l.id]}
                  className={[
                    "relative h-10 px-2.5 xl:px-4 flex items-center whitespace-nowrap text-[11px] xl:text-[14px] font-semibold tracking-[0.1em] xl:tracking-[0.12em] uppercase rounded-full transition-all duration-150 cursor-pointer no-underline",
                    isActive
                      ? "text-[#1a1208] bg-white shadow-[0_1px_6px_rgba(26,18,8,0.08)]"
                      : "text-[#6b5640] hover:text-[#1a1208] hover:bg-white/60",
                  ].join(" ")}
                  style={{ fontFamily: "'Jost', sans-serif" }}
                >
                  {l.label}
                  {isActive && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#b8860b]" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Divider (laptop and up) */}
          <span className="hidden lg:block w-px h-6 bg-[#e0d6c2] mx-1 xl:mx-2" />

          {/* CTA — short label on phone/laptop, full label on large desktop */}
          <button
            className="shrink-0 h-9 sm:h-10 px-3 sm:px-4 xl:px-5 bg-[#1a1208] text-[#d4af37] text-[11px] xl:text-[13px] font-bold tracking-[0.1em] xl:tracking-[0.12em] uppercase rounded-xl hover:bg-[#2d2010] transition-colors cursor-pointer border-none whitespace-nowrap flex items-center gap-1.5"
            style={{ fontFamily: "'Jost', sans-serif" }}
            onClick={() => {
              handleNav("contact");
            }}
          >
            <span className="xl:hidden">Book Now</span>
            <span className="hidden xl:inline">Book Appointment</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 xl:w-4 xl:h-4 hidden sm:block">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </nav>
      </header>

      {/* No spacer: each page handles its own top padding (e.g. pt-[84px]), so the page background extends under the floating navbar */}

      {/* ── BOTTOM TAB BAR (phone and tablet, hidden on laptop and up) ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#faf6ee]/95 backdrop-blur-md border-t border-[#e8dfcc] shadow-[0_-4px_24px_rgba(26,18,8,0.08)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch max-w-xl mx-auto">
          {NAV_LINKS.map((l) => {
            const isActive = page === l.id;
            return (
              <Link
                key={l.id}
                to={PAGE_ROUTES[l.id]}
                className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-0.5 py-2 sm:py-2.5 bg-transparent border-none cursor-pointer relative transition-colors duration-150 no-underline"
              >
                {/* Active top indicator */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[#C8A96E]" />
                )}

                {/* Icon */}
                <span
                  className={[
                    "transition-colors duration-150",
                    isActive ? "text-[#8B5A2B]" : "text-[#9a8a78]",
                  ].join(" ")}
                >
                  {NAV_ICONS[l.id] ?? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                </span>

                {/* Label */}
                <span
                  className={[
                    "max-w-full truncate text-[9px] sm:text-[10px] font-bold tracking-[0.02em] sm:tracking-[0.08em] uppercase leading-none transition-colors duration-150",
                    isActive ? "text-[#8B5A2B]" : "text-[#9a8a78]",
                  ].join(" ")}
                  style={{ fontFamily: "'Jost', sans-serif" }}
                >
                  {l.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}