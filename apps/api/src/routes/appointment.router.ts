import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
const router = Router();

// All appointment routes require authentication
router.use(authenticate);

// GET  /api/appointments                    → list with filters
// POST /api/appointments                    → create new
router
  .route('/')
  .get(appointmentController.getAll.bind(appointmentController))
  .post(appointmentController.create.bind(appointmentController));

// GET /api/appointments/calendar?month=YYYY-MM  → calendar dot counts
router.get(
  '/calendar',
  appointmentController.getCalendarDots.bind(appointmentController)
);

// GET    /api/appointments/:id   → get one
// PUT    /api/appointments/:id   → full update
// DELETE /api/appointments/:id   → delete
router
  .route('/:id')
  .get(appointmentController.getById.bind(appointmentController))
  .put(appointmentController.update.bind(appointmentController))
  .delete(appointmentController.delete.bind(appointmentController));

// PATCH /api/appointments/:id/status  → status only update
router.patch(
  '/:id/status',
  appointmentController.updateStatus.bind(appointmentController)
);

export default router;