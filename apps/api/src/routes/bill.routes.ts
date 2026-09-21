import { Router }                                              from 'express';
import { getBills, createBill, updateBill, getBillInvoicePdf }  from '../controllers/bill.controller.js';
import { authenticate }                                        from '../middleware/auth.middleware.js';
import { authorize }                                           from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticate);

router.get  ('/',            authorize('admin', 'receptionist', 'staff'), getBills);
router.get  ('/:id/invoice', authorize('admin', 'receptionist'),          getBillInvoicePdf);   // ← added
router.post ('/',            authorize('admin', 'receptionist'),          createBill);
router.patch('/:id',         authorize('admin', 'receptionist'),          updateBill);

export default router;