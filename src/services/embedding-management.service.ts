import type { VectorStore } from '@/models/vector-store.model'
import type { Metadata } from '@/models/metadata.model'
import type { TextEmbedding } from '@/models/text-embedding.model'
import type { EmbeddingInsertResult } from '@/models/embedding-insert-result.model'

class EmbeddingManagementService {
  private vectorStore: VectorStore

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore
  }

  async embeddingExists(embeddingId: string): Promise<boolean> {
    return this.vectorStore.exists(embeddingId)
  }

  async insertEmbedding(
    embeddingId: string,
    textEmbeddingArr: TextEmbedding[],
    metadata?: Metadata
  ): Promise<EmbeddingInsertResult> {
    const points = textEmbeddingArr.map((embedding) => ({
      id: embedding.index,
      payload: { index: embedding.index, text: embedding.text, ...(metadata ?? {}) },
      vector: embedding.vector,
    }))

    const result = await this.vectorStore.insert(embeddingId, points)

    return {
      embeddingId: result.collectionId,
      status: result.status as 'acknowledged' | 'completed',
    }
  }

  async searchByEmbedding(
    collectionId: string,
    opts: { embedding: TextEmbedding; limit: number }
  ): Promise<string[]> {
    const results = await this.vectorStore.search(
      collectionId,
      opts.embedding.vector,
      opts.limit
    )

    return results.map((result) => (result.payload['text'] as string) ?? '')
  }
}

export { EmbeddingManagementService }
