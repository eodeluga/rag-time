import { RagPlugin } from '../RagPlugin'
import type { Chunk } from '../models/Chunk'

class DocumentRag extends RagPlugin {
  protected override buildSystemPrompt(): string {
    return (
      'You are a document assistant. Answer questions based solely on the provided sources. '
      + 'Always cite the source number(s) supporting your answer, e.g. [1], [2].'
    )
  }

  protected override presentContext(chunks: Chunk[]): string {
    return chunks.map((chunk, index) => `Source [${index + 1}]: ${chunk.text}`).join('\n\n')
  }
}

export { DocumentRag }
