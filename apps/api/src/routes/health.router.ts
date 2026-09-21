import { Router } from 'express';
import { healthController } from '../controllers/index.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  void healthController.handleRequest(req, res);
});
