import OpenAI from 'openai'
import type { DocumentChunk } from '@@models/DocumentChunk'
import type { ChatCompletionTool } from 'openai/resources/index.mjs'
import { SuccessTextChunkerResponseSchema } from '@@schemas/textChunker.schema'

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

async function chunkTextWithLlm(text: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  
  const prompt = ((text: string) => (
    `${text}\n\n` +
    'Process the above text into a series of dynamically sized overlapping chunks and return a JSON array as the result'
  ))
  
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    response_format: { type: 'json_object' },
    n: 1,
    tools: [textChunkFunction],
    tool_choice: 'auto',
    messages: [
      { role: 'system', content: 'You process text into chunks for RAG purposes' },
      { role: 'user', content: prompt(text) },
    ],
  })
  
  const funcArgs = response.choices[0].message?.tool_calls
    ? JSON.parse(response.choices[0].message.tool_calls[0].function.arguments)
    : []
    
  try {
    return SuccessTextChunkerResponseSchema.parse(
      funcArgs
    ).chunks satisfies DocumentChunk[]
  } catch (error) {
    console.error('Error parsing response:', error)
  }
}

export { chunkTextWithLlm }
