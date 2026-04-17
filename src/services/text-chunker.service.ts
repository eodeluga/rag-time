import { TextChunkerValidator } from '@/validators/text-chunker.validator'
import { ChunkingError } from '@/errors/chunking.error'
import type { ChatProvider } from '@/models/chat-provider.model'
import type { TextChunk } from '@/models/text-chunk.model'

class TextChunkerService {
  private chatProvider: ChatProvider

  private normaliseText = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  constructor(chatProvider: ChatProvider) {
    this.chatProvider = chatProvider
  }

  async chunk(text: string): Promise<TextChunk[]> {
    const response = await this.chatProvider.complete(
      [
        {
          content: 'You are a text chunking assistant. Always respond with valid JSON only.',
          role: 'system',
        },
        {
          content:
            'Split the following text into meaningful chunks for a RAG system. '
            + 'Return a JSON object with this exact structure: '
            + '{"chunks": [{"text": "the chunk text", "summary": "keywords for this chunk"}]}'
            + '\n\nText to chunk:\n' + text,
          role: 'user',
        },
      ],
      { jsonMode: true, temperature: 0.3 }
    )

    let parsed: unknown

    try {
      parsed = JSON.parse(response)
    } catch (err) {
      throw new ChunkingError('Failed to parse chunking response as JSON', err)
    }

    const validated = TextChunkerValidator.parse(parsed)

    return validated.chunks.map((chunk) => ({
      summary: this.normaliseText(chunk.summary),
      text: this.normaliseText(chunk.text),
    }))
  }
}

export { TextChunkerService }
