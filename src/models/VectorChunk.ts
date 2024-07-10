import type { DocumentChunk } from '@@models/DocumentChunk'

export interface VectorChunk extends DocumentChunk {
  textEmbeddings: number[]
  summaryEmbeddings: number[]
}
