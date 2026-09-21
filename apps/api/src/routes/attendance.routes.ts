import { Router }                              from 'express';
import { getAttendance, upsertAttendance }     from '../controllers/attendance.controller.js';

const router = Router();

router.get('/',  getAttendance);    // GET  /api/attendance?from=&to=
router.post('/', upsertAttendance); // POST /api/attendance

export default router;