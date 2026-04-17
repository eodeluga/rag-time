import { QdrantClient } from '@qdrant/qdrant-js'
import { VectorStoreError } from '@/errors/vector-store.error'
import type {
  VectorPoint,
  VectorSearchResult,
  VectorStore,
  VectorStoreInsertResult,
} from '@/models/vector-store.model'

interface QdrantVectorStoreConfig {
  url?: string
}

class QdrantVectorStore implements VectorStore {
  private client: QdrantClient

  constructor(config: QdrantVectorStoreConfig = {}) {
    const url = config.url ?? process.env['QDRANT_URL'] ?? 'http://localhost:6333'
    this.client = new QdrantClient({ url })
  }

  async exists(collectionId: string): Promise<boolean> {
    try {
      const { exists } = await this.client.collectionExists(collectionId)
      return exists
    } catch (err) {
      throw new VectorStoreError(`Failed to check collection existence: ${collectionId}`, err)
    }
  }

  async insert(collectionId: string, points: VectorPoint[]): Promise<VectorStoreInsertResult> {
    if (points.length === 0) {
      throw new VectorStoreError('Cannot insert an empty points array')
    }

    try {
      await this.client.createCollection(collectionId, {
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 2,
        vectors: {
          distance: 'Cosine',
          size: points[0]!.vector.length,
        },
      })

      const { status } = await this.client.upsert(collectionId, {
        points: points.map((point) => ({
          id: point.id,
          payload: point.payload,
          vector: point.vector,
        })),
      })

      return { collectionId, status }
    } catch (err) {
      throw new VectorStoreError(`Failed to insert into collection: ${collectionId}`, err)
    }
  }

  async search(
    collectionId: string,
    queryVector: number[],
    limit: number
  ): Promise<VectorSearchResult[]> {
    try {
      const results = await this.client.search(collectionId, {
        limit,
        vector: queryVector,
      })

      return results.map((result) => ({
        id: result.id,
        payload: result.payload ?? {},
        score: result.score,
      }))
    } catch (err) {
      throw new VectorStoreError(`Failed to search collection: ${collectionId}`, err)
    }
  }
}

export { QdrantVectorStore }
