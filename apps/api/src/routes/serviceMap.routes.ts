import { Router } from 'express';
import { getServiceMap, upsertServiceMap } from '../controllers/serviceMap.controller.js';

const router = Router();

router.get('/', getServiceMap);
router.post('/', upsertServiceMap);

export default router;