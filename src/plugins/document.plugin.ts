import { BaseRag } from '@/plugins/base.plugin'
import type { RetrievedChunk } from '@/models/retrieved-chunk.model'

/**
 * Document-oriented RAG variant that enforces source citation.
 *
 * Instructs the model to answer solely from the provided context and to cite
 * source numbers (e.g. `[1]`, `[2]`) for every factual claim. Suitable for
 * question-answering over structured documents such as reports, contracts, or manuals.
 *
 * Use {@link ConversationalRag} instead when a more natural, open-ended dialogue style
 * is preferred.
 *
 * @example
 * const rag = new DocumentRag({ chatProvider, embeddingProvider })
 * await rag.ingest(pdfBuffer, { source: 'annual-report-2024.pdf' })
 *
 * const { answer, sources } = await rag.query('What was the revenue in Q3?')
 * // answer will cite [1], [2], etc. — cross-reference with sources[]
 */
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
