import { BaseError } from '@/errors/base.error'

export class EmbeddingError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'EMBEDDING_FAILED', message, details)
  }
}
