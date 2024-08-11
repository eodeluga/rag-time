import { QdrantDbConnection } from '@@utils/connectionManager.util'
import type { TextEmbedding } from '@@models/TextEmbedding'
import { CreateEmbedding } from '@@models/CreateEmbedding'

export class EmbeddingIndexingService {
  
  async embeddingExists(collectionId: string) {
    const client = await QdrantDbConnection.getQdrantClient()
    const { exists } = await client.collectionExists(collectionId)
    return exists
  }
  
  async insert(collectionId: string, textEmbeddingArr: TextEmbedding[]) {
    const qdrantPoints = textEmbeddingArr.map((textEmbedding) => ({
      id: textEmbedding.index,
      vector: textEmbedding.vector,
      payload: {
        index: textEmbedding.index,
        text: textEmbedding.text,
      },
    }))

    const client = await QdrantDbConnection.getQdrantClient()

    await client.createCollection(collectionId, {
      vectors: {
        size: qdrantPoints[0].vector.length,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 2,
    })
    
    const result = await client.upsert(collectionId, {
      points: qdrantPoints,
    })
    
    return {
      collectionId: collectionId,
      status: result.status,
    }
  }
  
  async findSimilar(collectionId: string, vectorEmbedding: CreateEmbedding, limit: number): Promise<string[]> {
    const client = await QdrantDbConnection.getQdrantClient()
    const results = await client.search(collectionId, {
      vector: vectorEmbedding.vector,
      limit,
    })
    
    return results.map((result) => (result.payload?.text as string ?? ''))
  }
}
