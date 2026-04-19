import { describe, expect, it } from 'bun:test'
import { BaseError } from '@/errors/base.error'
import { ChunkingError } from '@/errors/chunking.error'
import { EmbeddingError } from '@/errors/embedding.error'
import { InvalidVectorFilterError } from '@/errors/invalid-vector-filter.error'
import { PdfParseError } from '@/errors/pdf-parse.error'
import { UnsupportedVectorFilterOperatorError } from '@/errors/unsupported-vector-filter-operator.error'
import { VectorStoreError } from '@/errors/vector-store.error'

describe('BaseError', () => {
  it('sets status, code, and message', () => {
    const error = new BaseError(400, 'TEST_CODE', 'test message')
    expect(error.status).toBe(400)
    expect(error.code).toBe('TEST_CODE')
    expect(error.message).toBe('test message')
  })

  it('sets optional details', () => {
    const details = { extra: 'info' }
    const error = new BaseError(500, 'ERR', 'msg', details)
    expect(error.details).toEqual(details)
  })

  it('is an instance of Error', () => {
    const error = new BaseError(500, 'ERR', 'msg')
    expect(error).toBeInstanceOf(Error)
  })

  it('sets name to constructor name', () => {
    const error = new BaseError(500, 'ERR', 'msg')
    expect(error.name).toBe('BaseError')
  })
})

describe('ChunkingError', () => {
  it('has status 500 and code CHUNKING_FAILED', () => {
    const error = new ChunkingError('chunk failed')
    expect(error.status).toBe(500)
    expect(error.code).toBe('CHUNKING_FAILED')
    expect(error.message).toBe('chunk failed')
  })

  it('accepts optional details', () => {
    const cause = new SyntaxError('bad json')
    const error = new ChunkingError('parse error', cause)
    expect(error.details).toBe(cause)
  })

  it('is an instance of BaseError', () => {
    expect(new ChunkingError('msg')).toBeInstanceOf(BaseError)
  })
})

describe('EmbeddingError', () => {
  it('has status 500 and code EMBEDDING_FAILED', () => {
    const error = new EmbeddingError('embed failed')
    expect(error.status).toBe(500)
    expect(error.code).toBe('EMBEDDING_FAILED')
  })

  it('is an instance of BaseError', () => {
    expect(new EmbeddingError('msg')).toBeInstanceOf(BaseError)
  })
})

describe('PdfParseError', () => {
  it('has status 500 and code PDF_PARSE_FAILED', () => {
    const error = new PdfParseError('parse failed')
    expect(error.status).toBe(500)
    expect(error.code).toBe('PDF_PARSE_FAILED')
  })

  it('is an instance of BaseError', () => {
    expect(new PdfParseError('msg')).toBeInstanceOf(BaseError)
  })
})

describe('VectorStoreError', () => {
  it('has status 500 and code VECTOR_STORE_ERROR', () => {
    const error = new VectorStoreError('store failed')
    expect(error.status).toBe(500)
    expect(error.code).toBe('VECTOR_STORE_ERROR')
  })

  it('is an instance of BaseError', () => {
    expect(new VectorStoreError('msg')).toBeInstanceOf(BaseError)
  })
})

describe('InvalidVectorFilterError', () => {
  it('has status 400 and code INVALID_VECTOR_FILTER', () => {
    const error = new InvalidVectorFilterError('invalid filter')
    expect(error.status).toBe(400)
    expect(error.code).toBe('INVALID_VECTOR_FILTER')
    expect(error.message).toBe('invalid filter')
  })

  it('accepts optional details', () => {
    const details = [{ message: 'field required' }]
    const error = new InvalidVectorFilterError('invalid', details)
    expect(error.details).toEqual(details)
  })

  it('is an instance of BaseError', () => {
    expect(new InvalidVectorFilterError('msg')).toBeInstanceOf(BaseError)
  })
})

describe('UnsupportedVectorFilterOperatorError', () => {
  it('has status 400 and code UNSUPPORTED_VECTOR_FILTER_OPERATOR', () => {
    const error = new UnsupportedVectorFilterOperatorError('unsupported operator')
    expect(error.status).toBe(400)
    expect(error.code).toBe('UNSUPPORTED_VECTOR_FILTER_OPERATOR')
    expect(error.message).toBe('unsupported operator')
  })

  it('accepts optional details', () => {
    const details = { operator: 'regex' }
    const error = new UnsupportedVectorFilterOperatorError('unsupported', details)
    expect(error.details).toEqual(details)
  })

  it('is an instance of BaseError', () => {
    expect(new UnsupportedVectorFilterOperatorError('msg')).toBeInstanceOf(BaseError)
  })
})
