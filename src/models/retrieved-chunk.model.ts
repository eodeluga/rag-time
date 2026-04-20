import type { Chunk } from '@/models/chunk.model'

/**
 * A text chunk returned from a vector similarity search, augmented with retrieval identity and score.
 *
 * Extends {@link Chunk} with a store-level identifier and a relevance score produced
 * during nearest-neighbour search.
 */
export interface RetrievedChunk extends Chunk<Record<string, unknown>> {
  /** Unique identifier of this point in the vector store. */
  id: number | string
  /** Cosine similarity score in the range [0, 1]; higher indicates greater relevance. */
  score: number
}
