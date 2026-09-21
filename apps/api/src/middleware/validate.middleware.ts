import type { Request, Response, NextFunction } from 'express';
import { type z } from 'zod';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Express middleware factory for Zod schema validation.
 * Usage: router.post('/route', validate(MySchema, 'body'), controller)
 *
 * Returns 422 Unprocessable Entity with field-level error details.
 */
export function validate(schema: z.ZodType, target: ValidateTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      res.status(422).json({ error: 'Validation failed', details: errors });
      return;
    }

    Object.defineProperty(req, `validated${target.charAt(0).toUpperCase()}${target.slice(1)}`, {
      value: result.data,
      writable: false,
    });
    next();
  };
}
