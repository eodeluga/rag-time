import { BaseError } from '@/errors/base.error'

/**
 * Thrown when embedding generation or storage fails during ingestion.
 *
 * - **Code:** `'EMBEDDING_FAILED'`
 * - **Status:** `500`
 */
export class EmbeddingError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'EMBEDDING_FAILED', message, details)
  }
}
