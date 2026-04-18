import { z } from 'zod'

const MessageValidator = z.object({
  content: z.string().trim().min(1),
  role: z.enum(['assistant', 'system', 'user']),
})

const QueryInputValidator = z.object({
  history: z.array(MessageValidator),
  question: z.string().trim().min(1),
})

export { QueryInputValidator }
