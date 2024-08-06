import { z } from 'zod'

export const TextChunkEmbeddingValidator = z.array(
  z.object({
    object: z.string(),
    index: z.number(),
    embedding: z.array(z.number()),
  })
)
