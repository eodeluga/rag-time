export interface Chunk<TMetadata = Record<string, unknown>> {
  metadata: TMetadata
  summary?: string
  text: string
}
