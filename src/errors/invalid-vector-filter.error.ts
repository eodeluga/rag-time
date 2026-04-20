import { BaseError } from '@/errors/base.error'

/**
 * Thrown when a {@link VectorFilterCondition} fails schema validation.
 *
 * - **Code:** `'INVALID_VECTOR_FILTER'`
 * - **Status:** `400`
 */
export class InvalidVectorFilterError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(400, 'INVALID_VECTOR_FILTER', message, details)
  }
}
