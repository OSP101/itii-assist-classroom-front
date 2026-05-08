/**
 * Shared API types
 *
 * All backend responses follow the shape: { success, data?, message?, error? }
 * Use these types across server-api and client-api for consistent handling.
 */

export type ApiSuccess<T> = {
  success: true;
  message?: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  message: string;
  error?: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// Pagination wrapper returned by list endpoints
export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ApiPaginatedResponse<T> = ApiSuccess<PaginatedData<T>>;

// Common query params for list endpoints
export type ListQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  status?: string;
  role?: string;
  section?: string | number;
  startDate?: string;
  endDate?: string;
  [key: string]: string | number | boolean | undefined;
};
