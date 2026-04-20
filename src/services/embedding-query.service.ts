import { EmbeddingManagementService } from '@/services/embedding-management.service'
import { EmbeddingProcessingService } from '@/services/embedding-processing.service'
import { runWithOptionalConcurrencyLimit } from '@/utils/concurrency.util'
import type { RetrievalSearchOptions } from '@/models/vector-filter.model'
import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

type EmbeddingQueryServiceConfig = {
  queryCollectionsMaxConcurrency?: number
}

/**
 * Queries embedding collections by semantic similarity.
 *
 * Converts a query string into an embedding vector and searches one or more
 * collections for the nearest neighbours. Use {@link query} for a single collection
 * and {@link queryCollections} to fan out across multiple collections simultaneously.
 */
export class EmbeddingQueryService {
  private embeddingManagementService: EmbeddingManagementService
  private embeddingProcessingService: EmbeddingProcessingService
  private queryCollectionsMaxConcurrency: number | undefined

  /**
   * @param {EmbeddingManagementService} embeddingManagementService - Service for managing and searching embeddings.
   * @param {EmbeddingProcessingService} embeddingProcessingService - Service for generating query embeddings.
   * @param {object} [config] - Optional configuration.
   * @param {number} [config.queryCollectionsMaxConcurrency] - Maximum number of collections queried concurrently
   *   by {@link queryCollections}. Omit for unlimited concurrency.
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
   * Searches a single embedding collection for chunks semantically similar to `query`.
   *
   * @param {string} query - Natural-language query string.
   * @param {string} embeddingId - Identifier of the collection to search.
   * @param {RetrievalSearchOptions} [retrieval] - Result limit and optional metadata filter.
   *   Defaults to `{ limit: 1, filter: undefined }`.
   * @returns {Promise<RetrievedChunk[]>} Matching chunks sorted by descending similarity score.
   * @throws {Error} If the query cannot be embedded.
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
   * Searches multiple embedding collections in parallel and returns a flat result set.
   *
   * The query is embedded once and then dispatched to all specified collections concurrently.
   * Results from all collections are merged into a single array without deduplication or sorting.
   *
   * @param {string} query - Natural-language query string.
   * @param {string[]} embeddingIds - Identifiers of the collections to search.
   * @param {RetrievalSearchOptions} [retrieval] - Result limit and optional metadata filter applied
   *   to each collection independently. Defaults to `{ limit: 1, filter: undefined }`.
   * @returns {Promise<RetrievedChunk[]>} Flat array of matching chunks from all queried collections.
   * @throws {Error} If the query cannot be embedded.
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
