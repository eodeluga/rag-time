interface QdrantCollectionConfig {
  defaultSegmentNumber?: number
  replicationFactor?: number
}

interface QdrantVectorStoreConfig {
  collection?: QdrantCollectionConfig
  url?: string
}

export type {
  QdrantCollectionConfig,
  QdrantVectorStoreConfig,
}
