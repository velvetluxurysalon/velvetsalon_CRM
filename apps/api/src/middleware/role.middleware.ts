import { Request, Response, NextFunction } from 'express';
import type { AuthPayload } from './auth.middleware.js';

type Role = AuthPayload['role'];

/**
 * Usage:
 *   router.get('/admin-only', authenticate, authorize('admin'), handler)
 *   router.get('/admin-or-reception', authenticate, authorize('admin', 'receptionist'), handler)
 */
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Access denied.' });
      return;
    }
    next();
  };
}