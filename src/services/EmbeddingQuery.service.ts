import { EmbeddingManagementService } from '@/services/EmbeddingManagement.service'
import { EmbeddingProcessingService } from '@/services/EmbeddingProcessing.service'

/**
* Service for querying embeddings within collections and across multiple collections.
*
* This class handles querying a collection based on a given query and embedding ID, as well as performing
* queries across multiple collections to find similar items.
*
* @class
*/
export class EmbeddingQueryService {
  private embeddingManagementService: EmbeddingManagementService
  private embeddingProcessingService: EmbeddingProcessingService
  
  /**
  * Creates an instance of EmbeddingQueryService.
  *
  * @param {EmbeddingManagementService} embeddingManagementService - Service for managing embeddings.
  * @param {EmbeddingProcessingService} embeddingProcessingService - Service for processing and creating embeddings.
  */
  constructor(
    embeddingManagementService: EmbeddingManagementService,
    embeddingProcessingService: EmbeddingProcessingService
  ) {
    this.embeddingManagementService = embeddingManagementService
    this.embeddingProcessingService = embeddingProcessingService
  }
  
  /**
  * Queries a specific collection for items similar to the provided query string.
  *
  * @param {string} query - The query string to search for.
  * @param {string} embeddingId - The ID of the collection to query.
  * @param {number} [limit=1] - The maximum number of results to return.
  * @returns {Promise<string[]>} - A promise that resolves to an array of similar items.
  */
  async query(query: string, embeddingId: string, limit = 1): Promise<string[]> {
    const queryEmbedding = (await this.embeddingProcessingService.createTextEmbedding(query))[0]
    
    if (!queryEmbedding) {
      throw new Error('Embedding is empty')
    }
    
    return this.embeddingManagementService.searchByEmbedding(embeddingId, {
      embedding: queryEmbedding,
      limit,
    })
  }
  
  /**
  * Queries multiple collections for items similar to the provided query string.
  *
  * @param {string} query - The query string to search for.
  * @param {string[]} embeddingIds - The IDs of the collections to query.
  * @param {number} [limit=1] - The maximum number of results to return from each collection.
  * @returns {Promise<string[]>} - A promise that resolves to an array of similar items from all collections.
  */
  async queryCollections(query: string, embeddingIds: string[], limit = 1): Promise<string[]> {
    const queryEmbedding = (await this.embeddingProcessingService.createTextEmbedding(query))[0]
    
    if (!queryEmbedding) {
      throw new Error('Embedding is empty')
    }
    
    const searchPromises = embeddingIds.map(embedding => 
      this.embeddingManagementService.searchByEmbedding(embedding, {
        embedding: queryEmbedding,
        limit,
      })
    )
    
    const results = await Promise.all(searchPromises)
    return results.flatMap(results => results)
  }
}
