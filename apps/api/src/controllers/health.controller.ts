import type { Request, Response } from 'express';
import { BaseController } from './base.controller.js';

/**
 * GET /health
 * Returns service status and timestamp.
 */
export class HealthController extends BaseController {
  async handleRequest(_req: Request, res: Response): Promise<void> {
    this.ok(res, { status: 'ok', timestamp: new Date().toISOString() });
    await Promise.resolve();
  }
}

export const healthController = new HealthController();
