import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.router.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.router.js';
import appointmentRouter from './routes/appointment.router.js';
import customerRouter from './routes/customer.routes.js';
import billRoutes from './routes/bill.routes.js';
import portalRouter from './routes/portal.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import staffRouter from './routes/staff.routes.js';
import employeeJoiningRouter from './routes/employeeJoining.routes.js';
import salaryRouter from './routes/salary.routes.js';
import inventoryRouter from './routes/inventory.routes.js';
import serviceMapRouter from './routes/serviceMap.routes.js';

import staffRoleRouter from './routes/staffRole.routes.js';
import bannerRoutes from './routes/banner.routes.js';
import membershipRoutes from './routes/membership.routes.js';
import {
  shiftAttendanceRouter,
  shiftDefinitionRouter,
} from './routes/shiftAttendance.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import publicInvoiceRouter from './routes/publicInvoice.routes.js';


dotenv.config();

export const app = express();

// Middleware
const allowedOrigins = (
  process.env.CORS_ORIGINS ??
  process.env.CLIENT_URL ??
  'http://localhost:5173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow no-origin requests (curl, server-to-server, health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/customers', customerRouter);
app.use('/api/bills', billRoutes);
app.use('/api/portal', portalRouter);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/staff', staffRouter);
app.use('/api/employee-joining', employeeJoiningRouter);
app.use('/api/salary', salaryRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/staff-roles', staffRoleRouter);
app.use('/api/banners', bannerRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/shifts', shiftDefinitionRouter);
app.use('/api/shift-attendance', shiftAttendanceRouter);
app.use('/api/coupons', couponRoutes);
app.use('/api/service-map', serviceMapRouter);
app.use('/api/public', publicInvoiceRouter);
// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use(errorHandler);