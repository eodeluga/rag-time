import type { ChatCompletionTool } from 'openai/resources/index.mjs'

export const sentenceSplitterFunction = {
  type: 'function',
  function: {
    name: 'sentence_splitter',
    description: 'Semantically splits text into an array of sentences',
    parameters: {
      type: 'object',
      properties: {
        sentences: {
          type: 'array',
          items: {
            type: 'string',
            description: 'A sentence from the text',
          },
        },
      },
    },
  },
} satisfies ChatCompletionTool
