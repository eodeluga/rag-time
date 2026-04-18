import { z } from 'zod'

const VectorSearchPayloadValidator = z.object({
  text: z.string().trim().min(1),
}).passthrough()

const VectorSearchResultValidator = z.object({
  id: z.union([z.number(), z.string()]),
  payload: VectorSearchPayloadValidator,
  score: z.number(),
})

export { VectorSearchResultValidator }
