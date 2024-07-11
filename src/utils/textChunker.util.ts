import OpenAI from 'openai'
import type { DocumentChunk } from '@@models/DocumentChunk'
import type { ChatCompletionTool } from 'openai/resources/index.mjs'
import { TextChunkerResponseValidator } from '@@validators/textChunker.validator'

const textChunkFunction = {
  type: 'function',
  function: {
    name: 'text_chunker',
    description: 'Process text into chunks for RAG purposes',
    parameters: {
      type: 'object',
      properties: {
        chunks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: {
                type: 'integer',
                description: 'The index of the chunk',
              },
              text: {
                type: 'string',
                description: 'The text of the chunk',
              },
              summary: {
                type: 'string',
                description: 'Keywords used in `text` property',
              },
            },
          },
        },
      },
    },
  },
} satisfies ChatCompletionTool

const createPrompt = ((text: string) => (
  `${text}\n\n` +
  'Process the above text into a series of dynamically sized overlapping chunks and return a JSON array as the result'
))

const normaliseText = ((text: string) => text.replace(/[\n.,/#!$%^&*;:{}=\-_`~()]/g, '').toLowerCase())

async function chunkTextWithLlm(text: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    response_format: { type: 'json_object' },
    n: 1,
    tools: [textChunkFunction],
    tool_choice: 'auto',
    messages: [
      { role: 'system', content: 'You process text into chunks for RAG purposes' },
      { role: 'user', content: createPrompt(text) },
    ],
  })
  
  const textChunkFunctionArgs = response.choices[0].message?.tool_calls
    ? JSON.parse(response.choices[0].message.tool_calls[0].function.arguments)
    : []
    
  try {
    const validatedResponse = TextChunkerResponseValidator.parse(
      textChunkFunctionArgs
    ).chunks satisfies DocumentChunk[]
    
    return validatedResponse.map((chunk) => ({
      index: chunk.index,
      text: normaliseText(chunk.text),
      summary: normaliseText(chunk.summary),
    }))
  } catch (error) {
    console.error('Error parsing response:', error)
  }
}

export { chunkTextWithLlm }
