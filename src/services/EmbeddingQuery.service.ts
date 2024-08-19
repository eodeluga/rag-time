import { QdrantDbConnection } from '@@utils/connectionManager.util'
import { EmbeddingProcessingService } from '@@services/EmbeddingProcessing.service'

export class EmbeddingQueryService {
  private embeddingProcessingService: EmbeddingProcessingService
  constructor(
    embeddingProcessingService: EmbeddingProcessingService
  ) {
    this.embeddingProcessingService = embeddingProcessingService
  }
  
  async query(query: string, embeddingId: string, limit = 1): Promise<string[]> {
    const queryEmbedding = await this.embeddingProcessingService.createTextEmbedding(query)
    const client = await QdrantDbConnection.getQdrantClient()
    
    const results = await client.search(embeddingId, {
      vector: queryEmbedding[0].vector,
      limit,
    })
    
    return results.map((result) => (result.payload?.text as string ?? ''))
  }
}
