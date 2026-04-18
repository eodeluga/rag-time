export { BaseRag } from '@/plugins/base.plugin'
export { ConversationalRag } from '@/plugins/conversational.plugin'
export { DocumentRag } from '@/plugins/document.plugin'

export type { ChatProvider, CompletionOptions } from '@/models/chat-provider.model'
export type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'

export type {
  VectorPoint,
  VectorSearchResult,
  VectorStore,
  VectorStoreInsertResult,
} from '@/models/vector-store.model'

export { QdrantVectorStore } from '@/stores/qdrant-vector.store'

export { EmbeddingManagementService } from '@/services/embedding-management.service'
export { EmbeddingProcessingService } from '@/services/embedding-processing.service'
export { EmbeddingQueryService } from '@/services/embedding-query.service'
export { TextChunkerService } from '@/services/text-chunker.service'

export type { Chunk } from '@/models/chunk.model'
export type { EmbeddingInsertResult } from '@/models/embedding-insert-result.model'
export type { EmbeddingResult } from '@/models/embedding-result.model'
export type { Message } from '@/models/message.model'
export type { Metadata } from '@/models/metadata.model'
export type { RagConfig } from '@/models/rag-config.model'
export type { RagResponse } from '@/models/rag-response.model'
export type { TextChunk } from '@/models/text-chunk.model'
export type { TextEmbedding } from '@/models/text-embedding.model'
