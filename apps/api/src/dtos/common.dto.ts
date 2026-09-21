import { z } from 'zod';

/**
 * DTO schemas using Zod for runtime validation.
 * DTOs define the shape of data entering/leaving the API.
 * Always validate request bodies/params against these schemas.
 */

// ——— Pagination ———
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ——— ID param ———
export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});
export type IdParam = z.infer<typeof IdParamSchema>;

// ——— Common API response wrapper ———
export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    message: z.string().optional(),
  });

export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.array(z.string()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
