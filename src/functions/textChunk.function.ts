import type { ChatCompletionTool } from 'openai/resources/index.mjs';

export const textChunkFunction = {
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
