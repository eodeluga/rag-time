/**
 * A discrete segment of text, optionally annotated with metadata and a keyword summary.
 *
 * @template TMetadata - Shape of the metadata object. Defaults to `Record<string, unknown>`.
 */
export interface Chunk<TMetadata = Record<string, unknown>> {
  /** Arbitrary metadata associated with this chunk (e.g. source document, page number). */
  metadata: TMetadata
  /** Short keyword or phrase summary used to improve retrieval recall. */
  summary?: string
  /** The raw text content of this chunk. */
  text: string
}
