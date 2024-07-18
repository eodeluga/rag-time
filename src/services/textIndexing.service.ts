import { nanoid } from 'nanoid'
import { QdrantDbConnection } from '@@utils/connectionManager.util'
import type { TextEmbedding } from '@@models/TextEmbedding'

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
    
    const {exists: collectionExists } = await this.client.collectionExists(this.collectionId)
    
    if (!collectionExists) {
      console.log('Creating collection')
      await this.client.createCollection(this.collectionId, {
        vectors: {
          size: qdrantPoints[0].vector.length,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 2,
      })
    }
    
    const result = await this.client.upsert(this.collectionId, {
      points: qdrantPoints,
    })
    
    return {
      collectionId: this.collectionId,
      status: result.status,
    }
  }
}
