# Velvet


## Quick Start

```bash
# Install dependencies
pnpm install

# Start both dev servers (web :5173 + api :3001)
pnpm dev

# Run unit tests
pnpm test

# Run Playwright E2E tests
pnpm test:e2e

# Format + lint
pnpm format
pnpm lint

# Type check
pnpm typecheck
```

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 · Vite 7 · Tailwind CSS 4 · shadcn/ui |
| Backend | Node.js 20 · Express 5 · TypeScript 5 |
| Testing | Vitest 4 (unit) · Playwright 1.58 (e2e) |
| Quality | ESLint 9 · Prettier 3 · Husky 9 · Commitlint |

## Workspace Structure

```
Velvet/
├── apps/web/    ← React frontend
├── apps/api/    ← Express backend
└── package.json ← root scripts + workspace tooling
```

## Commit Convention

This project uses [Conventional Commits](https://conventionalcommits.org).

```
feat(web): add login page
fix(api): prevent duplicate order creation
docs: update README
chore: upgrade dependencies
```

## License

UNLICENSED — Proprietary. All rights reserved.


# Velvet Premium Unisex Salon CRM — Full Architecture

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React + TypeScript + Vite           |
| Backend     | Node.js + Express + TypeScript      |
| Database    | MongoDB + Mongoose                  |
| Auth        | JWT (access token, 8h expiry)       |
| File Export | SheetJS (xlsx), jsPDF               |
| WhatsApp    | Twilio / WA Business API            |
| SMS         | Twilio / MSG91                      |
| Hosting     | Vercel (web) + Railway (api)        |

---

## Folder Structure

```
velvet/
├── apps/
│   ├── api/                          # Express backend
│   │   └── src/
│   │       ├── models/
│   │       │   ├── user.model.ts
│   │       │   ├── customer.model.ts
│   │       │   ├── appointment.model.ts
│   │       │   ├── invoice.model.ts
│   │       │   ├── membership.model.ts
│   │       │   ├── membership-plan.model.ts
│   │       │   ├── staff-attendance.model.ts
│   │       │   ├── staff-salary.model.ts
│   │       │   ├── inventory.model.ts
│   │       │   ├── expense.model.ts
│   │       │   └── referral.model.ts
│   │       ├── routes/
│   │       │   ├── auth.router.ts
│   │       │   ├── customer.router.ts
│   │       │   ├── appointment.router.ts
│   │       │   ├── invoice.router.ts
│   │       │   ├── membership.router.ts
│   │       │   ├── staff.router.ts
│   │       │   ├── inventory.router.ts
│   │       │   ├── expense.router.ts
│   │       │   ├── dashboard.router.ts
│   │       │   └── report.router.ts
│   │       ├── middleware/
│   │       │   ├── auth.middleware.ts   # JWT verify
│   │       │   └── role.middleware.ts   # Role guard
│   │       ├── services/
│   │       │   ├── whatsapp.service.ts
│   │       │   └── sms.service.ts
│   │       ├── seed/
│   │       │   └── seed.ts
│   │       ├── app.ts
│   │       └── index.ts
│   │
│   └── web/                          # React frontend
│       └── src/
│           ├── context/
│           │   └── AuthContext.tsx
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── DashboardPage.tsx
│           │   ├── customers/
│           │   │   ├── CustomerListPage.tsx
│           │   │   └── CustomerDetailPage.tsx
│           │   ├── appointments/
│           │   │   ├── AppointmentListPage.tsx
│           │   │   └── AppointmentCalendarPage.tsx
│           │   ├── billing/
│           │   │   ├── BillingPage.tsx
│           │   │   └── InvoicePage.tsx
│           │   ├── membership/
│           │   │   └── MembershipPage.tsx
│           │   ├── staff/
│           │   │   ├── StaffPage.tsx
│           │   │   └── AttendancePage.tsx
│           │   ├── inventory/
│           │   │   └── InventoryPage.tsx
│           │   └── reports/
│           │       └── ReportsPage.tsx
│           ├── components/
│           │   ├── Layout.tsx          # Sidebar + topbar wrapper
│           │   ├── ProtectedRoute.tsx
│           │   └── ui/                 # Shared UI components
│           ├── hooks/
│           │   ├── useApi.ts           # Generic fetch hook
│           │   └── useDashboard.ts
│           └── lib/
│               └── api.ts             # Centralized API client
```

---

## Database Models

### User
```
_id, name, email, password(hashed), role, isActive, phone,
createdAt, updatedAt
```

### Customer
```
_id, name, phone, email, gender, dob,
loyaltyPoints, walletBalance, referralCode,
referredBy(→Customer), membershipId(→Membership),
visitCount, totalSpent, notes,
createdAt, updatedAt
```

### Appointment
```
_id, customerId(→Customer), staffId(→User),
services[{name, price, duration}],
date, timeSlot, status(booked/confirmed/in-progress/completed/cancelled),
isWalkIn, notes, reminderSent,
createdAt, updatedAt
```

### Invoice
```
_id, invoiceNumber, customerId(→Customer),
appointmentId(→Appointment),
items[{name, qty, price, gstRate, gstAmount}],
subtotal, discountType, discountValue, discountAmount,
gstTotal, total, paymentMethod(cash/card/upi/wallet),
paymentStatus(paid/pending/partial), paidAmount,
gstNumber, notes,
createdAt, updatedAt
```

### MembershipPlan
```
_id, name, price, validityDays,
benefits[{service, discountPercent}],
freeServices[{name, count}],
isActive,
createdAt, updatedAt
```

### Membership
```
_id, customerId(→Customer), planId(→MembershipPlan),
startDate, endDate, status(active/expired/cancelled),
servicesUsed[{name, count}],
createdAt, updatedAt
```

### StaffAttendance
```
_id, staffId(→User), date, checkIn, checkOut,
status(present/absent/half-day/leave),
notes,
createdAt, updatedAt
```

### StaffSalary
```
_id, staffId(→User), month, year,
baseSalary, incentives, deductions,
totalServices, totalRevenue, commissionRate, commissionAmount,
netSalary, isPaid, paidOn,
createdAt, updatedAt
```

### Inventory
```
_id, name, category, brand, unit,
currentStock, minStock, purchasePrice, sellingPrice,
supplier, notes,
createdAt, updatedAt
```

### Expense
```
_id, category(rent/salary/utilities/supplies/other),
amount, date, description, paidBy,
createdAt, updatedAt
```

### Referral
```
_id, referrerId(→Customer), refereeId(→Customer),
rewardPoints, status(pending/rewarded),
createdAt
```

---

## API Routes

### Auth
```
POST   /api/auth/login
POST   /api/auth/logout
```

### Dashboard
```
GET    /api/dashboard/summary       # today sales, counts
GET    /api/dashboard/revenue       # weekly/monthly chart data
GET    /api/dashboard/staff-performance
```

### Customers
```
GET    /api/customers               # list + search + filter
POST   /api/customers               # create
GET    /api/customers/:id           # detail + history
PUT    /api/customers/:id           # update
DELETE /api/customers/:id           # soft delete
GET    /api/customers/:id/visits    # visit history
POST   /api/customers/:id/loyalty   # add/deduct points
```

### Appointments
```
GET    /api/appointments            # list (filter by date/staff/status)
POST   /api/appointments            # book
GET    /api/appointments/:id
PUT    /api/appointments/:id        # update/reschedule
PATCH  /api/appointments/:id/status # confirm/complete/cancel
POST   /api/appointments/walk-in    # walk-in entry
```

### Billing
```
GET    /api/invoices                # list
POST   /api/invoices                # create invoice
GET    /api/invoices/:id
PUT    /api/invoices/:id
GET    /api/invoices/:id/pdf        # generate PDF
POST   /api/invoices/:id/whatsapp   # send via WhatsApp
```

### Membership
```
GET    /api/membership-plans
POST   /api/membership-plans
PUT    /api/membership-plans/:id
GET    /api/memberships             # all active memberships
POST   /api/memberships             # assign to customer
PUT    /api/memberships/:id
```

### Staff
```
GET    /api/staff                   # list all staff
GET    /api/staff/:id/performance
GET    /api/attendance              # filter by date/staff
POST   /api/attendance              # mark attendance
PUT    /api/attendance/:id
GET    /api/salary                  # filter by month/staff
POST   /api/salary                  # generate salary
PUT    /api/salary/:id/pay          # mark as paid
```

### Inventory
```
GET    /api/inventory
POST   /api/inventory
PUT    /api/inventory/:id
PATCH  /api/inventory/:id/stock     # add/deduct stock
GET    /api/inventory/low-stock     # items below minStock
```

### Reports
```
GET    /api/reports/daily           # ?date=
GET    /api/reports/monthly         # ?month=&year=
GET    /api/reports/gst             # ?from=&to=
GET    /api/reports/expenses        # ?from=&to=
GET    /api/reports/export          # returns xlsx
```

---

## Role Permissions

| Feature              | Admin | Receptionist | Staff |
|----------------------|-------|--------------|-------|
| Dashboard (full)     | ✅    | ✅           | own only |
| Customers (all)      | ✅    | ✅           | ❌    |
| Appointments (all)   | ✅    | ✅           | own only |
| Billing              | ✅    | ✅           | ❌    |
| Membership           | ✅    | ✅           | ❌    |
| Staff management     | ✅    | ❌           | ❌    |
| Inventory            | ✅    | ❌           | ❌    |
| Reports              | ✅    | view only    | ❌    |
| User management      | ✅    | ❌           | ❌    |

---

## Build Order (Recommended)

Build in this sequence so each layer depends on what's already working:

```
Phase 1 — Foundation
  ✅ Auth (done)
  ✅ User model (done)
  → Middleware (JWT verify + role guard)
  → Layout component (shared sidebar/topbar)
  → ProtectedRoute

Phase 2 — Core Operations
  → Customer model + CRUD API + frontend pages
  → Appointment model + CRUD API + calendar view
  → Dashboard API (real data) + updated DashboardPage

Phase 3 — Billing
  → Invoice model + GST billing API
  → POS / billing page
  → PDF generation
  → WhatsApp invoice sharing

Phase 4 — Staff & Membership
  → Membership plans + assignment
  → Loyalty points + wallet
  → Attendance + salary + commission

Phase 5 — Operations
  → Inventory management
  → Expense tracking
  → Reports + export (Excel/CSV)

Phase 6 — Polish
  → Mobile responsive
  → WhatsApp/SMS reminders
  → Low stock alerts
```

---

## What to build next

Tell me which phase to start and I'll generate all files for it:

- **"Build Phase 2"** → Customer model, API routes, list/detail pages, Appointment model, calendar, real dashboard data
- **"Build Phase 3"** → GST billing, invoice, PDF, WhatsApp
- **"Build middleware"** → JWT auth middleware + role guards for all routes
- **"Build a specific feature"** → name it and I'll build just that

---

*Generated for Velvet Premium Unisex Salon CRM — v1.0*