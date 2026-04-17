class BaseError extends Error {
  code: string
  details?: unknown
  status: number

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.code = code
    this.details = details
    this.message = message
    this.name = this.constructor.name
    this.status = status
  }
}

export { BaseError }
