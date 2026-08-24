/**
 * Minimal shape of the envelope every apiService call resolves with. Declared
 * locally rather than imported because services/api.service.ts keeps its
 * ApiResponse interface private to that module.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
