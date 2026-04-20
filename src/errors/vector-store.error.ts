import { BaseError } from '@/errors/base.error'

/**
 * Thrown when a vector store operation (existence check, insert, or search) fails.
 *
 * - **Code:** `'VECTOR_STORE_ERROR'`
 * - **Status:** `500`
 */
export class VectorStoreError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'VECTOR_STORE_ERROR', message, details)
  }
}
