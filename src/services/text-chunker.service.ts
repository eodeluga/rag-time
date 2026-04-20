import { TextChunkerValidator } from '@/validators/text-chunker.validator'
import { ChunkingError } from '@/errors/chunking.error'
import type { ChatProvider } from '@/models/chat-provider.model'
import type { TextChunk } from '@/models/text-chunk.model'

/**
 * Uses an LLM to split a body of text into semantically meaningful chunks.
 *
 * The underlying model is prompted to produce a JSON array of `{ text, summary }` objects.
 * Summaries are keyword phrases appended to the chunk text before embedding to boost
 * retrieval recall.
 */
export class TextChunkerService {
  private chatProvider: ChatProvider

  /**
   * @param {ChatProvider} chatProvider - LLM provider used to perform the chunking operation.
   */
  constructor(chatProvider: ChatProvider) {
    this.chatProvider = chatProvider
  }

  /**
   * Splits `text` into semantically coherent chunks using the configured LLM.
   *
   * @param {string} text - The body of text to split.
   * @returns {Promise<TextChunk[]>} An array of {@link TextChunk}s, each with a `text` segment
   *   and an optional keyword `summary`.
   * @throws {ChunkingError} If the LLM response cannot be parsed as valid JSON.
   */
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
      summary: chunk.summary,
      text: chunk.text,
    }))
  }
}
