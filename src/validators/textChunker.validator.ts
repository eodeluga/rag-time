import { z } from 'zod'

export const TextChunkerResponseValidator = z.object({
  chunks: z.array(z.object({
    index: z.number(),
    text: z.string(),
    summary: z.string(),
  })),
})
