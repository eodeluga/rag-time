/**
 * Base class for all RAGtime domain errors.
 *
 * Extends the native `Error` with machine-readable `code` and HTTP-style `status`
 * fields to support consistent programmatic error handling across the pipeline.
 */
export class BaseError extends Error {
  /** Machine-readable string identifying the failure category (e.g. `'EMBEDDING_FAILED'`). */
  code: string
  /** Optional structured details provided at the throw site (e.g. a caught exception or validation issues). */
  details?: unknown
  /** HTTP-style numeric status code indicating error severity (`4xx` client errors, `5xx` internal errors). */
  status: number

  /**
   * @param {number} status - HTTP-style numeric status code (e.g. `400`, `500`).
   * @param {string} code - Unique string identifier for the error type.
   * @param {string} message - Human-readable description of the error.
   * @param {unknown} [details] - Optional additional context such as a caught exception or validation issues.
   */
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.code = code
    this.details = details
    this.message = message
    this.name = this.constructor.name
    this.status = status
  }
}
