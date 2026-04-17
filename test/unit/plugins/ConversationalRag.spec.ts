import { describe, expect, it, mock, beforeAll, beforeEach } from 'bun:test'
import { ConversationalRag } from '@/plugins/conversational.plugin'
import type { ChatProvider, CompletionOptions } from '@/models/chat-provider.model'
import type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'
import type { VectorStore, VectorPoint, VectorSearchResult, VectorStoreInsertResult } from '@/models/vector-store.model'
import type { Message } from '@/models/message.model'

const chunkJson = JSON.stringify({
  chunks: [{ text: 'Historical fact', summary: 'history' }],
})

const mockComplete = mock(
  async (_messages: Message[], options?: CompletionOptions): Promise<string> => {
    if (options?.jsonMode) { return chunkJson }
    return 'The answer is 42.'
  }
)

const mockEmbed = mock(
  async (_inputs: string[]): Promise<EmbeddingVector[]> => [
    { index: 0, vector: [0.1, 0.2, 0.3] },
  ]
)

const mockStoreExists = mock(async (_id: string): Promise<boolean> => false)
const mockStoreInsert = mock(
  async (collectionId: string, _points: VectorPoint[]): Promise<VectorStoreInsertResult> => ({
    collectionId,
    status: 'completed',
  })
)
const mockStoreSearch = mock(
  async (_id: string, _v: number[], _l: number): Promise<VectorSearchResult[]> => [
    { id: 0, payload: { text: 'relevant context chunk', index: 0 }, score: 0.9 },
  ]
)

const mockChatProvider: ChatProvider = { complete: mockComplete }
const mockEmbeddingProvider: EmbeddingProvider = { embed: mockEmbed }
const mockVectorStore: VectorStore = {
  exists: mockStoreExists,
  insert: mockStoreInsert,
  search: mockStoreSearch,
}

function makeRag() {
  return new ConversationalRag({
    chatProvider: mockChatProvider,
    embeddingProvider: mockEmbeddingProvider,
    vectorStore: mockVectorStore,
  })
}

describe('ConversationalRag (RagPlugin)', () => {
  describe('ingest', () => {
    beforeEach(() => {
      mockComplete.mockReset()
      mockEmbed.mockReset()
      mockStoreExists.mockReset()
      mockStoreInsert.mockReset()

      mockComplete.mockImplementation(async (_messages, options) =>
        options?.jsonMode ? chunkJson : 'answer'
      )
      mockEmbed.mockImplementation(async (inputs) =>
        inputs.map((_, idx) => ({ index: idx, vector: [0.1 * (idx + 1)] }))
      )
      mockStoreExists.mockImplementation(async () => false)
      mockStoreInsert.mockImplementation(async (collectionId) => ({
        collectionId,
        status: 'completed',
      }))
    })

    it('returns a non-null embeddingId after ingest', async () => {
      const rag = makeRag()
      const result = await rag.ingest('Some text to ingest.')

      expect(result.embeddingId).not.toBeNull()
      expect(typeof result.embeddingId).toBe('string')
    })

    it('skips re-embedding when collection already exists', async () => {
      mockStoreExists.mockImplementation(async () => true)

      const rag = makeRag()
      await rag.ingest('already embedded text')

      expect(mockStoreInsert.mock.calls).toHaveLength(0)
    })

    it('returns null embeddingId when embedding fails', async () => {
      mockEmbed.mockImplementation(async () => {
        throw new Error('provider down')
      })

      const rag = makeRag()
      const result = await rag.ingest('text')

      expect(result.embeddingId).toBeNull()
    })
  })

  describe('query', () => {
    let rag: ConversationalRag

    beforeAll(async () => {
      mockStoreExists.mockImplementation(async () => false)
      mockStoreInsert.mockImplementation(async (collectionId) => ({
        collectionId,
        status: 'completed',
      }))
      mockEmbed.mockImplementation(async (inputs) =>
        inputs.map((_, idx) => ({ index: idx, vector: [0.1 * (idx + 1)] }))
      )
      mockComplete.mockImplementation(async (_messages, options) =>
        options?.jsonMode ? chunkJson : 'The answer is 42.'
      )

      rag = makeRag()
      await rag.ingest('Context text about history.')
    })

    beforeEach(() => {
      mockStoreSearch.mockImplementation(async () => [
        { id: 0, payload: { text: 'relevant context chunk', index: 0 }, score: 0.9 },
      ])
      mockComplete.mockImplementation(async (_messages, options) =>
        options?.jsonMode ? chunkJson : 'The answer is 42.'
      )
    })

    it('throws when query is called before ingest', async () => {
      const freshRag = makeRag()
      await expect(freshRag.query('What is the answer?')).rejects.toThrow(
        'No content has been ingested'
      )
    })

    it('returns a RagResponse with answer, sources, and history', async () => {
      const response = await rag.query('What is the answer?')

      expect(typeof response.answer).toBe('string')
      expect(response.answer.length).toBeGreaterThan(0)
      expect(Array.isArray(response.sources)).toBeTrue()
      expect(Array.isArray(response.history)).toBeTrue()
    })

    it('includes user and assistant turns in the returned history', async () => {
      const response = await rag.query('A question.')

      expect(response.history.some((message) => message.role === 'user')).toBeTrue()
      expect(response.history.some((message) => message.role === 'assistant')).toBeTrue()
    })

    it('appends the new turn to the history passed in', async () => {
      const prior: Message[] = [
        { content: 'Previous question.', role: 'user' },
        { content: 'Previous answer.', role: 'assistant' },
      ]

      const response = await rag.query('Follow-up question.', prior)

      const userMessages = response.history.filter((message) => message.role === 'user')
      expect(userMessages.length).toBeGreaterThanOrEqual(2)
    })

    it('returns source chunks from the vector store', async () => {
      const response = await rag.query('Any question?')

      expect(response.sources.length).toBeGreaterThan(0)
      expect(response.sources[0]).toHaveProperty('text')
      expect(response.sources[0]).toHaveProperty('metadata')
    })

    it('deduplicates identical chunks from multiple query variants', async () => {
      mockStoreSearch.mockImplementation(async () => [
        { id: 0, payload: { text: 'duplicate chunk', index: 0 }, score: 0.9 },
        { id: 0, payload: { text: 'duplicate chunk', index: 0 }, score: 0.9 },
      ])

      const response = await rag.query('Question with duplicate results.')

      const texts = response.sources.map((source) => source.text)
      const uniqueTexts = [...new Set(texts)]
      expect(texts).toHaveLength(uniqueTexts.length)
    })
  })
})
