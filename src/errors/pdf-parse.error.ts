import { BaseError } from '@/errors/base.error'

/**
 * Thrown when a PDF file cannot be read from disk or its content cannot be parsed.
 *
 * - **Code:** `'PDF_PARSE_FAILED'`
 * - **Status:** `500`
 */
export class PdfParseError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(500, 'PDF_PARSE_FAILED', message, details)
  }
}
