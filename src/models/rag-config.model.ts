import type { ChatProvider } from '@/models/chat-provider.model'
import type { EmbeddingProvider } from '@/models/embedding-provider.model'
import type { QdrantVectorStoreConfig } from '@/models/qdrant-config.model'
import type { Reranker } from '@/models/reranker.model'
import type { VectorStore } from '@/models/vector-store.model'

/**
 * Top-level configuration object passed to {@link BaseRag} and its subclasses.
 *
 * @example
 * const config: RagConfig = {
 *   chatProvider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }),
 *   embeddingProvider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }),
 *   retrieval: { limit: 5, candidateLimit: 20 },
 * }
 */
export interface RagConfig {
  /** LLM provider used for query completions and LLM-assisted text chunking. */
  chatProvider: ChatProvider
  /** Provider used to generate embedding vectors for ingested text and queries. */
  embeddingProvider: EmbeddingProvider
  /**
   * Qdrant-specific connection and collection settings.
   * Ignored when `vectorStore` is provided.
   * Defaults to connecting via `QDRANT_URL` env var, or `http://localhost:6333`.
   */
  qdrant?: QdrantVectorStoreConfig
  /** Retrieval tuning parameters. */
  retrieval?: {
    /**
     * Number of candidate chunks fetched from the vector store before reranking.
     * A higher value improves recall at the cost of reranking time.
     * @defaultValue 20
     */
    candidateLimit?: number
    /**
     * Number of top chunks passed to the LLM after reranking.
     * @defaultValue 5
     */
    limit?: number
  }
  /**
   * Custom reranker applied to candidate chunks before the final LLM call.
   * Defaults to {@link NoOpRerankerService}, which preserves retrieval order.
   */
  reranker?: Reranker
  /**
   * Approximate token budget for conversation history. Older messages are
   * automatically summarised when the history exceeds this budget.
   * @defaultValue 8000
   */
  tokenBudget?: number
  /**
   * Custom vector store implementation. When provided, `qdrant` config is ignored.
   * Defaults to {@link QdrantVectorStore}.
   */
  vectorStore?: VectorStore
}
