import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { EmbeddingProcessingService } from '@/services/embedding-processing.service'
import { EmbeddingManagementService } from '@/services/embedding-management.service'
import { EmbeddingError } from '@/errors/embedding.error'
import type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'
import type { VectorStore, VectorPoint, VectorSearchResult, VectorStoreInsertResult } from '@/models/vector-store.model'
import type { TextChunk } from '@/models/text-chunk.model'

const mockEmbed = mock(
  async (_inputs: string[]): Promise<EmbeddingVector[]> => [
    { index: 0, vector: [0.1, 0.2, 0.3] },
  ]
)

const mockEmbeddingProvider: EmbeddingProvider = { embed: mockEmbed }

const mockStoreExists = mock(async (_id: string): Promise<boolean> => false)
const mockStoreInsert = mock(
  async (collectionId: string, _points: VectorPoint[]): Promise<VectorStoreInsertResult> => ({
    collectionId,
    status: 'completed',
  })
)
const mockStoreSearch = mock(
  async (_id: string, _v: number[], _l: number): Promise<VectorSearchResult[]> => []
)

const mockVectorStore: VectorStore = {
  exists: mockStoreExists,
  insert: mockStoreInsert,
  search: mockStoreSearch,
}

const chunkFn = async (_text: string): Promise<TextChunk[]> => [
  { summary: 'keywords', text: 'chunked content' },
]

function makeService() {
  return new EmbeddingProcessingService(
    mockEmbeddingProvider,
    new EmbeddingManagementService(mockVectorStore)
  )
}

describe('EmbeddingProcessingService', () => {
  beforeEach(() => {
    mockEmbed.mockReset()
    mockStoreExists.mockReset()
    mockStoreInsert.mockReset()

    mockEmbed.mockImplementation(async (_inputs) => [{ index: 0, vector: [0.1, 0.2, 0.3] }])
    mockStoreExists.mockImplementation(async () => false)
    mockStoreInsert.mockImplementation(async (collectionId) => ({
      collectionId,
      status: 'completed',
    }))
  })

  describe('createTextEmbedding', () => {
    it('returns TextEmbedding array for a single string input', async () => {
      const service = makeService()
      const result = await service.createTextEmbedding('hello')

      expect(result).toHaveLength(1)
      expect(result[0]?.text).toBe('hello')
      expect(result[0]?.vector).toEqual([0.1, 0.2, 0.3])
      expect(result[0]?.index).toBe(0)
    })

    it('returns TextEmbedding array for an array of strings', async () => {
      mockEmbed.mockImplementation(async (inputs) =>
        inputs.map((_, idx) => ({ index: idx, vector: [idx * 0.1] }))
      )

      const service = makeService()
      const result = await service.createTextEmbedding(['first', 'second'])

      expect(result).toHaveLength(2)
      expect(result[0]?.text).toBe('first')
      expect(result[1]?.text).toBe('second')
    })

    it('throws EmbeddingError when provider returns an out-of-bounds index', async () => {
      mockEmbed.mockImplementation(async () => [{ index: 99, vector: [0.1] }])

      const service = makeService()
      await expect(service.createTextEmbedding(['only one'])).rejects.toBeInstanceOf(EmbeddingError)
    })

    it('passes inputs array directly to provider', async () => {
      const service = makeService()
      await service.createTextEmbedding(['a', 'b', 'c'])

      expect(mockEmbed.mock.calls[0]?.[0]).toEqual(['a', 'b', 'c'])
    })
  })

  describe('embedText', () => {
    it('returns embeddingId when text is successfully embedded', async () => {
      const service = makeService()
      const result = await service.embedText('some text', { chunkFn })

      expect(typeof result.embeddingId).toBe('string')
      expect(result.embeddingId).not.toBeNull()
    })

    it('skips chunking and embedding when collection already exists', async () => {
      mockStoreExists.mockImplementation(async () => true)

      const service = makeService()
      const spyChunkFn = mock(chunkFn)
      await service.embedText('some text', { chunkFn: spyChunkFn })

      expect(spyChunkFn.mock.calls).toHaveLength(0)
      expect(mockEmbed.mock.calls).toHaveLength(0)
    })

    it('returns null embeddingId when chunkFn is missing', async () => {
      const service = makeService()
      const result = await service.embedText('text with no chunk fn')

      expect(result.embeddingId).toBeNull()
      expect(result.message).toContain('chunkFn is required')
    })

    it('returns null embeddingId and message on unexpected error', async () => {
      mockStoreExists.mockImplementation(async () => {
        throw new Error('connection refused')
      })

      const service = makeService()
      const result = await service.embedText('text', { chunkFn })

      expect(result.embeddingId).toBeNull()
      expect(result.message).toContain('connection refused')
    })

    it('combines chunk text and summary before embedding', async () => {
      let capturedInputs: string[] = []

      mockEmbed.mockImplementation(async (inputs) => {
        capturedInputs = inputs
        return inputs.map((_, idx) => ({ index: idx, vector: [0.1] }))
      })

      const chunksWithSummary = async (): Promise<TextChunk[]> => [
        { summary: 'summary-kw', text: 'chunk text' },
      ]

      const service = makeService()
      await service.embedText('input', { chunkFn: chunksWithSummary })

      expect(capturedInputs[0]).toBe('chunk text.summary-kw')
    })

    it('passes metadata to insertEmbedding', async () => {
      let capturedPayloads: Record<string, unknown>[] = []

      mockStoreInsert.mockImplementation(async (collectionId, points) => {
        capturedPayloads = points.map((point) => point.payload)
        return { collectionId, status: 'completed' }
      })

      const service = makeService()
      await service.embedText('text', { chunkFn, metadata: { source: 'file.txt' } })

      expect(capturedPayloads[0]?.['source']).toBe('file.txt')
    })
  })
})
