import { BaseError } from './base.error'

class ChunkingError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'CHUNKING_FAILED', message, details)
  }
}

export { ChunkingError }
