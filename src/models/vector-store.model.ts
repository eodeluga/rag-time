export interface VectorPoint {
  id: number | string
  payload: Record<string, unknown>
  vector: number[]
}

export interface VectorSearchResult {
  id: number | string
  payload: Record<string, unknown>
  score: number
}

export interface VectorStoreInsertResult {
  collectionId: string
  status: string
}

export interface VectorStore {
  exists(collectionId: string): Promise<boolean>
  insert(collectionId: string, points: VectorPoint[]): Promise<VectorStoreInsertResult>
  search(collectionId: string, queryVector: number[], limit: number): Promise<VectorSearchResult[]>
}
