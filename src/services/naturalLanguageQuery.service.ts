export class NaturalLanguageQueryService {
  private embeddingService: EmbeddingService
  private embeddingIndexingService: EmbeddingIndexingService
  constructor(
    embeddingService: EmbeddingService,
    embeddingIndexingService: EmbeddingIndexingService
  ) {
    this.embeddingService = embeddingService
    this.embeddingIndexingService = embeddingIndexingService
  }
  
  
}
