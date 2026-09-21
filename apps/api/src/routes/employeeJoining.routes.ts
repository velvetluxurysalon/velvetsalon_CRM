import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  createEmployeeJoining,
  listEmployeeJoinings,
  getEmployeeJoiningById,
  updateEmployeeJoining,
  deleteEmployeeJoining,
} from '../controllers/employeeJoining.controller.js';

const router = Router();

// Local admin-only guard — these records hold Aadhaar/PAN/bank details,
// so receptionist and staff roles must never reach this router.
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admins only.' });
    return;
  }
  next();
}

// Public: the joining form page has no login gate on the frontend, so a new
// hire (or whoever has the link) can submit without a token. No read access
// is granted here — this only registers POST before the auth guard below.
router.post('/', createEmployeeJoining);

// Everything else — listing, fetching, editing, deleting stored records —
// stays admin-only, since these records hold Aadhaar/PAN/bank details.
router.use(authenticate, requireAdmin);

router.get('/', listEmployeeJoinings);
router.get('/:id', getEmployeeJoiningById);
router.put('/:id', updateEmployeeJoining);
router.delete('/:id', deleteEmployeeJoining);

export default router;