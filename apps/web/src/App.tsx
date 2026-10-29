import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import OfflinePage, { useOnlineStatus } from './pages/user/OfflinePage';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { Page } from './pages/user/salonData';

// ── Auth (loaded up-front so the login page appears fast) ─────────────────────
import LoginPage from './pages/auth/LoginPage';

// ── Everything else loads on demand (code-splitting) ──────────────────────────
const UserLayout = lazy(() => import('./pages/user/UserLayout'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const AppointmentsPage = lazy(() => import('./pages/appointments/AppointmentsPage'));
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage'));
const BillingPage = lazy(() => import('./pages/bill/Billingpage'));
const AttendancePage = lazy(() => import('./pages/attendance/AttendancePage'));
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'));
const MembershipPage = lazy(() => import('./pages/membership/MembershipPage'));
const Staffrole = lazy(() => import('./pages/staff/Staffrole'));
const BannerPage = lazy(() => import('./pages/banner/Banner'));
const EmployeeJoiningPage = lazy(() => import('./pages/staff/EmployeeJoiningPage'));
const EmployeeRecordsPage = lazy(() => import('./pages/staff/EmployeeRecordsPage'));
const StaffreviewPage = lazy(() => import('./pages/staff/Staffreview'));
const ReceptionistPage = lazy(() => import('./pages/receptionattendance/ReceptionPage'));
const DailyExpensesPage = lazy(() => import('./pages/expenses/DailyExpensesPage'));
// ── Public Salon Website Pages ────────────────────────────────────────────────
// ServicesPage/GalleryPage/ContactPage are self-contained (no props, internal
// useNavigate()) — render them directly. HomePage still needs external
// `navigate` + `setActiveCat` props (see HomePageProps) — kept via HomePageRoute.
const HomePage = lazy(() => import('./pages/user/HomePage'));
const ServicesPage = lazy(() => import('./pages/user/ServicesPage'));
const GalleryPage = lazy(() => import('./pages/user/GalleryPage'));
const Membershippage = lazy(() => import('./pages/user/Membershippage'));
const ContactPage = lazy(() => import('./pages/user/ContactPage'));
const CouponsPage = lazy(() => import('./pages/CouponsPage'));
const PageNotFound = lazy(() => import('./pages/user/PageNotFound'));
const Chatbot = lazy(() => import('./components/Chatbot'));
// import InstagramBot from "./components/InstagramBot";
const FranchisePage = lazy(() => import('./pages/user/FranchisePage'));

// ── Placeholder ───────────────────────────────────────────────────────────────
const Placeholder = ({ page }: { page: string }) => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Jost', sans-serif",
      fontSize: 15,
      color: '#8a7560',
      letterSpacing: '0.06em',
      background: '#faf8f4',
    }}
  >
    {page} — coming soon
  </div>
);

// ── Page → URL map (used only by HomePage, which still needs a navigate prop) ─
const PAGE_ROUTES: Record<Page, string> = {
  home: '/',
  services: '/services',
  gallery: '/gallery',
  membership: '/membership-plans',
  franchise: '/franchise',
  contact: '/contact',
};

// HomePage still requires external props (per HomePageProps: navigate + setActiveCat)
function HomePageRoute() {
  const nav = useNavigate();
  const [, setActiveCat] = useState(0);
  return (
    <HomePage
      navigate={(p: Page) => {
        void nav(PAGE_ROUTES[p]);
      }}
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
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#faf8f4' }} />}>
          <Routes>
            {/* ── Public Salon Website (wrapped in UserLayout for Navbar + Footer) ── */}
            <Route element={<UserLayoutWithChatbot />}>
              <Route path="/" element={<HomePageRoute />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/franchise" element={<FranchisePage />} />
              <Route path="/membership-plans" element={<Membershippage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Route>
            {/* ── Admin employee-joining page  ── */}
            <Route path="/employee-joining" element={<EmployeeJoiningPage />} />
            {/* ── Auth ── */}
            <Route path="/login" element={<LoginPage />} />

            {/* ── CRM: Any authenticated user ── */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/staff" element={<AttendancePage />} />
              <Route path="/membership" element={<MembershipPage />} />
              <Route path="/banners" element={<BannerPage />} />
              <Route path="/staff-reviews" element={<StaffreviewPage />} />
              <Route path="/receptionist" element={<ReceptionistPage />} />
              <Route path="/coupons" element={<CouponsPage />} />
              <Route path="/dailyexpenses" element={<DailyExpensesPage />} />
              <Route path="/reports" element={<Placeholder page="Reports" />} />
            </Route>

            {/* ── CRM: Admin only ── */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/users" element={<Placeholder page="Users" />} />
              <Route path="/roles" element={<Staffrole />} />
              <Route path="/employee-records" element={<EmployeeRecordsPage />} />
            </Route>

            {/* ── Catch-all ── */}
            {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
