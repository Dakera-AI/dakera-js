/**
 * Dakera SDK Errors
 */

/** Server error codes returned in structured error responses */
export enum ErrorCode {
  // 404
  NAMESPACE_NOT_FOUND = 'NAMESPACE_NOT_FOUND',
  VECTOR_NOT_FOUND = 'VECTOR_NOT_FOUND',
  // 400
  DIMENSION_MISMATCH = 'DIMENSION_MISMATCH',
  EMPTY_VECTOR = 'EMPTY_VECTOR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  // 500
  STORAGE_ERROR = 'STORAGE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  // 413
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  // 503
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  // 401
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  API_KEY_EXPIRED = 'API_KEY_EXPIRED',
  // 403
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  NAMESPACE_ACCESS_DENIED = 'NAMESPACE_ACCESS_DENIED',
  // fallback
  UNKNOWN = 'UNKNOWN',
}

/** Base error class for all Dakera errors */
export class DakeraError extends Error {
  public readonly statusCode?: number;
  public readonly responseBody?: unknown;
  public readonly code?: ErrorCode;

  constructor(message: string, statusCode?: number, responseBody?: unknown, code?: ErrorCode) {
    super(message);
    this.name = 'DakeraError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.code = code;
    Object.setPrototypeOf(this, DakeraError.prototype);
  }
}

/** Raised when unable to connect to Dakera server */
export class ConnectionError extends DakeraError {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/** Raised when a requested resource is not found */
export class NotFoundError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown, code?: ErrorCode) {
    super(message, statusCode, responseBody, code);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/** Raised when request validation fails */
export class ValidationError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown, code?: ErrorCode) {
    super(message, statusCode, responseBody, code);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/** Raised when rate limit is exceeded */
export class RateLimitError extends DakeraError {
  public readonly retryAfter?: number;

  constructor(
    message: string,
    statusCode?: number,
    responseBody?: unknown,
    retryAfter?: number,
    code?: ErrorCode
  ) {
    super(message, statusCode, responseBody, code);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/** Raised when the server returns a 5xx error */
export class ServerError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown, code?: ErrorCode) {
    super(message, statusCode, responseBody, code);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/** Raised when authentication fails */
export class AuthenticationError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown, code?: ErrorCode) {
    super(message, statusCode, responseBody, code);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/** Raised when authorization fails (403 Forbidden) */
export class AuthorizationError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown, code?: ErrorCode) {
    super(message, statusCode, responseBody, code);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/** Raised when a request times out */
export class TimeoutError extends DakeraError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
