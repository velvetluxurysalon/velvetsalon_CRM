import { Router }                                              from 'express';
import { getSalaryCredits, createSalaryCredit, deleteSalaryCredit } from '../controllers/salary.controller.js';

const router = Router();

router.get('/',       getSalaryCredits);    // GET    /api/salary?staffId=
router.post('/',      createSalaryCredit);  // POST   /api/salary
router.delete('/:id', deleteSalaryCredit);  // DELETE /api/salary/:id

export default router;