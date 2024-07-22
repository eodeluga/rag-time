import OpenAI from 'openai'
import { textChunkFunction } from '@@functions/textChunk.function'
import { TextChunkerResponseValidator } from '@@validators/textChunker.validator'

export class LlmTextSplitters {
  private openai
  
  private normaliseText = ((text: string) => text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  )
  
  constructor(llm: OpenAI) {
    this.openai = llm
  }
  
  async textChunker(text: string) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      response_format: { type: 'json_object' },
      temperature: 1,
      // max_tokens: 256,
      top_p: 0.5,
      frequency_penalty: 0,
      presence_penalty: 0,
      n: 1,
      tools: [textChunkFunction],
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
    
    const functionResponse = TextChunkerResponseValidator.parse(
      response.choices[0].message?.tool_calls
        ? JSON.parse(response.choices[0].message.tool_calls[0].function.arguments)
        : []
    )
    
    return functionResponse.chunks.map((chunk) => (
      this.normaliseText(chunk.summary)
      + ': ' 
      + this.normaliseText(chunk.text)
    ))
  }
}
