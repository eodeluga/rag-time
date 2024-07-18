import { z } from 'zod'

export const LlmEmbeddingValidator = z.array(
  z.object({
    object: z.string(),
    index: z.number(),
    embedding: z.array(z.number()),
  })
)
