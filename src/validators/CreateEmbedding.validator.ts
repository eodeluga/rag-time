import { z } from 'zod'

export const CreateEmbeddingValidator = z.array(
  z.object({
    object: z.string(),
    index: z.number(),
    embedding: z.array(z.number()),
  })
)
