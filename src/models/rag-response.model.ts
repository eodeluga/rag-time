import type { Chunk } from '@/models/chunk.model'
import type { Message } from '@/models/message.model'

export interface RagResponse {
  answer: string
  history: Message[]
  sources: Chunk[]
}
