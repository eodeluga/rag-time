import { z } from 'zod'

export const TextChunkerValidator = z.object({
  chunks: z.array(z.object({
    text: z.string(),
    summary: z.string(),
  })),
})
