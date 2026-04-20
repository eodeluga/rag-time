import { BaseError } from '@/errors/base.error'

/**
 * Thrown when the LLM fails to return parseable JSON during the text chunking step.
 *
 * - **Code:** `'CHUNKING_FAILED'`
 * - **Status:** `500`
 */
export class ChunkingError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'CHUNKING_FAILED', message, details)
  }
}
