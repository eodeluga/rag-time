import { EmbeddingManagementService } from '@/services/embedding-management.service'
import { EmbeddingProcessingService } from '@/services/embedding-processing.service'
import { runWithOptionalConcurrencyLimit } from '@/utils/concurrency.util'
import type { RetrievalSearchOptions } from '@/models/vector-filter.model'
import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

type EmbeddingQueryServiceConfig = {
  queryCollectionsMaxConcurrency?: number
}

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
  private queryCollectionsMaxConcurrency: number | undefined
  
  /**
  * Creates an instance of EmbeddingQueryService.
  *
  * @param {EmbeddingManagementService} embeddingManagementService - Service for managing embeddings.
  * @param {EmbeddingProcessingService} embeddingProcessingService - Service for processing and creating embeddings.
  */
  constructor(
    embeddingManagementService: EmbeddingManagementService,
    embeddingProcessingService: EmbeddingProcessingService,
    config?: EmbeddingQueryServiceConfig
  ) {
    this.embeddingManagementService = embeddingManagementService
    this.embeddingProcessingService = embeddingProcessingService
    this.queryCollectionsMaxConcurrency = config?.queryCollectionsMaxConcurrency
  }
  
  /**
  * Queries a specific collection for items similar to the provided query string.
  *
  * @param {string} query - The query string to search for.
  * @param {string} embeddingId - The ID of the collection to query.
  * @param {RetrievalSearchOptions} [retrieval] - Retrieval options (limit defaults to 1, filter defaults to undefined).
  * @returns {Promise<RetrievedChunk[]>} - A promise that resolves to an array of similar items.
  */
  async query(
    query: string,
    embeddingId: string,
    retrieval: RetrievalSearchOptions = { filter: undefined, limit: 1 }
  ): Promise<RetrievedChunk[]> {
    const queryEmbedding = (await this.embeddingProcessingService.createTextEmbedding(query))[0]

    if (!queryEmbedding) {
      throw new Error('Embedding is empty')
    }

    return this.embeddingManagementService.searchByEmbedding(embeddingId, {
      embedding: queryEmbedding,
      retrieval,
    })
  }
  
  /**
  * Queries multiple collections for items similar to the provided query string.
  *
  * @param {string} query - The query string to search for.
  * @param {string[]} embeddingIds - The IDs of the collections to query.
  * @param {RetrievalSearchOptions} [retrieval] - Retrieval options (limit defaults to 1, filter defaults to undefined).
  * @returns {Promise<RetrievedChunk[]>} - A promise that resolves to an array of similar items from all collections.
  */
  async queryCollections(
    query: string,
    embeddingIds: string[],
    retrieval: RetrievalSearchOptions = { filter: undefined, limit: 1 }
  ): Promise<RetrievedChunk[]> {
    const queryEmbedding = (await this.embeddingProcessingService.createTextEmbedding(query))[0]

    if (!queryEmbedding) {
      throw new Error('Embedding is empty')
    }

    const results = await runWithOptionalConcurrencyLimit(
      embeddingIds,
      async (embeddingId): Promise<RetrievedChunk[]> =>
        this.embeddingManagementService.searchByEmbedding(embeddingId, {
          embedding: queryEmbedding,
          retrieval,
        }),
      this.queryCollectionsMaxConcurrency
    )

    return results.flatMap((resultSet) => resultSet)
  }
}
