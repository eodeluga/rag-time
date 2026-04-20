import type { RetrievalSearchOptions } from '@/models/vector-filter.model'

/**
 * A single point to store in a vector collection.
 */
interface VectorPoint {
  /** Unique identifier for this point within the collection. */
  id: number | string
  /** Arbitrary metadata stored alongside the vector, queryable via filters. */
  payload: Record<string, unknown>
  /** Dense embedding vector. All points in a collection must share the same dimensionality. */
  vector: number[]
}

/**
 * A scored result returned from a vector similarity search.
 */
interface VectorSearchResult {
  /** Identifier of the matching point. */
  id: number | string
  /** Metadata payload of the matching point. */
  payload: Record<string, unknown>
  /** Cosine similarity score in the range [0, 1]; higher indicates greater relevance. */
  score: number
}

/**
 * Outcome of a {@link VectorStore.insert} operation.
 */
interface VectorStoreInsertResult {
  /** Identifier of the collection the points were inserted into. */
  collectionId: string
  /** Persistence status reported by the underlying store (e.g. `'acknowledged'` or `'completed'`). */
  status: string
}

/**
 * Storage abstraction for vector databases.
 *
 * Implement this interface to plug in an alternative vector store backend.
 *
 * @example
 * class MyVectorStore implements VectorStore {
 *   async exists(collectionId: string): Promise<boolean> { ... }
 *   async insert(collectionId: string, points: VectorPoint[]): Promise<VectorStoreInsertResult> { ... }
 *   async search(
 *     collectionId: string, queryVector: number[], options: RetrievalSearchOptions
 *   ): Promise<VectorSearchResult[]> { ... }
 * }
 */
interface VectorStore {
  /**
   * Checks whether a named collection exists in the store.
   *
   * @param {string} collectionId - Unique identifier of the collection to check.
   * @returns {Promise<boolean>} `true` if the collection exists, `false` otherwise.
   */
  exists(collectionId: string): Promise<boolean>

  /**
   * Creates a collection (if it does not exist) and upserts the provided points.
   *
   * @param {string} collectionId - Identifier of the target collection.
   * @param {VectorPoint[]} points - Non-empty array of vector points. All vectors must share the same dimensionality.
   * @returns {Promise<VectorStoreInsertResult>} The collection identifier and persistence status.
   * @throws {VectorStoreError} If `points` is empty or the insert operation fails.
   */
  insert(collectionId: string, points: VectorPoint[]): Promise<VectorStoreInsertResult>

  /**
   * Finds the nearest neighbours of a query vector within a collection.
   *
   * @param {string} collectionId - Identifier of the collection to search.
   * @param {number[]} queryVector - Dense embedding vector to find neighbours for.
   * @param {RetrievalSearchOptions} options - Maximum result count and optional metadata filter.
   * @returns {Promise<VectorSearchResult[]>} Scored results sorted by descending similarity.
   * @throws {VectorStoreError} If the search operation fails.
   */
  search(
    collectionId: string,
    queryVector: number[],
    options: RetrievalSearchOptions
  ): Promise<VectorSearchResult[]>
}

export type {
  VectorPoint,
  VectorSearchResult,
  VectorStore,
  VectorStoreInsertResult,
}
