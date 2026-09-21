import type { Request, Response, NextFunction } from 'express';

/**
 * Base controller providing common response helpers.
 * All controllers should extend this class.
 */
export abstract class BaseController {
  protected ok(res: Response, data: unknown): void {
    res.status(200).json({ data });
  }

  protected created(res: Response, data: unknown): void {
    res.status(201).json({ data });
  }

  protected noContent(res: Response): void {
    res.status(204).send();
  }

  protected badRequest(res: Response, message: string): void {
    res.status(400).json({ error: message });
  }

  protected unauthorized(res: Response): void {
    res.status(401).json({ error: 'Unauthorized' });
  }

  protected forbidden(res: Response): void {
    res.status(403).json({ error: 'Forbidden' });
  }

  protected notFound(res: Response, message = 'Not Found'): void {
    res.status(404).json({ error: message });
  }

  abstract handleRequest(req: Request, res: Response, next: NextFunction): Promise<void>;
}
