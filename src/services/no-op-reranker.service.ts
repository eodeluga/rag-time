import type { Reranker } from '@/models/reranker.model'
import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

/**
 * A passthrough {@link Reranker} that returns chunks unchanged.
 *
 * Used as the default reranker in {@link BaseRag} when no custom reranker is provided
 * via {@link RagConfig}. Preserves the relevance order produced by the vector similarity search.
 */
export class NoOpRerankerService implements Reranker {
  /**
   * Returns `chunks` unchanged in their original order.
   *
   * @param {string} _query - Ignored; present to satisfy the {@link Reranker} interface.
   * @param {RetrievedChunk[]} chunks - Candidate chunks to pass through.
   * @returns {Promise<RetrievedChunk[]>} A promise that resolves immediately with the original chunk array.
   */
  rerank(_query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
    return Promise.resolve(chunks)
  }
}
