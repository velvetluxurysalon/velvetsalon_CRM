import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import OfflinePage, { useOnlineStatus } from "./pages/user/OfflinePage";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import UserLayout from "./pages/user/UserLayout";
import { Page } from "./pages/user/salonData";

// ── Auth ──────────────────────────────────────────────────────────────────────
import LoginPage from "./pages/auth/LoginPage";

// ── CRM Pages (protected) ─────────────────────────────────────────────────────
import DashboardPage    from "./pages/dashboard/DashboardPage";
import AppointmentsPage from "./pages/appointments/AppointmentsPage";
import CustomersPage    from "./pages/customers/CustomersPage";
import BillingPage      from "./pages/bill/Billingpage";
import AttendancePage   from "./pages/attendance/AttendancePage";
import InventoryPage    from "./pages/inventory/InventoryPage";
import MembershipPage   from "./pages/membership/MembershipPage";
import Staffrole        from "./pages/staff/Staffrole";
import BannerPage from "./pages/banner/Banner";
import EmployeeJoiningPage from "./pages/staff/EmployeeJoiningPage";
import EmployeeRecordsPage from "./pages/staff/EmployeeRecordsPage";
import StaffreviewPage from "./pages/staff/Staffreview";
import ReceptionistPage from "./pages/receptionattendance/ReceptionPage";
// ── Public Salon Website Pages ────────────────────────────────────────────────
// ServicesPage/GalleryPage/ContactPage are self-contained (no props, internal
// useNavigate()) — render them directly. HomePage still needs external
// `navigate` + `setActiveCat` props (see HomePageProps) — kept via HomePageRoute.
import HomePage        from "./pages/user/HomePage";
import ServicesPage    from "./pages/user/ServicesPage";
import GalleryPage     from "./pages/user/GalleryPage";
import Membershippage  from "./pages/user/Membershippage";
import ContactPage     from "./pages/user/ContactPage";
import CouponsPage from "./pages/CouponsPage";
import PageNotFound from "./pages/user/PageNotFound";
import Chatbot from "./components/Chatbot";
// import InstagramBot from "./components/InstagramBot";
import FranchisePage from "./pages/user/FranchisePage";


// ── Placeholder ───────────────────────────────────────────────────────────────
const Placeholder = ({ page }: { page: string }) => (
  <div style={{
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Jost', sans-serif", fontSize: 15, color: "#8a7560", letterSpacing: "0.06em",
    background: "#faf8f4",
  }}>
    {page} — coming soon
  </div>
);

// ── Page → URL map (used only by HomePage, which still needs a navigate prop) ─
const PAGE_ROUTES: Record<Page, string> = {
  home:     "/",
  services: "/services",
  gallery:  "/gallery",
  membership: "/membership-plans",
  franchise: "/franchise",
  contact:  "/contact",
};

// HomePage still requires external props (per HomePageProps: navigate + setActiveCat)
function HomePageRoute() {
  const nav = useNavigate();
  const [, setActiveCat] = useState(0);
  return (
    <HomePage
      navigate={(p: Page) => { void nav(PAGE_ROUTES[p]); }}
      setActiveCat={setActiveCat}
    />
  );
}

// UserLayout + Chatbot together, used only for the public salon route group
// so the WhatsApp widget never shows on CRM/admin/login pages.
function UserLayoutWithChatbot() {
  return (
    <>
      <UserLayout />
      <Chatbot />
      {/* <InstagramBot /> */}
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const isOnline = useOnlineStatus();
  if (!isOnline) return <OfflinePage onRetry={() => {}} />;

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Public Salon Website (wrapped in UserLayout for Navbar + Footer) ── */}
          <Route element={<UserLayoutWithChatbot />}>
           <Route path="/"           element={<HomePageRoute />} />
            <Route path="/services"   element={<ServicesPage />} />
            <Route path="/gallery"    element={<GalleryPage />} />
            <Route path="/franchise" element={<FranchisePage />} />
            <Route path="/membership-plans" element={<Membershippage />} />
            <Route path="/contact"    element={<ContactPage />} />
            
          </Route>
           {/* ── Admin employee-joining page  ── */}
          <Route path="/employee-joining" element={<EmployeeJoiningPage />} />
          {/* ── Auth ── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── CRM: Any authenticated user ── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard"    element={<DashboardPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/customers"    element={<CustomersPage />} />
            <Route path="/billing"      element={<BillingPage />} />
            <Route path="/inventory"    element={<InventoryPage />} />
            <Route path="/staff"        element={<AttendancePage />} />
            <Route path="/membership"   element={<MembershipPage />} />
            <Route path="/banners" element={<BannerPage />} />
            <Route path="/staff-reviews" element={<StaffreviewPage />} />
            <Route path="/receptionist" element={<ReceptionistPage />} />
            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/reports"      element={<Placeholder page="Reports" />} />
          </Route>

          {/* ── CRM: Admin only ── */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/users" element={<Placeholder page="Users" />} />
            <Route path="/roles" element={<Staffrole />} />
            <Route path="/employee-records" element={<EmployeeRecordsPage />} />
          </Route>

          {/* ── Catch-all ── */}
          {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}