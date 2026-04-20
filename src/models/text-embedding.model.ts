/**
 * A paired (text, vector) record produced during the embedding pipeline.
 */
export interface TextEmbedding {
  /** Zero-based position of this embedding in the source input sequence. */
  index: number
  /** The original text that was embedded. */
  text: string
  /** Dense embedding vector representing the text in model space. */
  vector: number[]
}
