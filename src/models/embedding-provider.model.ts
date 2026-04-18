interface EmbeddingVector {
  index: number
  vector: number[]
}

interface EmbeddingProvider {
  embed(inputs: string[]): Promise<EmbeddingVector[]>
}

export type {
  EmbeddingProvider,
  EmbeddingVector,
}
