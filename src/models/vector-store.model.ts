interface VectorPoint {
  id: number | string
  payload: Record<string, unknown>
  vector: number[]
}

interface VectorSearchResult {
  id: number | string
  payload: Record<string, unknown>
  score: number
}

interface VectorStoreInsertResult {
  collectionId: string
  status: string
}

interface VectorStore {
  exists(collectionId: string): Promise<boolean>
  insert(collectionId: string, points: VectorPoint[]): Promise<VectorStoreInsertResult>
  search(collectionId: string, queryVector: number[], limit: number): Promise<VectorSearchResult[]>
}

export type {
  VectorPoint,
  VectorSearchResult,
  VectorStore,
  VectorStoreInsertResult,
}
