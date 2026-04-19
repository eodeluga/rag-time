import type { Reranker } from '@/models/reranker.model'
import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

export class NoOpRerankerService implements Reranker {
  rerank(_query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
    return Promise.resolve(chunks)
  }
}
