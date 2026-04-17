import type { Chunk } from './Chunk'
import type { Message } from './Message'

export interface RagResponse {
  answer: string
  history: Message[]
  sources: Chunk[]
}
