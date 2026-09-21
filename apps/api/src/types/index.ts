// Shared backend TypeScript types and interfaces
// Example: export type { AuthPayload } from './auth';
// Example: export type { ApiResponse } from './api';

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  statusCode: number;
}
