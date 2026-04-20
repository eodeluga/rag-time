/**
 * Result of an embedding ingestion operation.
 */
export interface EmbeddingResult {
  /**
   * Stable, content-addressable identifier for the created embedding collection.
   * `null` when the operation failed — inspect `message` for details.
   */
  embeddingId: string | null
  /** Human-readable description of the failure. Only present when `embeddingId` is `null`. */
  message?: string
}
