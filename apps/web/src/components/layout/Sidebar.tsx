import type { JSX } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth, type Role } from "../../context/AuthContext";

// ─── Nav items with role restrictions (unchanged) ────────────────────────────
const allNavItems = [
  { icon: "chart",     label: "Dashboard",     path: "/dashboard",     roles: ["admin", "receptionist", "staff"] },
  { icon: "calendar",  label: "Appointments",  path: "/appointments",  roles: ["admin", "receptionist"] },
  { icon: "users",     label: "Customers",     path: "/customers",     roles: ["admin", "receptionist"] },
  { icon: "receipt",   label: "Billing",       path: "/billing",       roles: ["admin", "receptionist"] },
  { icon: "rupee",     label: "Membership",    path: "/membership",    roles: ["admin", "receptionist"] },
 { icon: "star",      label: "Staff Attendance",         path: "/staff",         roles: ["admin", "receptionist", "staff"] },
   { icon: "userplus",  label: "Employee Joining", path: "/employee-joining", roles: ["admin", "receptionist", "staff"] },
   { icon: "users",     label: "Employee Records", path: "/employee-records", roles: ["admin"] },
  { icon: "menu",      label: "Inventory",     path: "/inventory",     roles: ["admin", "receptionist"] },
  { icon: "shield",    label: "Staff Roles",   path: "/roles",         roles: ["admin"] },
  { icon: "flag",      label: "Banners",       path: "/banners",       roles: ["admin", "receptionist"] },
  { icon: "clipboard", label: "Staff Reviews", path: "/staff-reviews", roles: ["admin", "receptionist"] },
  { icon: "headset",   label: "Receptionist",  path: "/receptionist",  roles: ["admin", "receptionist"] },
  { icon: "tag",       label: "Coupons",       path: "/coupons",       roles: ["admin", "receptionist"] },
];

export const roleLabel: Record<Role, string> = {
  admin:        "Administrator",
  receptionist: "Receptionist",
  staff:        "Staff Member",
};

// ─── Shared SVG Icons (used by Sidebar + DashboardPage) ──────────────────────
export const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const s = size;
  const icons: Record<string, JSX.Element> = {
    rupee:    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="4" x2="18" y2="4"/><line x1="6" y1="9" x2="18" y2="9"/><path d="M6 14l6 6 6-6"/><path d="M6 9a6 6 0 0 0 0 5h6"/></svg>,
    calendar: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    users:    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    receipt:  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg>,
    star:     <svg width={s} height={s} viewBox="0 0 24 24" fill="#d4af37" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    up:       <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
    down:     <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
    plus:     <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    scissors: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
    chart:    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    bell:     <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    menu:     <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    logout:   <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    refresh:  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
    cake:     <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2 1 3.5 1 2-1 3.5-1 2 1 3.5 1 2-1 2-1"/><line x1="12" y1="6" x2="12" y2="3"/><circle cx="12" cy="2" r="0.8"/><line x1="7" y1="8" x2="7" y2="6"/><line x1="17" y1="8" x2="17" y2="6"/></svg>,
    heart:    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>,
    crown:    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M5 20V10l7-7 7 7v10"/></svg>,
    moon:     <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
    repeat:   <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
    phone:    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>,
    check2:   <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
    shield:    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 3.5v6c0 5-3.4 8.7-8 10.5-4.6-1.8-8-5.5-8-10.5v-6L12 2z"/><path d="M9 12l2 2 4-4"/></svg>,
    flag:      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V3"/><path d="M4 4h13l-2.5 4L17 12H4"/></svg>,
   clipboard: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2"/><path d="M9 11l2 2 4-4"/><path d="M9 16h6"/></svg>,
    headset:   <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 14v4a2 2 0 0 1-2 2h-1v-7h3z"/><path d="M3 14v4a2 2 0 0 0 2 2h1v-7H3z"/></svg>,
    tag:       <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/></svg>,
    userplus:  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>,
    x:         <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  };
  return icons[name] ?? null;
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
interface SidebarProps {
  /** Expanded (true) vs collapsed (false) on desktop; shown/hidden as a drawer on mobile. */
  open: boolean;
  /** Called when the mobile backdrop is tapped, so the parent can close the drawer. Optional — desktop behavior is unaffected if omitted. */
  onClose?: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const role = user?.role ?? "staff";

  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  const initials =
    user?.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "??";

  return (
    <>
      {/* Mobile backdrop — only rendered on small screens while the drawer is open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          flex flex-col overflow-hidden bg-[#1a1208] font-['Jost',sans-serif]
          fixed inset-y-0 left-0 z-50 w-[240px] transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-10 md:translate-x-0 md:flex-shrink-0 md:transition-[width]
          ${open ? "md:w-[220px]" : "md:w-16"}
        `}
      >
       {/* Logo */}
        <div className="flex items-center gap-2.5 px-[18px] pt-6 pb-5 border-b border-[#d4af37]/15">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#d4af37]/40 overflow-hidden bg-[#1a1208]">
            <img src="/assets/logo.webp" alt="Velvet logo" className="h-full w-full object-contain" />
          </div>
          <span
            className={`overflow-hidden whitespace-nowrap text-lg font-light uppercase tracking-[0.25em] text-[#f5ecd4] transition-opacity duration-200 font-['Cormorant_Garamond',serif] ${
              open ? "opacity-100" : "w-0 opacity-0"
            }`}
          >
            Velvet
          </span>
          {/* Mobile-only close button — the drawer sits above the topbar hamburger
              on small screens, so this is the only way to close it there. */}
          <button
            className="ml-auto flex flex-shrink-0 rounded-md border-none bg-transparent p-1.5 text-[#f5ecd4]/50 transition-colors hover:bg-[#d4af37]/10 hover:text-[#d4af37] md:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-4">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-lg px-2.5 py-2.5 transition-colors ${
                active ? "bg-[#d4af37]/15" : "hover:bg-[#d4af37]/[0.08]"
              }`}
            >
              <span
                className={`flex-shrink-0 transition-colors ${
                  active ? "text-[#d4af37]" : "text-[#8a7050] group-hover:text-[#d4af37]"
                }`}
              >
                <Icon name={item.icon} size={18} />
              </span>
              <span
                className={`text-[13px] font-normal tracking-[0.04em] transition-opacity duration-200 ${
                  active ? "text-[#f5ecd4]" : "text-[#f5ecd4]/60"
                } ${open ? "opacity-100" : "w-0 opacity-0"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

     {/* User info + logout */}
        <div className="flex items-center gap-2.5 overflow-hidden border-t border-[#d4af37]/[0.12] px-3 py-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#d4af37]/20 text-[11px] font-medium tracking-[0.05em] text-[#d4af37]">
            {initials}
          </div>
          {open && (
            <>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-[#f5ecd4]">
                  {user?.name ?? "User"}
                </div>
                <div className="text-[10px] font-light uppercase tracking-[0.08em] text-[#f5ecd4]/40">
                  {roleLabel[role]}
                </div>
              </div>
              <button
                className="flex flex-shrink-0 rounded-md border-none bg-transparent p-1 text-[#f5ecd4]/30 transition-colors hover:bg-[#d4af37]/10 hover:text-[#d4af37]"
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
              >
                <Icon name="logout" size={15} />
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}