import { describe, expect, it, mock, beforeEach } from 'bun:test'

interface ChatCallArgs {
  messages: { content: string; role: string }[]
  model: string
  response_format?: { type: string }
  temperature?: number
  top_p?: number
}

interface EmbedCallArgs {
  input: string[]
  model: string
}

const mockChatCreate = mock(
  async (_args: ChatCallArgs): Promise<{ choices: { message: { content: string | null } }[] }> => ({
    choices: [{ message: { content: 'hello from gpt' } }],
  })
)

const mockEmbedCreate = mock(
  async (_args: EmbedCallArgs): Promise<{ data: { embedding: number[]; index: number }[] }> => ({
    data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
  })
)

mock.module('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } }
    embeddings = { create: mockEmbedCreate }
  },
}))

import { OpenAIProvider } from '@/providers/OpenAIProvider'

describe('OpenAIProvider', () => {
  beforeEach(() => {
    mockChatCreate.mockReset()
    mockEmbedCreate.mockReset()

    mockChatCreate.mockImplementation(async () => ({
      choices: [{ message: { content: 'hello from gpt' } }],
    }))

    mockEmbedCreate.mockImplementation(async () => ({
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
    }))
  })

  describe('complete', () => {
    it('returns the message content from the API response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      const result = await provider.complete([{ content: 'hi', role: 'user' }])

      expect(result).toBe('hello from gpt')
    })

    it('maps Message array to OpenAI message format', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.complete([
        { content: 'You are helpful.', role: 'system' },
        { content: 'What is 2+2?', role: 'user' },
      ])

      const callArgs = mockChatCreate.mock.calls[0]![0]
      expect(callArgs.messages).toHaveLength(2)
      expect(callArgs.messages[0]).toEqual({ content: 'You are helpful.', role: 'system' })
    })

    it('sets response_format to json_object when jsonMode is true', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.complete([{ content: 'q', role: 'user' }], { jsonMode: true })

      const callArgs = mockChatCreate.mock.calls[0]![0]
      expect(callArgs.response_format).toEqual({ type: 'json_object' })
    })

    it('leaves response_format undefined when jsonMode is false', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.complete([{ content: 'q', role: 'user' }], { jsonMode: false })

      const callArgs = mockChatCreate.mock.calls[0]![0]
      expect(callArgs.response_format).toBeUndefined()
    })

    it('passes temperature and topP to the API call', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.complete([{ content: 'q', role: 'user' }], { temperature: 0.5, topP: 0.9 })

      const callArgs = mockChatCreate.mock.calls[0]![0]
      expect(callArgs.temperature).toBe(0.5)
      expect(callArgs.top_p).toBe(0.9)
    })

    it('uses the configured chatModel', async () => {
      const provider = new OpenAIProvider({ apiKey: 'key', chatModel: 'gpt-3.5-turbo' })
      await provider.complete([{ content: 'q', role: 'user' }])

      const callArgs = mockChatCreate.mock.calls[0]![0]
      expect(callArgs.model).toBe('gpt-3.5-turbo')
    })

    it('returns empty string when response content is null', async () => {
      mockChatCreate.mockImplementation(async () => ({
        choices: [{ message: { content: null } }],
      }))

      const provider = new OpenAIProvider({ apiKey: 'key' })
      const result = await provider.complete([{ content: 'q', role: 'user' }])

      expect(result).toBe('')
    })
  })

  describe('embed', () => {
    it('returns EmbeddingVector array from the API response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'key' })
      const result = await provider.embed(['hello', 'world'])

      expect(result).toHaveLength(1)
      expect(result[0]?.index).toBe(0)
      expect(result[0]?.vector).toEqual([0.1, 0.2, 0.3])
    })

    it('passes the inputs array and configured embeddingModel', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'key',
        embeddingModel: 'text-embedding-3-small',
      })
      await provider.embed(['a', 'b'])

      const callArgs = mockEmbedCreate.mock.calls[0]![0]
      expect(callArgs.input).toEqual(['a', 'b'])
      expect(callArgs.model).toBe('text-embedding-3-small')
    })
  })
})
