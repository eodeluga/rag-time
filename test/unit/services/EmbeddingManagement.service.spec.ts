import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { EmbeddingManagementService } from '@/services/embedding-management.service'
import type { VectorStore, VectorPoint, VectorSearchResult, VectorStoreInsertResult } from '@/models/vector-store.model'
import type { TextEmbedding } from '@/models/text-embedding.model'

const mockExists = mock(async (_collectionId: string): Promise<boolean> => false)

const mockInsert = mock(
  async (collectionId: string, _points: VectorPoint[]): Promise<VectorStoreInsertResult> => ({
    collectionId,
    status: 'completed',
  })
)

const mockSearch = mock(
  async (_collectionId: string, _vector: number[], _limit: number): Promise<VectorSearchResult[]> =>
    []
)

const mockVectorStore: VectorStore = {
  exists: mockExists,
  insert: mockInsert,
  search: mockSearch,
}

const sampleEmbeddings: TextEmbedding[] = [
  { index: 0, text: 'first chunk', vector: [0.1, 0.2, 0.3] },
  { index: 1, text: 'second chunk', vector: [0.4, 0.5, 0.6] },
]

describe('EmbeddingManagementService', () => {
  beforeEach(() => {
    mockExists.mockReset()
    mockInsert.mockReset()
    mockSearch.mockReset()

    mockExists.mockImplementation(async () => false)
    mockInsert.mockImplementation(async (collectionId) => ({ collectionId, status: 'completed' }))
    mockSearch.mockImplementation(async () => [])
  })

  describe('embeddingExists', () => {
    it('returns true when vectorStore.exists returns true', async () => {
      mockExists.mockImplementation(async () => true)

      const service = new EmbeddingManagementService(mockVectorStore)
      const result = await service.embeddingExists('col-1')

      expect(result).toBeTrue()
    })

    it('returns false when vectorStore.exists returns false', async () => {
      const service = new EmbeddingManagementService(mockVectorStore)
      const result = await service.embeddingExists('col-1')

      expect(result).toBeFalse()
    })

    it('passes the embeddingId to vectorStore.exists', async () => {
      const service = new EmbeddingManagementService(mockVectorStore)
      await service.embeddingExists('my-collection')

      expect(mockExists.mock.calls[0]?.[0]).toBe('my-collection')
    })
  })

  describe('insertEmbedding', () => {
    it('returns EmbeddingInsertResult with embeddingId and status', async () => {
      const service = new EmbeddingManagementService(mockVectorStore)
      const result = await service.insertEmbedding('col-1', sampleEmbeddings)

      expect(result.embeddingId).toBe('col-1')
      expect(result.status).toBe('completed')
    })

    it('maps TextEmbedding to VectorPoints with text and index in payload', async () => {
      let capturedPoints: VectorPoint[] = []

      mockInsert.mockImplementation(async (collectionId, points) => {
        capturedPoints = points
        return { collectionId, status: 'completed' }
      })

      const service = new EmbeddingManagementService(mockVectorStore)
      await service.insertEmbedding('col-1', sampleEmbeddings)

      expect(capturedPoints).toHaveLength(2)
      expect(capturedPoints[0]?.id).toBe(0)
      expect(capturedPoints[0]?.vector).toEqual([0.1, 0.2, 0.3])
      expect(capturedPoints[0]?.payload['text']).toBe('first chunk')
      expect(capturedPoints[0]?.payload['index']).toBe(0)
    })

    it('merges optional metadata into each point payload', async () => {
      let capturedPoints: VectorPoint[] = []

      mockInsert.mockImplementation(async (collectionId, points) => {
        capturedPoints = points
        return { collectionId, status: 'completed' }
      })

      const service = new EmbeddingManagementService(mockVectorStore)
      await service.insertEmbedding('col-1', sampleEmbeddings, { source: 'doc.pdf' })

      expect(capturedPoints[0]?.payload['source']).toBe('doc.pdf')
      expect(capturedPoints[0]?.payload['text']).toBe('first chunk')
    })

    it('throws when metadata attempts to override reserved payload keys', async () => {
      const service = new EmbeddingManagementService(mockVectorStore)

      await expect(
        service.insertEmbedding('col-1', sampleEmbeddings, { text: 'override attempt' })
      ).rejects.toThrow('reserved keys')
    })
  })

  describe('searchByEmbedding', () => {
    it('returns structured retrieved chunks with metadata and score', async () => {
      mockSearch.mockImplementation(async () => [
        { id: 0, payload: { source: 'doc-a', text: 'first chunk text' }, score: 0.9 },
        { id: 1, payload: { source: 'doc-b', text: 'second chunk text' }, score: 0.7 },
      ])

      const service = new EmbeddingManagementService(mockVectorStore)
      const embedding: TextEmbedding = { index: 0, text: 'query', vector: [0.1, 0.2] }
      const results = await service.searchByEmbedding('col-1', { embedding, limit: 2 })

      expect(results).toEqual([
        {
          id: 0,
          metadata: { source: 'doc-a' },
          score: 0.9,
          text: 'first chunk text',
        },
        {
          id: 1,
          metadata: { source: 'doc-b' },
          score: 0.7,
          text: 'second chunk text',
        },
      ])
    })

    it('passes the query vector and limit to vectorStore.search', async () => {
      mockSearch.mockImplementation(async () => [])

      const service = new EmbeddingManagementService(mockVectorStore)
      const queryVector = [0.5, 0.6, 0.7]
      const embedding: TextEmbedding = { index: 0, text: 'query', vector: queryVector }
      await service.searchByEmbedding('col-1', { embedding, limit: 5 })

      const [collectionId, vector, limit] = mockSearch.mock.calls[0]!
      expect(collectionId).toBe('col-1')
      expect(vector).toEqual(queryVector)
      expect(limit).toBe(5)
    })

    it('throws when vector payload text is missing', async () => {
      mockSearch.mockImplementation(async () => [
        { id: 0, payload: {}, score: 0.9 },
      ])

      const service = new EmbeddingManagementService(mockVectorStore)
      const embedding: TextEmbedding = { index: 0, text: 'q', vector: [0.1] }

      await expect(
        service.searchByEmbedding('col-1', { embedding, limit: 1 })
      ).rejects.toThrow()
    })
  })
})
