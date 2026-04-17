import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { EmbeddingQueryService } from '@/services/embedding-query.service'
import { EmbeddingManagementService } from '@/services/embedding-management.service'
import { EmbeddingProcessingService } from '@/services/embedding-processing.service'
import type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'
import type { VectorStore, VectorPoint, VectorSearchResult, VectorStoreInsertResult } from '@/models/vector-store.model'

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
  async (_id: string, _v: number[], _l: number): Promise<VectorSearchResult[]> => [
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
      const results = await service.query('test question', 'col-1', 1)

      expect(results).toEqual(['found result'])
    })

    it('embeds the query string before searching', async () => {
      const service = makeService()
      await service.query('my query', 'col-1', 1)

      expect(mockEmbed.mock.calls[0]?.[0]).toEqual(['my query'])
    })

    it('passes the query vector and limit to the vector store', async () => {
      const service = makeService()
      await service.query('q', 'col-1', 5)

      const [collectionId, vector, limit] = mockStoreSearch.mock.calls[0]!
      expect(collectionId).toBe('col-1')
      expect(vector).toEqual(queryVector)
      expect(limit).toBe(5)
    })

    it('throws when the embedding result is empty', async () => {
      mockEmbed.mockImplementation(async () => [])

      const service = makeService()
      await expect(service.query('q', 'col-1')).rejects.toThrow('Embedding is empty')
    })

    it('defaults limit to 1', async () => {
      const service = makeService()
      await service.query('q', 'col-1')

      const [, , limit] = mockStoreSearch.mock.calls[0]!
      expect(limit).toBe(1)
    })
  })

  describe('queryCollections', () => {
    it('returns combined results from all collections', async () => {
      mockStoreSearch.mockImplementation(async (_id, _v, _l) =>
        _id === 'col-a'
          ? [{ id: 0, payload: { text: 'result-a' }, score: 0.9 }]
          : [{ id: 1, payload: { text: 'result-b' }, score: 0.8 }]
      )

      const service = makeService()
      const results = await service.queryCollections('q', ['col-a', 'col-b'], 1)

      expect(results).toContain('result-a')
      expect(results).toContain('result-b')
    })

    it('embeds the query only once regardless of collection count', async () => {
      const service = makeService()
      await service.queryCollections('q', ['col-a', 'col-b', 'col-c'], 1)

      expect(mockEmbed.mock.calls).toHaveLength(1)
    })

    it('throws when the embedding result is empty', async () => {
      mockEmbed.mockImplementation(async () => [])

      const service = makeService()
      await expect(service.queryCollections('q', ['col-1'])).rejects.toThrow('Embedding is empty')
    })
  })
})
