import OpenAI from 'openai'
import { TextChunkerFunction } from '@/functions/textChunker.function'
import { TextChunkerValidator } from '@/validators/TextChunker.validator'
import type { TextChunk } from '@/models/TextChunk'

/**
* Service for chunking text using OpenAI's chat completions and normalising text.
*
* This class interacts with OpenAI to process and chunk text into manageable pieces,
* and includes methods for normalising text to ensure consistency.
*
* @class
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
  
  /**
  * Creates an instance of TextChunkerService.
  *
  * @param {OpenAI} llm - The OpenAI client used for generating text chunks.
  * @param {string} [model='gpt-3.5-turbo'] - The model to use for text chunking, defaults to 'gpt-3.5-turbo'.
  */
  constructor(llm: OpenAI, model = 'gpt-3.5-turbo') {
    this.openai = llm
    this.model = model
  }

  /**
  * Chunks the provided text into manageable pieces using OpenAI's chat completions.
  *
  * @param {string} text - The text to be chunked.
  * @returns {Promise<TextChunk[]>} - A promise that resolves to an array of text chunks.
  */
  async chunk(text: string): Promise<TextChunk[]> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      temperature: 1,
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
          content: `Make chunks from following sentences: ${text}`
            + '\n\nReturn the sentences as JSON array',
        },
      ],
    })
    
    const validation = typeof response.choices[0]?.message.tool_calls === 'object'
      && Array.isArray(response.choices[0]?.message.tool_calls)
      && typeof response.choices[0]?.message.tool_calls[0]?.function.arguments === 'string'
    ? JSON.parse(response.choices[0].message.tool_calls[0].function.arguments)
    : []
    
    const textChunker = TextChunkerValidator.parse(validation)

    return textChunker.chunks.map((chunk) => ({
      summary: this.normaliseText(chunk.summary),
      text: this.normaliseText(chunk.text),
    })) satisfies TextChunk[]
  }
}
