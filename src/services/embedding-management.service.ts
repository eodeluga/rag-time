import { EmbeddingMetadataValidator } from '@/validators/metadata.validator'
import { VectorSearchResultValidator } from '@/validators/vector-search-result.validator'
import type { VectorStore } from '@/models/vector-store.model'
import type { RetrievalSearchOptions } from '@/models/vector-filter.model'
import type { Metadata } from '@/models/metadata.model'
import type { TextEmbedding } from '@/models/text-embedding.model'
import type { EmbeddingInsertResult } from '@/models/embedding-insert-result.model'
import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

/**
 * Manages embedding collections in a vector store — checking existence,
 * inserting vectors, and searching by embedding similarity.
 *
 * Acts as the bridge between raw {@link TextEmbedding} data and the underlying
 * {@link VectorStore}, handling payload construction and result mapping.
 */
export class EmbeddingManagementService {
  private vectorStore: VectorStore

  /**
   * @param {VectorStore} vectorStore - The vector store implementation used to persist and query embeddings.
   */
  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore
  }

  /**
   * Checks whether an embedding collection already exists in the vector store.
   *
   * @param {string} embeddingId - Collection identifier, typically a content hash.
   * @returns {Promise<boolean>} `true` if the collection exists, `false` otherwise.
   */
  async embeddingExists(embeddingId: string): Promise<boolean> {
    return this.vectorStore.exists(embeddingId)
  }

  /**
   * Stores an array of text embeddings in the vector store under the given identifier.
   *
   * Each embedding is stored as a vector point with its original text and any
   * provided metadata merged into the payload.
   *
   * @param {string} embeddingId - Unique identifier (collection name) for this set of embeddings.
   * @param {TextEmbedding[]} textEmbeddingArr - Embeddings to store.
   * @param {Metadata} [metadata] - Optional flat metadata merged into every point's payload.
   * @returns {Promise<EmbeddingInsertResult>} The collection identifier and storage status.
   */
  async insertEmbedding(
    embeddingId: string,
    textEmbeddingArr: TextEmbedding[],
    metadata?: Metadata
  ): Promise<EmbeddingInsertResult> {
    const validatedMetadata = metadata
      ? EmbeddingMetadataValidator.parse(metadata)
      : undefined
    const points = textEmbeddingArr.map((embedding) => ({
      id: embedding.index,
      payload: { index: embedding.index, text: embedding.text, ...(validatedMetadata ?? {}) },
      vector: embedding.vector,
    }))

    const result = await this.vectorStore.insert(embeddingId, points)

    return {
      embeddingId: result.collectionId,
      status: result.status as 'acknowledged' | 'completed',
    }
  }

  /**
   * Searches a collection for the nearest neighbours of a given embedding.
   *
   * @param {string} collectionId - Identifier of the collection to search.
   * @param {object} opts - Search parameters.
   * @param {TextEmbedding} opts.embedding - Query embedding whose vector is used for similarity search.
   * @param {RetrievalSearchOptions} opts.retrieval - Result limit and optional metadata filter.
   * @returns {Promise<RetrievedChunk[]>} Matching chunks with text, metadata, relevance score, and store id.
   */
  async searchByEmbedding(
    collectionId: string,
    opts: { embedding: TextEmbedding; retrieval: RetrievalSearchOptions }
  ): Promise<RetrievedChunk[]> {
    const rawResults = await this.vectorStore.search(
      collectionId,
      opts.embedding.vector,
      opts.retrieval
    )
    const validatedResults = rawResults.map((result) => VectorSearchResultValidator.parse(result))

    return validatedResults.map((result) => {
      const { text, ...metadata } = result.payload

      return {
        id: result.id,
        metadata,
        score: result.score,
        text,
      }
    })
  }
}
