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
  /** 413: a well-formed request over a configured size limit (v0.12). */
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  // 503
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  // 409
  CONFLICT = 'CONFLICT',
  // 501
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  /** 501: the route exists but its feature flag is off (v0.12). */
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  // 403 (v0.12)
  CROSS_ORIGIN_REQUEST_REFUSED = 'CROSS_ORIGIN_REQUEST_REFUSED',
  // 429
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  // 504
  QUERY_TIMEOUT = 'QUERY_TIMEOUT',
  // v0.12: rejections made before a handler ran, in the JSON error shape
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  // 404 (v0.12)
  API_KEY_NOT_FOUND = 'API_KEY_NOT_FOUND',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
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
  /** Server `details` string of the JSON error body, when present. */
  public details?: string;
  /** v0.12: on a 404, what was not found (`namespace`, `vector`, `memory`, `job`, `attachment`, ...). */
  public resource?: string;
  /** Seconds from the `Retry-After` header (every v0.12 503 carries one), when present. */
  public retryAfterSeconds?: number;

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

/**
 * Raised *before* a request is sent when the server's advertised capabilities
 * (`GET /v1/capabilities`) do not include what was asked for (R9 / DAK-10004).
 *
 * `kind` names the registry (`model`, `index_kind`, `distance_metric`,
 * `search_mode`, `query_language`), `requested` is the wire string that was
 * rejected and `supported` is what the server does accept, so the message is
 * actionable on its own.
 */
export class UnsupportedCapabilityError extends ValidationError {
  public readonly kind: string;
  public readonly requested: string;
  public readonly supported: readonly string[];
  public readonly serverVersion?: string;

  constructor(kind: string, requested: string, supported: readonly string[], serverVersion?: string) {
    const server = serverVersion ? `Dakera server v${serverVersion}` : 'this Dakera server';
    const accepted = supported.length > 0 ? supported.join(', ') : '(none advertised)';
    super(
      `${kind} '${requested}' is not supported by ${server}; supported ${kind} values: ${accepted}`,
      undefined,
      undefined,
      ErrorCode.INVALID_REQUEST
    );
    this.name = 'UnsupportedCapabilityError';
    this.kind = kind;
    this.requested = requested;
    this.supported = [...supported];
    this.serverVersion = serverVersion;
    Object.setPrototypeOf(this, UnsupportedCapabilityError.prototype);
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

/**
 * Raised on HTTP 413. The server uses it for two different things, told apart
 * by `code`: `QUOTA_EXCEEDED` (the namespace is full — a `hard` quota) and
 * `PAYLOAD_TOO_LARGE` (this request is over a limit: an attachment over
 * `DAKERA_ATTACHMENT_MAX_BYTES`, a record over its representation limits, or a
 * body over the request limit).
 */
export class PayloadTooLargeError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown, code?: ErrorCode) {
    super(message, statusCode, responseBody, code);
    this.name = 'PayloadTooLargeError';
    Object.setPrototypeOf(this, PayloadTooLargeError.prototype);
  }

  /** The namespace quota is exhausted (as opposed to one request being too big). */
  get isQuota(): boolean {
    return this.code === ErrorCode.QUOTA_EXCEEDED;
  }
}

/**
 * Raised on HTTP 501. `code` is `FEATURE_DISABLED` when an opt-in v0.12 feature
 * (attachments, vision, records) is off on the server — `details` names the
 * environment variable that turns it on — or `NOT_IMPLEMENTED` when the
 * configured backend cannot perform the operation. Never retried.
 */
export class NotImplementedError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown, code?: ErrorCode) {
    super(message, statusCode, responseBody, code);
    this.name = 'NotImplementedError';
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }

  /** An opt-in feature is switched off on this server. */
  get isFeatureDisabled(): boolean {
    return this.code === ErrorCode.FEATURE_DISABLED;
  }
}

/** Raised on HTTP 409 (state conflict, e.g. deleting an attachment a memory still references). */
export class ConflictError extends DakeraError {
  constructor(message: string, statusCode?: number, responseBody?: unknown, code?: ErrorCode) {
    super(message, statusCode, responseBody, code);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
