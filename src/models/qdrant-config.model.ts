/**
 * Tuning parameters for Qdrant collections created by {@link QdrantVectorStore}.
 */
interface QdrantCollectionConfig {
  /**
   * Number of segments to split the collection into for parallel query processing.
   * @defaultValue 2
   */
  defaultSegmentNumber?: number
  /**
   * Number of collection replicas maintained across the Qdrant cluster.
   * @defaultValue 2
   */
  replicationFactor?: number
}

/**
 * Connection and collection settings for {@link QdrantVectorStore}.
 */
interface QdrantVectorStoreConfig {
  /** Collection creation and storage tuning options. */
  collection?: QdrantCollectionConfig
  /**
   * HTTP URL of the Qdrant instance.
   * @defaultValue `process.env.QDRANT_URL ?? 'http://localhost:6333'`
   */
  url?: string
}

export type {
  QdrantCollectionConfig,
  QdrantVectorStoreConfig,
}
