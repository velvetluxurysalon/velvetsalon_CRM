import { Router }                                          from 'express';
import { getAllStaff, createStaff, updateStaff, deleteStaff } from '../controllers/staff.controller.js';

const router = Router();

router.get('/',     getAllStaff);   // GET    /api/staff
router.post('/',    createStaff);   // POST   /api/staff
router.put('/:id',  updateStaff);   // PUT    /api/staff/:id
router.delete('/:id', deleteStaff); // DELETE /api/staff/:id

export default router;