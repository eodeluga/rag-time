import { BaseError } from '@/errors/base.error'

export class PdfParseError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'PDF_PARSE_FAILED', message, details)
  }
}
