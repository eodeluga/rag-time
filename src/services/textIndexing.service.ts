import { nanoid } from 'nanoid'
import { QdrantDbConnection } from '@@utils/connectionManager.util'
import type { TextEmbedding } from '@@models/TextEmbedding'
import type OpenAI from 'openai'
import { TextEmbeddingService } from './textEmbedding.service'
import { encode } from 'gpt-3-encoder'

export class TextIndexingService {
  private client = QdrantDbConnection
  // TODO: Change this for production
  // private collectionId = nanoid()
  private collectionId = 'text-embedding-collection'
   
  async insertIndex(textEmbeddingArr: TextEmbedding[]) {
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

  async gpt3InsertIndex(textEmbeddingArr: TextEmbedding[]) {
    const largestEmbeddingSize = textEmbeddingArr.map((point) => point.embedding.length).sort((a, b) => b - a)[0]
    
    const padArray = (arr: number[], size: number) => {
      if (arr.length >= size) {
        return arr
      }
      const pad = arr.concat(Array(size - arr.length).fill(0))
      return pad
    }
    
    const qdrantPoints = textEmbeddingArr.map((textEmbedding) => ({
      id: textEmbedding.index,
      vector: textEmbedding.embedding.length < largestEmbeddingSize
        ? padArray(textEmbedding.embedding, largestEmbeddingSize)
        : textEmbedding.embedding,
      payload: {
        index: textEmbedding.index,
        text: textEmbedding.text,
      },
    }))
    
    
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
    
    const result = await this.client.upsert(this.collectionId, {
      points: qdrantPoints,
    })
    
    return {
      collectionId: this.collectionId,
      status: result.status,
    }
  }
  
  async searchIndex(query: string, limit: number, openai: OpenAI) {
    const textEmbeddingService = new TextEmbeddingService(openai)
    const queryEmbedding = await textEmbeddingService.embedSentences([query])
    
    const results = await this.client.search(this.collectionId, {
      vector: queryEmbedding[0].embedding,
      limit,
    })
    
    return results.map((result) => (result.payload ? result.payload.text : []))
  }
  
  async gpt3SearchIndex(query: string, limit: number) {
    const queryEmbedding = encode(query)    
    const results = await this.client.search(this.collectionId, {
      vector: queryEmbedding,
      limit,
    })
    
    return results.map((result) => (result.payload ? result.payload.text : []))
  }
}
