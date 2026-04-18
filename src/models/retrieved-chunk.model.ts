import type { Chunk } from '@/models/chunk.model'

export interface RetrievedChunk extends Chunk<Record<string, unknown>> {
  id: number | string
  score: number
}
