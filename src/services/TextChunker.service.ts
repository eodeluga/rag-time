import OpenAI from 'openai'
import { TextChunkerFunction } from '@@functions/textChunker.function'
import { TextChunkerValidator } from '@@validators/TextChunker.validator'
import type { TextChunk } from '@@models/TextChunk'

/**
 * @class TextChunkerService
 * @classdesc TextChunkerService class for chunking text
 * @param {OpenAI} llm - OpenAI instance
 * @returns {TextChunk[]} TextChunk object
 */
export class TextChunkerService {
  private model: string
  private openai: OpenAI
  
  private normaliseText = ((text: string) => text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  )
  
  constructor(llm: OpenAI, model = 'gpt-3.5-turbo') {
    this.openai = llm
    this.model = model
  }
  
  /**
   * @function chunk
   * @description Chunk text into smaller parts
   * @param {String} text - The text to chunk
   * @returns {Array} The chunks of text
   */
  async chunk(text: string): Promise<TextChunk[]> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      temperature: 1,
      // max_tokens: 256,
      top_p: 0.5,
      frequency_penalty: 0,
      presence_penalty: 0,
      n: 1,
      tools: [TextChunkerFunction],
      tool_choice: 'auto',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { 
          role: 'user',
          content: `Make chunks from following sentences: "${text}"` 
            + '\n\nReturn the sentences as JSON array',
        },
      ],
    })
    
    const textChunker = TextChunkerValidator.parse(
      response.choices[0].message?.tool_calls
        ? JSON.parse(response.choices[0].message.tool_calls[0].function.arguments)
        : []
    )
    
    return textChunker.chunks.map((chunk) => ({
      summary: this.normaliseText(chunk.summary),
      text: this.normaliseText(chunk.text),
    })) satisfies TextChunk[]
  }
}
