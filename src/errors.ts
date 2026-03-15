/**
 * Dakera SDK Errors
 */

/** Base error class for all Dakera errors */
export class DakeraError extends Error {
  public readonly statusCode?: number;
  public readonly responseBody?: unknown;

  constructor(message: string, statusCode?: number, responseBody?: unknown) {
    super(message);
    this.name = 'DakeraError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
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
  constructor(message: string, statusCode?: number, responseBody?: unknown) {
    super(message, statusCode, responseBody);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/** Raised when request validation fails */
export class ValidationError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown) {
    super(message, statusCode, responseBody);
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
    retryAfter?: number
  ) {
    super(message, statusCode, responseBody);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/** Raised when the server returns a 5xx error */
export class ServerError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown) {
    super(message, statusCode, responseBody);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/** Raised when authentication fails */
export class AuthenticationError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown) {
    super(message, statusCode, responseBody);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
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
