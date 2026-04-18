import type { Message } from '@/models/message.model'
import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

export interface RagResponse {
  answer: string
  history: Message[]
  sources: RetrievedChunk[]
}
