import { QdrantDbConnection } from '@@utils/connectionManager.util'

export class EmbeddingQueryService {
  private embeddingService: EmbeddingService
  private embeddingIndexingService: EmbeddingIndexingService
  constructor(
    embeddingService: EmbeddingService,
    embeddingIndexingService: EmbeddingIndexingService
  ) {
    this.embeddingService = embeddingService
    this.embeddingIndexingService = embeddingIndexingService
  }
  
  async query(opts: { query: string, limit: number, openai: OpenAI }): Promise<string[]> {
    const { query, limit, openai } = opts
    const queryEmbedding = await this.embeddingService.embedChunks([{ text: query }])
    const client = await QdrantDbConnection.getQdrantClient()
    
    const results = await client.search(this.collectionId, {
      vector: queryEmbedding[0].vector,
      limit,
    })
    
    return results.map((result) => (result.payload?.text as string ?? ''))
  }
}
