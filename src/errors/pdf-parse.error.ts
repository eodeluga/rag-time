import { BaseError } from './base.error'

class PdfParseError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'PDF_PARSE_FAILED', message, details)
  }
}

export { PdfParseError }
