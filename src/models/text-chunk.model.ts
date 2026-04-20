/**
 * A text segment produced by {@link TextChunkerService}.
 */
export interface TextChunk {
  /** Short keyword or phrase summary used to improve retrieval recall during embedding. */
  summary?: string
  /** The raw text content of this chunk. */
  text: string
}
