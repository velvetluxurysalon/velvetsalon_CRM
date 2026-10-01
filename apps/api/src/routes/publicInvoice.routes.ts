import { Router } from 'express';
import { getPublicInvoicePdf } from '../controllers/bill.controller.js';

const router = Router();
router.get('/invoice/:token', getPublicInvoicePdf); // no authenticate on purpose
export default router;