import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { UnsupportedVectorFilterOperatorError } from '@/errors/unsupported-vector-filter-operator.error'

const mockCollectionExists = mock(async (_id: string) => ({ exists: false }))
const mockCreateCollection = mock(async (_id: string, _config: unknown) => undefined)
const mockUpsert = mock(async (_id: string, _opts: unknown) => ({ status: 'completed' }))
const mockSearch = mock(
  async (
    _id: string,
    _opts: unknown
  ): Promise<{ id: number; payload: Record<string, unknown>; score: number }[]> => []
)

mock.module('@qdrant/qdrant-js', () => ({
  QdrantClient: class MockQdrantClient {
    collectionExists = mockCollectionExists
    createCollection = mockCreateCollection
    search = mockSearch
    upsert = mockUpsert
  },
}))

import { QdrantVectorStore } from '@/stores/qdrant-vector.store'

const baseVector = [0.1, 0.2, 0.3]

describe('QdrantVectorStore — filter translation', () => {
  beforeEach(() => {
    mockSearch.mockReset()
    mockSearch.mockImplementation(async () => [])
  })

  it('passes no filter to Qdrant when options.filter is undefined', async () => {
    let capturedOpts: unknown

    mockSearch.mockImplementation(async (_id, opts) => {
      capturedOpts = opts
      return []
    })

    const store = new QdrantVectorStore()
    await store.search('col-1', baseVector, { filter: undefined, limit: 5 })

    const opts = capturedOpts as Record<string, unknown>
    expect(opts['filter']).toBeUndefined()
  })

  describe('eq operator', () => {
    it('translates eq to a Qdrant match clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: { field: 'source', operator: 'eq', value: 'doc.pdf' },
        limit: 5,
      })

      const opts = capturedOpts as { filter: { must: { key: string; match: { value: unknown } }[] } }
      expect(opts.filter.must[0]?.key).toBe('source')
      expect(opts.filter.must[0]?.match.value).toBe('doc.pdf')
    })
  })

  describe('ne operator', () => {
    it('translates ne to a must_not wrapped equality clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: { field: 'category', operator: 'ne', value: 'archived' },
        limit: 5,
      })

      const opts = capturedOpts as {
        filter: { must_not: { key: string; match: { value: unknown } }[] }
      }

      expect(opts.filter.must_not[0]?.key).toBe('category')
      expect(opts.filter.must_not[0]?.match.value).toBe('archived')
    })
  })

  describe('in operator', () => {
    it('translates in to a Qdrant match.any clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: { field: 'source', operator: 'in', values: ['a.pdf', 'b.pdf'] },
        limit: 5,
      })

      const opts = capturedOpts as {
        filter: { must: { key: string; match: { any: unknown[] } }[] }
      }

      expect(opts.filter.must[0]?.key).toBe('source')
      expect(opts.filter.must[0]?.match.any).toEqual(['a.pdf', 'b.pdf'])
    })
  })

  describe('range operators', () => {
    it('translates gt to a Qdrant range clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: { field: 'score', operator: 'gt', value: 0.5 },
        limit: 5,
      })

      const opts = capturedOpts as {
        filter: { must: { key: string; range: Record<string, unknown> }[] }
      }

      expect(opts.filter.must[0]?.key).toBe('score')
      expect(opts.filter.must[0]?.range['gt']).toBe(0.5)
    })

    it('translates gte to a Qdrant range clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: { field: 'score', operator: 'gte', value: 0.5 },
        limit: 5,
      })

      const opts = capturedOpts as {
        filter: { must: { key: string; range: Record<string, unknown> }[] }
      }

      expect(opts.filter.must[0]?.range['gte']).toBe(0.5)
    })

    it('translates lt to a Qdrant range clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: { field: 'rank', operator: 'lt', value: 10 },
        limit: 5,
      })

      const opts = capturedOpts as {
        filter: { must: { key: string; range: Record<string, unknown> }[] }
      }

      expect(opts.filter.must[0]?.range['lt']).toBe(10)
    })

    it('translates lte to a Qdrant range clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: { field: 'rank', operator: 'lte', value: 10 },
        limit: 5,
      })

      const opts = capturedOpts as {
        filter: { must: { key: string; range: Record<string, unknown> }[] }
      }

      expect(opts.filter.must[0]?.range['lte']).toBe(10)
    })
  })

  describe('logical operators', () => {
    it('translates and to a Qdrant must clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: {
          conditions: [
            { field: 'source', operator: 'eq', value: 'doc.pdf' },
            { field: 'rank', operator: 'lt', value: 5 },
          ],
          operator: 'and',
        },
        limit: 5,
      })

      const opts = capturedOpts as { filter: { must: unknown[] } }
      expect(opts.filter.must).toHaveLength(2)
    })

    it('translates or to a Qdrant should clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: {
          conditions: [
            { field: 'source', operator: 'eq', value: 'a.pdf' },
            { field: 'source', operator: 'eq', value: 'b.pdf' },
          ],
          operator: 'or',
        },
        limit: 5,
      })

      const opts = capturedOpts as { filter: { should: unknown[] } }
      expect(opts.filter.should).toHaveLength(2)
    })

    it('translates not to a Qdrant must_not clause', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: {
          condition: { field: 'source', operator: 'eq', value: 'excluded.pdf' },
          operator: 'not',
        },
        limit: 5,
      })

      const opts = capturedOpts as { filter: { must_not: unknown[] } }
      expect(opts.filter.must_not).toHaveLength(1)
    })

    it('translates nested logical combinations deterministically', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', baseVector, {
        filter: {
          conditions: [
            {
              condition: { field: 'archived', operator: 'eq', value: true },
              operator: 'not',
            },
            { field: 'source', operator: 'in', values: ['a.pdf', 'b.pdf'] },
          ],
          operator: 'and',
        },
        limit: 5,
      })

      const opts = capturedOpts as { filter: { must: unknown[] } }
      expect(opts.filter.must).toHaveLength(2)
    })
  })

  describe('UnsupportedVectorFilterOperatorError', () => {
    it('throws UnsupportedVectorFilterOperatorError from the translator default branch', () => {
      // Subclass exposes the protected translator for direct testing.
      // This exercises the exhaustiveness safety net for operators that could
      // be added to the generic schema in the future but are not yet mapped
      // by this Qdrant adapter.
      class ExposedQdrantStore extends QdrantVectorStore {
        public callTranslateFilter(condition: unknown) {
          return this.translateFilter(condition as any)
        }
      }

      const store = new ExposedQdrantStore()
      expect(() => store.callTranslateFilter({ operator: 'regex' })).toThrow(
        UnsupportedVectorFilterOperatorError
      )
    })
  })
})
