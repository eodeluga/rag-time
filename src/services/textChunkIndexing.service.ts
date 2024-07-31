import { nanoid } from 'nanoid'
import { QdrantDbConnection } from '@@utils/connectionManager.util'
import type { TextEmbedding } from '@@models/TextEmbedding'
import type OpenAI from 'openai'
import { TextChunkEmbeddingService } from '@@services/textChunkEmbedding.service'

export class TextChunkIndexingService {
  private client = QdrantDbConnection
  // TODO: Change this for production
  // private collectionId = nanoid()
  private collectionId = 'text-embedding-collection'
   
  async insert(textEmbeddingArr: TextEmbedding[]) {
    const qdrantPoints = textEmbeddingArr.map((textEmbedding) => ({
      id: textEmbedding.index,
      vector: textEmbedding.embedding,
      payload: {
        index: textEmbedding.index,
        text: textEmbedding.text,
      },
    }))
    
    // const {exists: collectionExists } = await this.client.collectionExists(this.collectionId)
    
    // if (!collectionExists) {
    // await this.client.createCollection(this.collectionId, {
    await this.client.recreateCollection(this.collectionId, {
      vectors: {
        size: qdrantPoints[0].vector.length,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 2,
    })
    // }
    
    const result = await this.client.upsert(this.collectionId, {
      points: qdrantPoints,
    })
    
    return {
      collectionId: this.collectionId,
      status: result.status,
    }
  }

  async query(opts: { query: string, limit: number, openai: OpenAI }): Promise<string[]> {
    const { query, limit, openai } = opts
    const textEmbeddingService = new TextChunkEmbeddingService(openai)
    const queryEmbedding = await textEmbeddingService.embedChunks([{ text: query }])
    
    const results = await this.client.search(this.collectionId, {
      vector: queryEmbedding[0].embedding,
      limit,
    })
    
    return results.map((result) => (result.payload?.text as string ?? ''))
  }
  
}
