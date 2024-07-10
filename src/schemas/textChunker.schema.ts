import { z } from 'zod'

export const SuccessTextChunkerResponseSchema = z.object({
  chunks: z.array(z.object({
    index: z.number(),
    text: z.string(),
    summary: z.string(),
  })),
})
