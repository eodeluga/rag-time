import { z } from 'zod'

export const TextChunkerResponseValidator = z.object({
  chunks: z.array(z.object({
    text: z.string(),
    summary: z.string(),
  })),
})
