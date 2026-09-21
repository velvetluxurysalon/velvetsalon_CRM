// API client and HTTP utilities
// Example: export { apiClient } from './client';
// Example: export { authApi } from './auth.api';

// Base URL is set via VITE_API_BASE_URL env variable
export const API_BASE_URL: string =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? 'http://localhost:3001';
