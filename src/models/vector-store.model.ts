import type { RetrievalSearchOptions } from '@/models/vector-filter.model'

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
