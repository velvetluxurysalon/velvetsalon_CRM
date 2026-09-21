import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET ?? 'customer_secret_change_in_prod';

export interface CustomerJwtPayload {
  customerId: string;
  phone: string;
}

// Extend Express Request to carry customer identity
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required pattern for augmenting Express's global Request type
  namespace Express {
    interface Request {
      customerId?: string;
      customerPhone?: string;
    }
  }
}

/**
 * Protects customer-only portal routes.
 * Reads Bearer token from Authorization header, verifies it was issued
 * by the customer login endpoint (not the admin authenticate middleware).
 */
export const authenticateCustomer = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Customer authentication required.' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, CUSTOMER_JWT_SECRET) as CustomerJwtPayload;
    req.customerId    = payload.customerId;
    req.customerPhone = payload.phone;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session. Please sign in again.' });
  }
};

/**
 * Issues a short-lived JWT for a verified customer.
 */
export const signCustomerToken = (customerId: string, phone: string): string =>
  jwt.sign(
    { customerId, phone } satisfies CustomerJwtPayload,
    CUSTOMER_JWT_SECRET,
    { expiresIn: '7d' }
  );