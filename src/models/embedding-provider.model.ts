export interface EmbeddingVector {
  index: number
  vector: number[]
}

export interface EmbeddingProvider {
  embed(inputs: string[]): Promise<EmbeddingVector[]>
}
