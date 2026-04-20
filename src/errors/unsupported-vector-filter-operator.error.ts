import { BaseError } from '@/errors/base.error'

/**
 * Thrown when a {@link VectorFilterCondition} uses an operator not supported by
 * the target vector store backend.
 *
 * - **Code:** `'UNSUPPORTED_VECTOR_FILTER_OPERATOR'`
 * - **Status:** `400`
 */
export class UnsupportedVectorFilterOperatorError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(400, 'UNSUPPORTED_VECTOR_FILTER_OPERATOR', message, details)
  }
}
