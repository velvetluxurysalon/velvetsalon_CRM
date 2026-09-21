import { Router } from 'express';
import {
  getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon,
} from '../controllers/coupon.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize }    from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticate);

// Billing staff need to see + apply coupons, but not manage the catalogue
router.get   ('/',          authorize('admin', 'receptionist'), getCoupons);
router.post  ('/validate',  authorize('admin', 'receptionist'), validateCoupon);

// Only admins create/edit/delete coupon codes
router.post  ('/',    authorize('admin'), createCoupon);
router.patch ('/:id', authorize('admin'), updateCoupon);
router.delete('/:id', authorize('admin'), deleteCoupon);

export default router;