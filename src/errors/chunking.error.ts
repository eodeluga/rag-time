import { BaseError } from '@/errors/base.error'

export class ChunkingError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'CHUNKING_FAILED', message, details)
  }
}
