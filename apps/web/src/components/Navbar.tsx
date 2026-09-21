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
      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <nav
        className={[
          "sticky top-0 z-50 bg-white border-b border-[#ede5d6] transition-shadow duration-300",
          scrolled ? "shadow-[0_4px_24px_rgba(26,18,8,0.08)]" : "",
        ].join(" ")}
      >
       <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-16 flex items-center gap-2">

 {/* Logo */}
  <Link
    to={PAGE_ROUTES.home}
    className="flex items-center gap-2.5 cursor-pointer mr-auto no-underline min-w-0"
  >
            <img
              src="/assets/logo.webp"
              alt="Velvet Premium Unisex Salon logo"
              className="w-15 h-20 object-contain shrink-0"
            />
            <div className="flex flex-col">
                           <span
                className="text-[22px] font-light tracking-[0.04em] text-[#1a1208] leading-none"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                Velvet
                <sup className="text-[13px] align-super ml-[1px] tracking-normal">®</sup>
              </span>
              <span
                className="text-[9px] font-medium tracking-[0.28em] uppercase text-[#8a7560] mt-0.5"
                style={{ fontFamily: "'Jost', sans-serif" }}
              >
                Unisex Salon
              </span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.id}
                to={PAGE_ROUTES[l.id]}
                className={[
                  "relative h-9 px-3.5 flex items-center text-[11px] font-medium tracking-[0.14em] uppercase rounded-lg transition-all duration-150 cursor-pointer no-underline",
                  page === l.id
                    ? "text-[#1a1208]"
                    : "text-[#8a7560] hover:text-[#1a1208] hover:bg-[#f5f0e8]",
                ].join(" ")}
                style={{ fontFamily: "'Jost', sans-serif" }}
              >
                {l.label}
                {page === l.id && (
                  <span className="absolute bottom-1.5 left-3.5 right-3.5 h-[1.5px] bg-[#b8860b] rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          {/* CTA — visible on desktop and mobile */}
  {/* CTA — visible on desktop and mobile */}
  <button
    className="shrink-0 h-9 px-2.5 md:px-[18px] bg-[#1a1208] text-[#d4af37] text-[9px] md:text-[11px] font-medium tracking-[0.14em] uppercase rounded-lg hover:bg-[#2d2010] transition-colors cursor-pointer border-none whitespace-nowrap"
    style={{ fontFamily: "'Jost', sans-serif" }}
    onClick={() => { handleNav("contact"); }}
  >
    Book Appointment
  </button>

  {/* Mobile: show current page title only */}
  <span
    className="md:hidden shrink-0 text-[11px] font-medium tracking-[0.14em] uppercase text-[#8a7560]"
    style={{ fontFamily: "'Jost', sans-serif" }}
  >
    {NAV_LINKS.find((l) => l.id === page)?.label ?? ""}
  </span>
</div>
      </nav>

      {/* ── MOBILE BOTTOM TAB BAR ──────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#ede5d6] shadow-[0_-4px_24px_rgba(26,18,8,0.08)]">
        <div className="flex items-stretch">
          {NAV_LINKS.map((l) => {
            const isActive = page === l.id;
            return (
              <Link
                key={l.id}
                to={PAGE_ROUTES[l.id]}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 bg-transparent border-none cursor-pointer relative transition-colors duration-150 no-underline"
              >
                {/* Active top indicator */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[#C8A96E]" />
                )}

                {/* Icon */}
                <span
                  className={[
                    "transition-colors duration-150",
                    isActive ? "text-[#8B5A2B]" : "text-[#b0a090]",
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
                    "text-[9px] font-medium tracking-[0.1em] uppercase leading-none transition-colors duration-150",
                    isActive ? "text-[#8B5A2B]" : "text-[#b0a090]",
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

      {/* Spacer so content isn't hidden behind bottom tab bar on mobile */}
      {/* <div className="md:hidden h-[62px]" /> */}
    </>
  );
}