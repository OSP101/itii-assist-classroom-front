/**
 * Typed API error class
 *
 * Thrown by server-api and client-api when the backend returns
 * { success: false } or when a network/HTTP error occurs.
 */

export class ApiError extends Error {
  /** HTTP status code (0 for network errors) */
  readonly status: number;
  /** Backend error field, if present */
  readonly serverError?: string;
  /** Whether this is a network-level failure (no response received) */
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    status: number,
    serverError?: string,
    isNetworkError = false
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.serverError = serverError;
    this.isNetworkError = isNetworkError;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isServerError() {
    return this.status >= 500;
  }

  /** Human-readable message suitable for toast display */
  get toastMessage(): string {
    if (this.isNetworkError) return "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
    if (this.isUnauthorized) return "กรุณาเข้าสู่ระบบใหม่";
    if (this.isForbidden) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
    if (this.isNotFound) return "ไม่พบข้อมูลที่ต้องการ";
    if (this.isServerError) return "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";
    return this.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }

  static fromUnknown(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (error instanceof Error) {
      return new ApiError(error.message, 0, undefined, true);
    }
    return new ApiError("Unknown error", 0, undefined, true);
  }
}
