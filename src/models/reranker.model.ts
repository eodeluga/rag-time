import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

export interface Reranker {
  rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]>
}
