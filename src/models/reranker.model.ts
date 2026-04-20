import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

/**
 * Interface for post-retrieval reranking of candidate chunks.
 *
 * Implement this interface to apply a custom scoring or filtering step between
 * the vector retrieval stage and the final LLM call (e.g. using a cross-encoder model).
 *
 * @example
 * class CrossEncoderReranker implements Reranker {
 *   async rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
 *     // score and reorder chunks using a cross-encoder
 *   }
 * }
 */
export interface Reranker {
  /**
   * Reorders or filters `chunks` by relevance to `query`.
   *
   * @param {string} query - The user question used as the relevance reference.
   * @param {RetrievedChunk[]} chunks - Candidate chunks produced by the vector retrieval stage.
   * @returns {Promise<RetrievedChunk[]>} A promise resolving to the reranked (and optionally filtered) chunk array.
   */
  rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]>
}
