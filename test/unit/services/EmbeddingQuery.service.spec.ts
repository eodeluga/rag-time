import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { EmbeddingQueryService } from '@/services/embedding-query.service'
import { EmbeddingManagementService } from '@/services/embedding-management.service'
import { EmbeddingProcessingService } from '@/services/embedding-processing.service'
import type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'
import type { VectorStore, VectorPoint, VectorSearchResult, VectorStoreInsertResult } from '@/models/vector-store.model'
import type { RetrievalSearchOptions } from '@/models/vector-filter.model'

const queryVector = [0.5, 0.6, 0.7]

const mockEmbed = mock(
  async (_inputs: string[]): Promise<EmbeddingVector[]> => [
    { index: 0, vector: queryVector },
  ]
)

const mockEmbeddingProvider: EmbeddingProvider = { embed: mockEmbed }

const mockStoreExists = mock(async (_id: string): Promise<boolean> => true)
const mockStoreInsert = mock(
  async (collectionId: string, _points: VectorPoint[]): Promise<VectorStoreInsertResult> => ({
    collectionId,
    status: 'completed',
  })
)
const mockStoreSearch = mock(
  async (
    _id: string,
    _vector: number[],
    _options: RetrievalSearchOptions
  ): Promise<VectorSearchResult[]> => [
    { id: 0, payload: { text: 'found result' }, score: 0.9 },
  ]
)

const mockVectorStore: VectorStore = {
  exists: mockStoreExists,
  insert: mockStoreInsert,
  search: mockStoreSearch,
}

function makeService() {
  const mgmtService = new EmbeddingManagementService(mockVectorStore)
  const processingService = new EmbeddingProcessingService(mockEmbeddingProvider, mgmtService)
  return new EmbeddingQueryService(mgmtService, processingService)
}

function makeServiceWithConcurrencyLimit(queryCollectionsMaxConcurrency?: number) {
  const mgmtService = new EmbeddingManagementService(mockVectorStore)
  const processingService = new EmbeddingProcessingService(mockEmbeddingProvider, mgmtService)
  return new EmbeddingQueryService(mgmtService, processingService, { queryCollectionsMaxConcurrency })
}

describe('EmbeddingQueryService', () => {
  beforeEach(() => {
    mockEmbed.mockReset()
    mockStoreSearch.mockReset()

    mockEmbed.mockImplementation(async () => [{ index: 0, vector: queryVector }])
    mockStoreSearch.mockImplementation(async () => [
      { id: 0, payload: { text: 'found result' }, score: 0.9 },
    ])
  })

  describe('query', () => {
    it('returns search results for the given query', async () => {
      const service = makeService()
      const results = await service.query('test question', 'col-1', { filter: undefined, limit: 1 })

      expect(results).toEqual([{
        id: 0,
        metadata: {},
        score: 0.9,
        text: 'found result',
      }])
    })

    it('embeds the query string before searching', async () => {
      const service = makeService()
      await service.query('my query', 'col-1', { filter: undefined, limit: 1 })

      expect(mockEmbed.mock.calls[0]?.[0]).toEqual(['my query'])
    })

    it('passes the query vector and retrieval options to the vector store', async () => {
      let capturedId: string | undefined
      let capturedVector: number[] | undefined
      let capturedOptions: RetrievalSearchOptions | undefined

      mockStoreSearch.mockImplementation(async (id, vector, options) => {
        capturedId = id
        capturedVector = vector
        capturedOptions = options
        return [{ id: 0, payload: { text: 'found result' }, score: 0.9 }]
      })

      const service = makeService()
      await service.query('q', 'col-1', { filter: undefined, limit: 5 })

      expect(capturedId).toBe('col-1')
      expect(capturedVector).toEqual(queryVector)
      expect(capturedOptions).toEqual({ filter: undefined, limit: 5 })
    })

    it('throws when the embedding result is empty', async () => {
      mockEmbed.mockImplementation(async () => [])

      const service = makeService()
      await expect(service.query('q', 'col-1')).rejects.toThrow('Embedding is empty')
    })

    it('defaults retrieval to limit 1 with no filter when omitted', async () => {
      let capturedOptions: RetrievalSearchOptions | undefined

      mockStoreSearch.mockImplementation(async (_id, _vector, options) => {
        capturedOptions = options
        return [{ id: 0, payload: { text: 'found result' }, score: 0.9 }]
      })

      const service = makeService()
      await service.query('q', 'col-1')

      expect(capturedOptions?.limit).toBe(1)
      expect(capturedOptions?.filter).toBeUndefined()
    })
  })

  describe('queryCollections', () => {
    it('returns combined results from all collections', async () => {
      mockStoreSearch.mockImplementation(async (id, _vector, _options) =>
        id === 'col-a'
          ? [{ id: 0, payload: { text: 'result-a' }, score: 0.9 }]
          : [{ id: 1, payload: { text: 'result-b' }, score: 0.8 }]
      )

      const service = makeService()
      const results = await service.queryCollections('q', ['col-a', 'col-b'], { filter: undefined, limit: 1 })

      expect(results.map((result) => result.text)).toContain('result-a')
      expect(results.map((result) => result.text)).toContain('result-b')
    })

    it('embeds the query only once regardless of collection count', async () => {
      const service = makeService()
      await service.queryCollections('q', ['col-a', 'col-b', 'col-c'], { filter: undefined, limit: 1 })

      expect(mockEmbed.mock.calls).toHaveLength(1)
    })

    it('throws when the embedding result is empty', async () => {
      mockEmbed.mockImplementation(async () => [])

      const service = makeService()
      await expect(service.queryCollections('q', ['col-1'])).rejects.toThrow('Embedding is empty')
    })

    it('limits concurrent collection searches when configured', async () => {
      let activeSearches = 0
      let maxConcurrentSearches = 0

      mockStoreSearch.mockImplementation(async (collectionId, _vector, _options) => {
        activeSearches += 1
        maxConcurrentSearches = Math.max(maxConcurrentSearches, activeSearches)

        await new Promise((resolve) => setTimeout(resolve, 10))

        activeSearches -= 1
        return [{ id: collectionId, payload: { text: `result-${collectionId}` }, score: 0.9 }]
      })

      const service = makeServiceWithConcurrencyLimit(1)
      await service.queryCollections('q', ['col-a', 'col-b', 'col-c'], { filter: undefined, limit: 1 })

      expect(maxConcurrentSearches).toBe(1)
    })

    it('runs unbounded collection searches by default', async () => {
      let activeSearches = 0
      let maxConcurrentSearches = 0

      mockStoreSearch.mockImplementation(async (collectionId, _vector, _options) => {
        activeSearches += 1
        maxConcurrentSearches = Math.max(maxConcurrentSearches, activeSearches)

        await new Promise((resolve) => setTimeout(resolve, 10))

        activeSearches -= 1
        return [{ id: collectionId, payload: { text: `result-${collectionId}` }, score: 0.9 }]
      })

      const service = makeService()
      await service.queryCollections('q', ['col-a', 'col-b', 'col-c'], { filter: undefined, limit: 1 })

      expect(maxConcurrentSearches).toBeGreaterThan(1)
    })

    it('throws for invalid query collection concurrency limit', async () => {
      const service = makeServiceWithConcurrencyLimit(0)
      await expect(service.queryCollections('q', ['col-a'])).rejects.toThrow(
        'maxConcurrency must be an integer greater than 0.'
      )
    })
  })
})
