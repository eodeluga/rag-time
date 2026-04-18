import type { ChatProvider } from '@/models/chat-provider.model'
import type { EmbeddingProvider } from '@/models/embedding-provider.model'
import type { QdrantVectorStoreConfig } from '@/models/qdrant-config.model'
import type { Reranker } from '@/models/reranker.model'
import type { VectorStore } from '@/models/vector-store.model'

export interface RagConfig {
  chatProvider: ChatProvider
  embeddingProvider: EmbeddingProvider
  qdrant?: QdrantVectorStoreConfig
  retrieval?: {
    candidateLimit?: number
    limit?: number
  }
  reranker?: Reranker
  tokenBudget?: number
  vectorStore?: VectorStore
}
