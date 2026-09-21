import type { ErrorRequestHandler } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const error = err instanceof Error ? err : new Error(String(err));
  const status = (err as { status?: number }).status ?? 500;

  console.error(`[error] ${status.toString()} — ${error.message}`);

  res.status(status).json({ error: error.message });
};
