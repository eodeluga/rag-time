import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { TextChunkerService } from '@/services/text-chunker.service'
import { ChunkingError } from '@/errors/chunking.error'
import type { ChatProvider, CompletionOptions } from '@/models/chat-provider.model'
import type { Message } from '@/models/message.model'

const validChunksJson = JSON.stringify({
  chunks: [
    { text: 'Hello World', summary: 'Greeting' },
    { text: 'Foo Bar Baz', summary: 'Words' },
  ],
})

const mockComplete = mock(
  async (_messages: Message[], _options?: CompletionOptions): Promise<string> =>
    validChunksJson
)

const mockProvider: ChatProvider = { complete: mockComplete }

describe('TextChunkerService', () => {
  beforeEach(() => {
    mockComplete.mockReset()
    mockComplete.mockImplementation(async () => validChunksJson)
  })

  it('returns normalised TextChunk array on valid response', async () => {
    const service = new TextChunkerService(mockProvider)
    const chunks = await service.chunk('some text')

    expect(chunks).toHaveLength(2)
    expect(chunks[0]?.text).toBe('hello world')
    expect(chunks[0]?.summary).toBe('greeting')
  })

  it('normalises text to lowercase with punctuation stripped', async () => {
    mockComplete.mockImplementation(async () =>
      JSON.stringify({
        chunks: [{ text: 'Hello, World!', summary: 'Key: Word.' }],
      })
    )

    const service = new TextChunkerService(mockProvider)
    const chunks = await service.chunk('some text')

    expect(chunks[0]?.text).toBe('hello world')
    expect(chunks[0]?.summary).toBe('key word')
  })

  it('passes jsonMode and temperature options to provider', async () => {
    const service = new TextChunkerService(mockProvider)
    await service.chunk('input')

    const [, options] = mockComplete.mock.calls[0]!
    expect(options?.jsonMode).toBeTrue()
    expect(options?.temperature).toBe(0.3)
  })

  it('sends system and user messages to provider', async () => {
    const service = new TextChunkerService(mockProvider)
    await service.chunk('my input text')

    const [messages] = mockComplete.mock.calls[0]!
    expect(messages.some((message) => message.role === 'system')).toBeTrue()
    expect(messages.some((message) => message.role === 'user')).toBeTrue()
    expect(messages.some((message) => message.content.includes('my input text'))).toBeTrue()
  })

  it('throws ChunkingError when provider returns invalid JSON', async () => {
    mockComplete.mockImplementation(async () => 'not valid json {{')

    const service = new TextChunkerService(mockProvider)
    await expect(service.chunk('input')).rejects.toBeInstanceOf(ChunkingError)
  })

  it('throws ChunkingError with parse cause on invalid JSON', async () => {
    mockComplete.mockImplementation(async () => '{ invalid }')

    const service = new TextChunkerService(mockProvider)

    try {
      await service.chunk('input')
      expect(true).toBeFalse()
    } catch (err) {
      expect(err).toBeInstanceOf(ChunkingError)
      expect((err as ChunkingError).details).toBeInstanceOf(SyntaxError)
    }
  })

  it('throws when provider response fails Zod validation', async () => {
    mockComplete.mockImplementation(async () =>
      JSON.stringify({ chunks: [{ wrong: 'shape' }] })
    )

    const service = new TextChunkerService(mockProvider)
    await expect(service.chunk('input')).rejects.toThrow()
  })
})
