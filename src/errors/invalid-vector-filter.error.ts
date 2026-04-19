import { BaseError } from '@/errors/base.error'

export class InvalidVectorFilterError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(400, 'INVALID_VECTOR_FILTER', message, details)
  }
}
