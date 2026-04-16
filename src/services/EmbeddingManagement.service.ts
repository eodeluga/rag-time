import { QdrantDbConnection } from '@/utils/connectionManager.util'
import { VectorStoreError } from '@/errors/vector-store.error'
import type { TextEmbedding } from '@/models/TextEmbedding'
import type { EmbeddingInsertResult } from '@/models/EmbeddingInsertResult'

class EmbeddingManagementService {
  async embeddingExists(embeddingId: string): Promise<boolean> {
    try {
      const client = QdrantDbConnection.getQdrantClient()
      const { exists } = await client.collectionExists(embeddingId)
      return exists
    } catch (err) {
      throw new VectorStoreError(`Failed to check collection existence: ${embeddingId}`, err)
    }
  }

  async insertEmbedding(
    embeddingId: string,
    textEmbeddingArr: TextEmbedding[]
  ): Promise<EmbeddingInsertResult> {
    if (textEmbeddingArr.length === 0) {
      throw new VectorStoreError('Cannot insert an empty embedding array')
    }

    const qdrantPoints = textEmbeddingArr.map((textEmbedding) => ({
      id: textEmbedding.index,
      payload: {
        index: textEmbedding.index,
        text: textEmbedding.text,
      },
      vector: textEmbedding.vector,
    }))

    try {
      const client = QdrantDbConnection.getQdrantClient()

      await client.createCollection(embeddingId, {
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 2,
        vectors: {
          distance: 'Cosine',
          size: qdrantPoints[0]!.vector.length,
        },
      })

      const { status } = await client.upsert(embeddingId, {
        points: qdrantPoints,
      })

      return {
        embeddingId,
        status,
      }
    } catch (err) {
      throw new VectorStoreError(`Failed to insert embedding into collection: ${embeddingId}`, err)
    }
  }

  async searchByEmbedding(
    collectionId: string,
    opts: { embedding: TextEmbedding; limit: number }
  ): Promise<string[]> {
    try {
      const client = QdrantDbConnection.getQdrantClient()
      const results = await client.search(collectionId, {
        limit: opts.limit,
        vector: opts.embedding.vector,
      })

      return results.map((result) => (result.payload?.['text'] as string) ?? '')
    } catch (err) {
      throw new VectorStoreError(`Failed to search collection: ${collectionId}`, err)
    }
  }
}

export { EmbeddingManagementService }
