import { z } from 'zod'

export const SentenceSplitterResponseValidator = z.object({
  sentences: z.array(z.string()),
})
