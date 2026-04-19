import { BaseError } from '@/errors/base.error'

export class UnsupportedVectorFilterOperatorError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(400, 'UNSUPPORTED_VECTOR_FILTER_OPERATOR', message, details)
  }
}
