import type { ChatProvider } from '@/models/chat-provider.model'
import type { EmbeddingProvider } from '@/models/embedding-provider.model'
import type { Reranker } from '@/models/reranker.model'
import type { VectorStore } from '@/models/vector-store.model'

export interface RagConfig {
  chatProvider: ChatProvider
  embeddingProvider: EmbeddingProvider
  qdrant?: {
    url?: string
  }
  retrieval?: {
    candidateLimit?: number
    limit?: number
  }
  reranker?: Reranker
  tokenBudget?: number
  vectorStore?: VectorStore
}
