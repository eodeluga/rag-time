import { BaseRag } from '@/plugins/base.plugin'

/**
 * General-purpose conversational RAG variant optimised for multi-turn dialogue.
 *
 * Answers questions freely based on ingested content. The system prompt is kept
 * neutral to allow natural conversation without imposing a rigid citation format.
 * Use {@link DocumentRag} instead when strict source citation is required.
 *
 * @example
 * const rag = new ConversationalRag({ chatProvider, embeddingProvider })
 * await rag.ingest('Your content here...')
 *
 * const { answer, history } = await rag.query('Tell me about X.')
 * const next = await rag.query('And what about Y?', history) // multi-turn
 */
export class ConversationalRag extends BaseRag {}
