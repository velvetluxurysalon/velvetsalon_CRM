import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize }    from '../middleware/role.middleware.js';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addVisit,
  addServiceRecord,
  addReferral,
  updateReferralStatus,
  adjustLoyaltyPoints,
  updateMembership,
} from '../controllers/customer.controller.js';

const router = Router();

// All customer routes require authentication
router.use(authenticate);

// ─── Customer CRUD ────────────────────────────────────────────────────────────
router.get   ('/',    authorize('admin', 'receptionist', 'staff'), getCustomers);
router.get   ('/:id', authorize('admin', 'receptionist', 'staff'), getCustomerById);
router.post  ('/',    authorize('admin', 'receptionist'),          createCustomer);
router.put   ('/:id', authorize('admin', 'receptionist'),          updateCustomer);
router.delete('/:id', authorize('admin'),                          deleteCustomer);

// ─── Visit history ────────────────────────────────────────────────────────────
router.post('/:id/visits', authorize('admin', 'receptionist', 'staff'), addVisit);

// ─── Service history ──────────────────────────────────────────────────────────
router.post('/:id/services', authorize('admin', 'receptionist', 'staff'), addServiceRecord);

// ─── Referrals ────────────────────────────────────────────────────────────────
router.post ('/:id/referrals',                    authorize('admin', 'receptionist'), addReferral);
router.patch('/:id/referrals/:referralId/status', authorize('admin', 'receptionist'), updateReferralStatus);

// ─── Loyalty points ───────────────────────────────────────────────────────────
router.patch('/:id/loyalty',    authorize('admin', 'receptionist'), adjustLoyaltyPoints);

// ─── Membership ───────────────────────────────────────────────────────────────
router.patch('/:id/membership', authorize('admin', 'receptionist'), updateMembership);

export default router;