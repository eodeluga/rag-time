import { describe, expect, it } from 'bun:test'
import { BaseError } from '@/errors/base.error'
import { ChunkingError } from '@/errors/chunking.error'
import { EmbeddingError } from '@/errors/embedding.error'
import { PdfParseError } from '@/errors/pdf-parse.error'
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
