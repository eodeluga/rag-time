import { BaseRag } from '@/plugins/base.plugin'
import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

export class DocumentRag extends BaseRag {
  protected override buildSystemPrompt(): string {
    return (
      'You are a document assistant. Answer questions based solely on the provided sources. '
      + 'Always cite the source number(s) supporting your answer, e.g. [1], [2].'
    )
  }

  protected override presentContext(chunks: RetrievedChunk[]): string {
    return chunks.map((chunk, index) => `Source [${index + 1}]: ${chunk.text}`).join('\n\n')
  }
}
