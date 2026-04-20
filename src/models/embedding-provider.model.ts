/**
 * A single embedding vector produced by an {@link EmbeddingProvider}.
 */
interface EmbeddingVector {
  /** Zero-based position of this vector in the original input array. */
  index: number
  /** Dense numeric representation of the corresponding input text in model space. */
  vector: number[]
}

/**
 * Minimal contract for text embedding providers.
 *
 * Implement this interface to integrate any embedding model into the RAG pipeline.
 *
 * @example
 * class MyEmbedder implements EmbeddingProvider {
 *   async embed(inputs: string[]): Promise<EmbeddingVector[]> {
 *     // call your embedding API here
 *   }
 * }
 */
interface EmbeddingProvider {
  /**
   * Converts an array of text strings into dense embedding vectors.
   *
   * @param {string[]} inputs - Strings to embed. Order is preserved: `result[i].index === i`.
   * @returns {Promise<EmbeddingVector[]>} A promise that resolves to one {@link EmbeddingVector} per input string.
   */
  embed(inputs: string[]): Promise<EmbeddingVector[]>
}

export type {
  EmbeddingProvider,
  EmbeddingVector,
}
