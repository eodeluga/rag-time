import { BaseError } from './base.error'

class VectorStoreError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'VECTOR_STORE_ERROR', message, details)
  }
}

export { VectorStoreError }
