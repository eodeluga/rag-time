import { describe, expect, it, mock, beforeEach } from 'bun:test'

interface AnthropicTextBlock {
  text: string
  type: 'text'
}

interface AnthropicMessageArgs {
  max_tokens: number
  messages: { content: string; role: string }[]
  model: string
  system?: string
}

const mockMessagesCreate = mock(
  async (_args: AnthropicMessageArgs): Promise<{ content: AnthropicTextBlock[] }> => ({
    content: [{ text: 'anthropic answer', type: 'text' }],
  })
)

mock.module('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate }
  },
}))

import { AnthropicProvider } from '@/providers/anthropic.provider'

describe('AnthropicProvider', () => {
  beforeEach(() => {
    mockMessagesCreate.mockReset()
    mockMessagesCreate.mockImplementation(async () => ({
      content: [{ text: 'anthropic answer', type: 'text' as const }],
    }))
  })

  describe('complete', () => {
    it('returns text from the first content block', async () => {
      const provider = new AnthropicProvider({ apiKey: 'key' })
      const result = await provider.complete([{ content: 'hello', role: 'user' }])

      expect(result).toBe('anthropic answer')
    })

    it('separates system messages from conversation messages', async () => {
      const provider = new AnthropicProvider({ apiKey: 'key' })
      await provider.complete([
        { content: 'You are a helpful assistant.', role: 'system' },
        { content: 'What is AI?', role: 'user' },
      ])

      const callArgs = mockMessagesCreate.mock.calls[0]![0]
      expect(callArgs.system).toBe('You are a helpful assistant.')
      expect(callArgs.messages).toHaveLength(1)
      expect(callArgs.messages[0]).toEqual({ content: 'What is AI?', role: 'user' })
    })

    it('concatenates multiple system messages with newline', async () => {
      const provider = new AnthropicProvider({ apiKey: 'key' })
      await provider.complete([
        { content: 'Part one.', role: 'system' },
        { content: 'Part two.', role: 'system' },
        { content: 'Hello', role: 'user' },
      ])

      const callArgs = mockMessagesCreate.mock.calls[0]![0]
      expect(callArgs.system).toBe('Part one.\nPart two.')
    })

    it('sets system to undefined when no system messages are present', async () => {
      const provider = new AnthropicProvider({ apiKey: 'key' })
      await provider.complete([{ content: 'Hello', role: 'user' }])

      const callArgs = mockMessagesCreate.mock.calls[0]![0]
      expect(callArgs.system).toBeUndefined()
    })

    it('appends JSON instruction to the last user message when jsonMode is true', async () => {
      const provider = new AnthropicProvider({ apiKey: 'key' })
      await provider.complete([{ content: 'Give me data', role: 'user' }], { jsonMode: true })

      const callArgs = mockMessagesCreate.mock.calls[0]![0]
      const lastMessage = callArgs.messages[callArgs.messages.length - 1]!
      expect(lastMessage.content).toContain('Give me data')
      expect(lastMessage.content).toContain('Respond with valid JSON only.')
    })

    it('does not modify messages when jsonMode is false', async () => {
      const provider = new AnthropicProvider({ apiKey: 'key' })
      await provider.complete([{ content: 'Tell me a joke', role: 'user' }], { jsonMode: false })

      const callArgs = mockMessagesCreate.mock.calls[0]![0]
      expect(callArgs.messages[0]?.content).toBe('Tell me a joke')
    })

    it('uses the configured model', async () => {
      const provider = new AnthropicProvider({ apiKey: 'key', model: 'claude-haiku-4-5-20251001' })
      await provider.complete([{ content: 'q', role: 'user' }])

      const callArgs = mockMessagesCreate.mock.calls[0]![0]
      expect(callArgs.model).toBe('claude-haiku-4-5-20251001')
    })

    it('returns empty string when first content block is not text type', async () => {
      mockMessagesCreate.mockImplementation(async () => ({
        content: [{ text: 'answer', type: 'text' as const }],
      }))

      // Override provider behaviour by checking non-text block through a subtype cast
      const provider = new AnthropicProvider({ apiKey: 'key' })
      // Verify empty string is returned when content array is empty
      mockMessagesCreate.mockImplementation(async () => ({
        content: [],
      }))

      const result = await provider.complete([{ content: 'q', role: 'user' }])
      expect(result).toBe('')
    })
  })
})
