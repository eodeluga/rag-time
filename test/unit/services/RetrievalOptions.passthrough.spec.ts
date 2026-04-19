import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { EmbeddingManagementService } from '@/services/embedding-management.service'
import { EmbeddingQueryService } from '@/services/embedding-query.service'
import { EmbeddingProcessingService } from '@/services/embedding-processing.service'
import type { VectorStore, VectorPoint, VectorSearchResult, VectorStoreInsertResult } from '@/models/vector-store.model'
import type { RetrievalSearchOptions } from '@/models/vector-filter.model'
import type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'
import type { TextEmbedding } from '@/models/text-embedding.model'

const queryVector = [0.5, 0.6, 0.7]

const mockEmbed = mock(
  async (_inputs: string[]): Promise<EmbeddingVector[]> => [
    { index: 0, vector: queryVector },
  ]
)

const mockEmbeddingProvider: EmbeddingProvider = { embed: mockEmbed }

const mockExists = mock(async (_collectionId: string): Promise<boolean> => false)
const mockInsert = mock(
  async (collectionId: string, _points: VectorPoint[]): Promise<VectorStoreInsertResult> => ({
    collectionId,
    status: 'completed',
  })
)
const mockSearch = mock(
  async (
    _collectionId: string,
    _vector: number[],
    _options: RetrievalSearchOptions
  ): Promise<VectorSearchResult[]> => [
    { id: 0, payload: { text: 'result' }, score: 0.9 },
  ]
)

const mockVectorStore: VectorStore = {
  exists: mockExists,
  insert: mockInsert,
  search: mockSearch,
}

describe('RetrievalOptions passthrough', () => {
  beforeEach(() => {
    mockEmbed.mockReset()
    mockSearch.mockReset()

    mockEmbed.mockImplementation(async () => [{ index: 0, vector: queryVector }])
    mockSearch.mockImplementation(async () => [{ id: 0, payload: { text: 'result' }, score: 0.9 }])
  })

  describe('EmbeddingManagementService.searchByEmbedding', () => {
    it('passes retrieval limit and filter to vectorStore.search', async () => {
      let capturedOptions: unknown

      mockSearch.mockImplementation(async (_collectionId, _vector, options) => {
        capturedOptions = options
        return []
      })

      const service = new EmbeddingManagementService(mockVectorStore)
      const embedding: TextEmbedding = { index: 0, text: 'query', vector: queryVector }
      const retrieval: RetrievalSearchOptions = {
        filter: { field: 'source', operator: 'eq', value: 'doc.pdf' },
        limit: 10,
      }

      await service.searchByEmbedding('col-1', { embedding, retrieval })

      expect(capturedOptions).toEqual(retrieval)
    })

    it('passes retrieval with no filter to vectorStore.search', async () => {
      let capturedOptions: unknown

      mockSearch.mockImplementation(async (_collectionId, _vector, options) => {
        capturedOptions = options
        return []
      })

      const service = new EmbeddingManagementService(mockVectorStore)
      const embedding: TextEmbedding = { index: 0, text: 'query', vector: queryVector }
      const retrieval: RetrievalSearchOptions = { filter: undefined, limit: 5 }

      await service.searchByEmbedding('col-1', { embedding, retrieval })

      const opts = capturedOptions as RetrievalSearchOptions
      expect(opts.limit).toBe(5)
      expect(opts.filter).toBeUndefined()
    })
  })

  describe('EmbeddingQueryService.query', () => {
    it('defaults retrieval to limit 1 with no filter when omitted', async () => {
      let capturedOptions: unknown

      mockSearch.mockImplementation(async (_collectionId, _vector, options) => {
        capturedOptions = options
        return [{ id: 0, payload: { text: 'result' }, score: 0.9 }]
      })

      const mgmtService = new EmbeddingManagementService(mockVectorStore)
      const processingService = new EmbeddingProcessingService(mockEmbeddingProvider, mgmtService)
      const queryService = new EmbeddingQueryService(mgmtService, processingService)

      await queryService.query('test', 'col-1')

      const opts = capturedOptions as RetrievalSearchOptions
      expect(opts.limit).toBe(1)
      expect(opts.filter).toBeUndefined()
    })

    it('passes retrieval options unchanged when provided', async () => {
      let capturedOptions: unknown

      mockSearch.mockImplementation(async (_collectionId, _vector, options) => {
        capturedOptions = options
        return [{ id: 0, payload: { text: 'result' }, score: 0.9 }]
      })

      const mgmtService = new EmbeddingManagementService(mockVectorStore)
      const processingService = new EmbeddingProcessingService(mockEmbeddingProvider, mgmtService)
      const queryService = new EmbeddingQueryService(mgmtService, processingService)
      const retrieval: RetrievalSearchOptions = {
        filter: { field: 'source', operator: 'eq', value: 'doc.pdf' },
        limit: 7,
      }

      await queryService.query('test', 'col-1', retrieval)

      expect(capturedOptions).toEqual(retrieval)
    })
  })

  describe('EmbeddingQueryService.queryCollections', () => {
    it('passes retrieval options to each collection search', async () => {
      const capturedOptionsList: unknown[] = []

      mockSearch.mockImplementation(async (_collectionId, _vector, options) => {
        capturedOptionsList.push(options)
        return [{ id: 0, payload: { text: 'result' }, score: 0.9 }]
      })

      const mgmtService = new EmbeddingManagementService(mockVectorStore)
      const processingService = new EmbeddingProcessingService(mockEmbeddingProvider, mgmtService)
      const queryService = new EmbeddingQueryService(mgmtService, processingService)
      const retrieval: RetrievalSearchOptions = {
        filter: { field: 'category', operator: 'ne', value: 'archived' },
        limit: 3,
      }

      await queryService.queryCollections('test', ['col-a', 'col-b'], retrieval)

      expect(capturedOptionsList).toHaveLength(2)
      expect(capturedOptionsList[0]).toEqual(retrieval)
      expect(capturedOptionsList[1]).toEqual(retrieval)
    })

    it('defaults retrieval to limit 1 with no filter when omitted', async () => {
      let capturedOptions: unknown

      mockSearch.mockImplementation(async (_collectionId, _vector, options) => {
        capturedOptions = options
        return [{ id: 0, payload: { text: 'result' }, score: 0.9 }]
      })

      const mgmtService = new EmbeddingManagementService(mockVectorStore)
      const processingService = new EmbeddingProcessingService(mockEmbeddingProvider, mgmtService)
      const queryService = new EmbeddingQueryService(mgmtService, processingService)

      await queryService.queryCollections('test', ['col-1'])

      const opts = capturedOptions as RetrievalSearchOptions
      expect(opts.limit).toBe(1)
      expect(opts.filter).toBeUndefined()
    })
  })
})
