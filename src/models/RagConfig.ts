import type { ChatProvider } from '@/providers/ChatProvider'
import type { EmbeddingProvider } from '@/providers/EmbeddingProvider'
import type { VectorStore } from '@/stores/VectorStore'

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
  tokenBudget?: number
  vectorStore?: VectorStore
}
