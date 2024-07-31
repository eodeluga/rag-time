import type { ChatCompletionTool } from 'openai/resources/index'

/**
 * @function text_chunker
 * @description LLM function to process text into chunks for RAG purposes
 * @param {Object} chunks - The chunks to process
 * @param {Array} chunks.chunks - The chunks to process
 * @param {String} chunks.chunks.text - The text of the chunk
 * @param {String} chunks.chunks.summary - Keyword summaries of text used in `text` property
 * @returns {Object} The processed chunks
 */
export const TextChunkerFunction = {
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
