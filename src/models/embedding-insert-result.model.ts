/**
 * Result of inserting embeddings into a vector collection.
 */
export interface EmbeddingInsertResult {
  /** Identifier of the collection the embeddings were inserted into. */
  embeddingId: string
  /** Persistence status reported by the underlying store (e.g. `'acknowledged'` or `'completed'`). */
  status: string
}
