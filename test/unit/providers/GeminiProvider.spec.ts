import { describe, expect, it, mock, beforeEach } from 'bun:test'

interface ChatHistoryItem {
  parts: { text: string }[]
  role: string
}

interface StartChatOpts {
  history: ChatHistoryItem[]
}

interface ModelConfig {
  generationConfig?: { responseMimeType: string }
  model: string
}

const mockSendMessage = mock(
  async (_prompt: string): Promise<{ response: { text: () => string } }> => ({
    response: { text: () => 'gemini answer' },
  })
)

const mockStartChat = mock(
  (_opts: StartChatOpts): { sendMessage: typeof mockSendMessage } => ({
    sendMessage: mockSendMessage,
  })
)

const mockEmbedContent = mock(
  async (_text: string): Promise<{ embedding: { values: number[] } }> => ({
    embedding: { values: [0.1, 0.2, 0.3] },
  })
)

const mockGetGenerativeModel = mock((_config: ModelConfig) => ({
  embedContent: mockEmbedContent,
  startChat: mockStartChat,
}))

mock.module('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    getGenerativeModel = mockGetGenerativeModel
  },
}))

import { GeminiProvider } from '@/providers/gemini.provider'

describe('GeminiProvider', () => {
  beforeEach(() => {
    mockSendMessage.mockReset()
    mockStartChat.mockReset()
    mockEmbedContent.mockReset()
    mockGetGenerativeModel.mockReset()

    mockSendMessage.mockImplementation(async () => ({
      response: { text: () => 'gemini answer' },
    }))
    mockStartChat.mockImplementation((_opts) => ({ sendMessage: mockSendMessage }))
    mockEmbedContent.mockImplementation(async () => ({
      embedding: { values: [0.1, 0.2, 0.3] },
    }))
    mockGetGenerativeModel.mockImplementation((_config) => ({
      embedContent: mockEmbedContent,
      startChat: mockStartChat,
    }))
  })

  describe('complete', () => {
    it('returns text from the response', async () => {
      const provider = new GeminiProvider({ apiKey: 'key' })
      const result = await provider.complete([{ content: 'hello', role: 'user' }])

      expect(result).toBe('gemini answer')
    })

    it('uses the configured chat model', async () => {
      const provider = new GeminiProvider({ apiKey: 'key', chatModel: 'gemini-2.0-flash' })
      await provider.complete([{ content: 'q', role: 'user' }])

      const modelConfig = mockGetGenerativeModel.mock.calls[0]![0]
      expect(modelConfig.model).toBe('gemini-2.0-flash')
    })

    it('sets responseMimeType to application/json when jsonMode is true', async () => {
      const provider = new GeminiProvider({ apiKey: 'key' })
      await provider.complete([{ content: 'q', role: 'user' }], { jsonMode: true })

      const modelConfig = mockGetGenerativeModel.mock.calls[0]![0]
      expect(modelConfig.generationConfig?.responseMimeType).toBe('application/json')
    })

    it('prepends system content to the prompt when system messages are present', async () => {
      const provider = new GeminiProvider({ apiKey: 'key' })
      await provider.complete([
        { content: 'You are a guide.', role: 'system' },
        { content: 'Where am I?', role: 'user' },
      ])

      const sentPrompt = mockSendMessage.mock.calls[0]![0]
      expect(sentPrompt).toContain('You are a guide.')
      expect(sentPrompt).toContain('Where am I?')
    })

    it('builds chat history from all messages except the last', async () => {
      const provider = new GeminiProvider({ apiKey: 'key' })
      await provider.complete([
        { content: 'First question', role: 'user' },
        { content: 'First answer', role: 'assistant' },
        { content: 'Second question', role: 'user' },
      ])

      const chatOpts = mockStartChat.mock.calls[0]![0]
      expect(chatOpts.history).toHaveLength(2)
      expect(chatOpts.history[0]?.role).toBe('user')
      expect(chatOpts.history[1]?.role).toBe('model')
    })
  })

  describe('embed', () => {
    it('returns an EmbeddingVector for each input', async () => {
      mockEmbedContent.mockImplementation(async () => ({
        embedding: { values: [0.1, 0.2] },
      }))

      const provider = new GeminiProvider({ apiKey: 'key' })
      const result = await provider.embed(['first', 'second'])

      expect(result).toHaveLength(2)
      expect(result[0]?.index).toBe(0)
      expect(result[1]?.index).toBe(1)
      expect(result[0]?.vector).toEqual([0.1, 0.2])
    })

    it('uses the configured embedding model', async () => {
      const provider = new GeminiProvider({ apiKey: 'key', embeddingModel: 'text-embedding-005' })
      await provider.embed(['test'])

      const modelConfig = mockGetGenerativeModel.mock.calls[0]![0]
      expect(modelConfig.model).toBe('text-embedding-005')
    })

    it('calls embedContent for each input string', async () => {
      const provider = new GeminiProvider({ apiKey: 'key' })
      await provider.embed(['a', 'b', 'c'])

      expect(mockEmbedContent.mock.calls).toHaveLength(3)
    })
  })
})
