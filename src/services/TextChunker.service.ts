import OpenAI from 'openai'
import { TextChunkerFunction } from '@/functions/textChunker.function'
import { TextChunkerValidator } from '@/validators/TextChunker.validator'
import { ChunkingError } from '@/errors/chunking.error'
import type { TextChunk } from '@/models/TextChunk'

class TextChunkerService {
  private model: string

  private normaliseText = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  private openai: OpenAI

  constructor(llm: OpenAI, model = 'gpt-3.5-turbo') {
    this.model = model
    this.openai = llm
  }

  async chunk(text: string): Promise<TextChunk[]> {
    const response = await this.openai.chat.completions.create({
      frequency_penalty: 0,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content: `Make chunks from following sentences: ${text}`
            + '\n\nReturn the sentences as JSON array',
        },
      ],
      model: this.model,
      n: 1,
      presence_penalty: 0,
      response_format: { type: 'json_object' },
      temperature: 1,
      tool_choice: 'auto',
      tools: [TextChunkerFunction],
      top_p: 0.5,
    })

    const toolCall = response.choices[0]?.message.tool_calls?.[0]
    const rawArguments = toolCall?.function.arguments

    if (typeof rawArguments !== 'string') {
      throw new ChunkingError('No tool call arguments returned from chunking model')
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(rawArguments)
    } catch (err) {
      throw new ChunkingError('Failed to parse tool call response as JSON', err)
    }

    const validated = TextChunkerValidator.parse(parsed)

    return validated.chunks.map((chunk) => ({
      summary: this.normaliseText(chunk.summary),
      text: this.normaliseText(chunk.text),
    }))
  }
}

export { TextChunkerService }
