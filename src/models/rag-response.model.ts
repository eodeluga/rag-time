import type { Message } from '@/models/message.model'
import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

/**
 * Result returned by {@link BaseRag.query}.
 */
export interface RagResponse {
  /** The model's answer to the user's question. */
  answer: string
  /**
   * Updated conversation history including the latest question and answer.
   * Pass this back on subsequent calls to {@link BaseRag.query} to maintain multi-turn context.
   */
  history: Message[]
  /** Retrieved chunks that informed the answer, sorted by relevance score descending. */
  sources: RetrievedChunk[]
}
