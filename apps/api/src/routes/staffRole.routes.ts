import { Router } from 'express';
import {
  listStaffRoles,
  createStaffRole,
  updateStaffRole,
  deleteStaffRole,
} from '../controllers/staffRole.controller.js';

const router = Router();

router.get('/', listStaffRoles);
router.post('/', createStaffRole);
router.put('/:id', updateStaffRole);
router.delete('/:id', deleteStaffRole);

export default router;