import { Router } from 'express';
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/dailyExpense.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin', 'receptionist', 'staff'), getExpenses);
router.post('/', authorize('admin', 'receptionist', 'staff'), createExpense);
router.patch('/:id', authorize('admin', 'receptionist', 'staff'), updateExpense);
router.delete('/:id', authorize('admin'), deleteExpense);

export default router;
