import { nanoid } from 'nanoid'
import { QdrantDbConnection } from '@@utils/connectionManager.util'
import type { TextEmbedding } from '@@models/TextEmbedding'
import { Distance, Vector, VectorParams } from '@qdrant/qdrant-js/grpc'

export class TextIndexingService {
  private client = QdrantDbConnection
  // TODO: Change this for production
  // private collectionId = nanoid()
  private collectionId = 'text-embedding-collection'
   
  async updateTextindex(textEmbeddingArr: TextEmbedding[]) {
    const qdrantPoints = textEmbeddingArr.map((textEmbedding) => ({
      id: textEmbedding.index,
      vector: textEmbedding.embedding,
      payload: {
        index: textEmbedding.index,
        text: textEmbedding.text,
      },
    }))
    
    const collectionExists = await this.client.collectionExists(this.collectionId)
    
    if (!collectionExists) {
      const collectionConfig = {
        size: qdrantPoints[0].vector.length,
        distance: Distance.Cosine,
      }
      
      await this.client.createCollection(this.collectionId, {})
    }
    
    const result = await this.client.upsert(this.collectionId, {
      points: qdrantPoints,
    })
    
    return {
      collectionId: this.collectionId,
      status: result.status,
    }
  }
  
  // public static async searchDocumentChunks(query: string, k: number) {
  //   const qdrant = await this.getQdrantClient()
  //   const { ids } = await qdrant.search({query, k})
  //   return ids
  // }
}
