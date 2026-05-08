/**
 * API layer exports — import from here rather than specific files
 * to keep import paths short.
 */

export { serverApi } from "./server-api";
export { clientApi, keepPreviousData } from "./client-api";
export { requestDedupe } from "./request-dedupe";
export { ApiError } from "./api-error";
export {
	getClientNetworkMetrics,
	resetClientNetworkMetrics,
} from "./network-metrics";
export type { ApiResponse, ApiSuccess, ApiFailure, PaginatedData, ListQueryParams } from "./types";
