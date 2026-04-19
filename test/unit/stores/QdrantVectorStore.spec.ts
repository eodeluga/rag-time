import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { InvalidVectorFilterError } from '@/errors/invalid-vector-filter.error'
import { VectorStoreError } from '@/errors/vector-store.error'

const mockCollectionExists = mock(async (_id: string) => ({ exists: false }))
const mockCreateCollection = mock(async (_id: string, _config: unknown) => undefined)
const mockUpsert = mock(async (_id: string, _opts: unknown) => ({ status: 'completed' }))
const mockSearch = mock(
  async (_id: string, _opts: unknown): Promise<{ id: number; payload: Record<string, unknown>; score: number }[]> => []
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

const samplePoints = [
  { id: 0, payload: { text: 'chunk one', index: 0 }, vector: [0.1, 0.2, 0.3] },
  { id: 1, payload: { text: 'chunk two', index: 1 }, vector: [0.4, 0.5, 0.6] },
]

describe('QdrantVectorStore', () => {
  beforeEach(() => {
    mockCollectionExists.mockReset()
    mockCreateCollection.mockReset()
    mockUpsert.mockReset()
    mockSearch.mockReset()

    mockCollectionExists.mockImplementation(async () => ({ exists: false }))
    mockCreateCollection.mockImplementation(async () => undefined)
    mockUpsert.mockImplementation(async () => ({ status: 'completed' }))
    mockSearch.mockImplementation(async () => [])
  })

  describe('exists', () => {
    it('returns true when the collection exists', async () => {
      mockCollectionExists.mockImplementation(async () => ({ exists: true }))

      const store = new QdrantVectorStore()
      expect(await store.exists('col-1')).toBeTrue()
    })

    it('returns false when the collection does not exist', async () => {
      const store = new QdrantVectorStore()
      expect(await store.exists('col-1')).toBeFalse()
    })

    it('throws VectorStoreError when the client throws', async () => {
      mockCollectionExists.mockImplementation(async () => {
        throw new Error('network error')
      })

      const store = new QdrantVectorStore()
      await expect(store.exists('col-1')).rejects.toBeInstanceOf(VectorStoreError)
    })
  })

  describe('insert', () => {
    it('creates a collection with the correct vector size and distance', async () => {
      let capturedConfig: unknown

      mockCreateCollection.mockImplementation(async (_id, config) => {
        capturedConfig = config
        return undefined
      })

      const store = new QdrantVectorStore()
      await store.insert('col-1', samplePoints)

      const config = capturedConfig as { vectors: { distance: string; size: number } }
      expect(config.vectors.size).toBe(3)
      expect(config.vectors.distance).toBe('Cosine')
    })

    it('uses default collection tuning when not configured', async () => {
      let capturedConfig: unknown

      mockCreateCollection.mockImplementation(async (_id, config) => {
        capturedConfig = config
        return undefined
      })

      const store = new QdrantVectorStore()
      await store.insert('col-1', samplePoints)

      const config = capturedConfig as {
        optimizers_config: { default_segment_number: number }
        replication_factor: number
      }

      expect(config.optimizers_config.default_segment_number).toBe(2)
      expect(config.replication_factor).toBe(2)
    })

    it('uses configured collection tuning overrides when provided', async () => {
      let capturedConfig: unknown

      mockCreateCollection.mockImplementation(async (_id, config) => {
        capturedConfig = config
        return undefined
      })

      const store = new QdrantVectorStore({
        collection: {
          defaultSegmentNumber: 4,
          replicationFactor: 1,
        },
      })

      await store.insert('col-1', samplePoints)

      const config = capturedConfig as {
        optimizers_config: { default_segment_number: number }
        replication_factor: number
      }

      expect(config.optimizers_config.default_segment_number).toBe(4)
      expect(config.replication_factor).toBe(1)
    })

    it('upserts all points and returns collectionId and status', async () => {
      const store = new QdrantVectorStore()
      const result = await store.insert('col-1', samplePoints)

      expect(result.collectionId).toBe('col-1')
      expect(result.status).toBe('completed')
      expect(mockUpsert.mock.calls).toHaveLength(1)
    })

    it('throws VectorStoreError on empty points array', async () => {
      const store = new QdrantVectorStore()
      await expect(store.insert('col-1', [])).rejects.toBeInstanceOf(VectorStoreError)
    })

    it('throws VectorStoreError when client throws', async () => {
      mockCreateCollection.mockImplementation(async () => {
        throw new Error('disk full')
      })

      const store = new QdrantVectorStore()
      await expect(store.insert('col-1', samplePoints)).rejects.toBeInstanceOf(VectorStoreError)
    })
  })

  describe('search', () => {
    it('returns mapped VectorSearchResult array', async () => {
      mockSearch.mockImplementation(async () => [
        { id: 0, payload: { text: 'result one' }, score: 0.95 },
        { id: 1, payload: { text: 'result two' }, score: 0.80 },
      ])

      const store = new QdrantVectorStore()
      const results = await store.search('col-1', [0.1, 0.2], { filter: undefined, limit: 2 })

      expect(results).toHaveLength(2)
      expect(results[0]?.id).toBe(0)
      expect(results[0]?.score).toBe(0.95)
      expect(results[0]?.payload['text']).toBe('result one')
    })

    it('passes vector and limit to the Qdrant client', async () => {
      let capturedOpts: unknown

      mockSearch.mockImplementation(async (_id, opts) => {
        capturedOpts = opts
        return []
      })

      const store = new QdrantVectorStore()
      await store.search('col-1', [0.5, 0.6], { filter: undefined, limit: 10 })

      const opts = capturedOpts as { limit: number; vector: number[] }
      expect(opts.vector).toEqual([0.5, 0.6])
      expect(opts.limit).toBe(10)
    })

    it('returns empty array when no results found', async () => {
      const store = new QdrantVectorStore()
      const results = await store.search('col-1', [0.1], { filter: undefined, limit: 5 })

      expect(results).toEqual([])
    })

    it('throws VectorStoreError when client throws', async () => {
      mockSearch.mockImplementation(async () => {
        throw new Error('timeout')
      })

      const store = new QdrantVectorStore()
      await expect(store.search('col-1', [0.1], { filter: undefined, limit: 1 })).rejects.toBeInstanceOf(VectorStoreError)
    })

    it('throws InvalidVectorFilterError when limit is zero', async () => {
      const store = new QdrantVectorStore()

      await expect(
        store.search('col-1', [0.1], { filter: undefined, limit: 0 })
      ).rejects.toBeInstanceOf(InvalidVectorFilterError)
      expect(mockSearch.mock.calls).toHaveLength(0)
    })

    it('throws InvalidVectorFilterError when limit is non-integer', async () => {
      const store = new QdrantVectorStore()

      await expect(
        store.search('col-1', [0.1], { filter: undefined, limit: 1.5 })
      ).rejects.toBeInstanceOf(InvalidVectorFilterError)
      expect(mockSearch.mock.calls).toHaveLength(0)
    })
  })
})
