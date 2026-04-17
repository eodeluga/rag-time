import pdfparse from 'pdf-parse-debugging-disabled'
import { EmbeddingProcessingService } from '@/services/EmbeddingProcessing.service'
import { EmbeddingManagementService } from '@/services/EmbeddingManagement.service'
import { EmbeddingQueryService } from '@/services/EmbeddingQuery.service'
import { TextChunkerService } from '@/services/TextChunker.service'
import { QdrantVectorStore } from '@/stores/QdrantVectorStore'
import type { RagConfig } from '@/models/RagConfig'
import type { RagResponse } from '@/models/RagResponse'
import type { Chunk } from '@/models/Chunk'
import type { Message } from '@/models/Message'
import type { Metadata } from '@/models/Metadata'
import type { EmbeddingResult } from '@/models/EmbeddingResult'
import type { TextChunk } from '@/models/TextChunk'
import type { ChatProvider } from '@/providers/ChatProvider'

abstract class RagPlugin {
  private candidateLimit: number
  private chatProvider: ChatProvider
  private embeddingProcessingService: EmbeddingProcessingService
  private embeddingQueryService: EmbeddingQueryService
  private retrievalLimit: number
  private textChunkerService: TextChunkerService
  private tokenBudget: number

  protected embeddingId: string | null = null

  constructor(config: RagConfig) {
    this.candidateLimit = config.retrieval?.candidateLimit ?? 20
    this.chatProvider = config.chatProvider
    this.retrievalLimit = config.retrieval?.limit ?? 5
    this.tokenBudget = config.tokenBudget ?? 8000

    const vectorStore = config.vectorStore ?? new QdrantVectorStore({ url: config.qdrant?.url })
    const embeddingManagementService = new EmbeddingManagementService(vectorStore)

    this.textChunkerService = new TextChunkerService(config.chatProvider)
    this.embeddingProcessingService = new EmbeddingProcessingService(
      config.embeddingProvider,
      embeddingManagementService
    )
    this.embeddingQueryService = new EmbeddingQueryService(
      embeddingManagementService,
      this.embeddingProcessingService
    )
  }

  private assemblePrompt(
    systemPrompt: string,
    context: string,
    history: Message[],
    question: string
  ): Message[] {
    return [
      { content: `${systemPrompt}\n\nContext:\n${context}`, role: 'system' },
      ...history,
      { content: question, role: 'user' },
    ]
  }

  private async compactHistory(history: Message[], tokenBudget: number): Promise<Message[]> {
    const historyText = history.map((message) => `${message.role}: ${message.content}`).join('\n')

    if (this.countTokens(historyText) <= tokenBudget || history.length <= 2) {
      return history
    }

    const midpoint = Math.floor(history.length / 2)
    const toSummarise = history.slice(0, midpoint)
    const toKeep = history.slice(midpoint)

    const summary = await this.chatProvider.complete([{
      content: `Summarise the following conversation concisely:\n\n${
        toSummarise.map((message) => `${message.role}: ${message.content}`).join('\n')
      }`,
      role: 'user',
    }])

    return [{ content: `[Summary]: ${summary}`, role: 'assistant' }, ...toKeep]
  }

  private countTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private deduplicateChunks(chunks: Chunk[]): Chunk[] {
    const seen = new Set<string>()

    return chunks.filter((chunk) => {
      if (seen.has(chunk.text)) { return false }
      seen.add(chunk.text)
      return true
    })
  }

  async ingest(input: Buffer | string, metadata?: Metadata): Promise<EmbeddingResult> {
    let text: string

    if (Buffer.isBuffer(input)) {
      const { text: parsedText } = await pdfparse(input)
      text = parsedText
    } else {
      text = input
    }

    const chunkFn = async (rawText: string): Promise<TextChunk[]> => {
      const chunks = await this.chunk(rawText)
      return chunks.map((chunk) => ({ summary: chunk.summary, text: chunk.text }))
    }

    const result = await this.embeddingProcessingService.embedText(text, { chunkFn, metadata })
    this.embeddingId = result.embeddingId
    return result
  }

  async query(question: string, history: Message[] = []): Promise<RagResponse> {
    if (!this.embeddingId) {
      throw new Error('No content has been ingested. Call ingest() before query().')
    }

    const variants = await this.expandQuery(question)
    const rawResults = await Promise.all(
      variants.map((variant) =>
        this.embeddingQueryService.query(variant, this.embeddingId!, this.candidateLimit)
      )
    )

    const allChunks: Chunk[] = rawResults.flat().map((text) => ({ metadata: {}, text }))
    const topChunks = this.deduplicateChunks(allChunks).slice(0, this.retrievalLimit)

    const context = this.presentContext(topChunks)
    const systemPrompt = this.buildSystemPrompt()

    const baseTokens = this.countTokens(systemPrompt + context + question)
    const historyBudget = this.tokenBudget - baseTokens
    const compacted = await this.compactHistory(history, historyBudget)

    const messages = this.assemblePrompt(systemPrompt, context, compacted, question)
    const answer = await this.chatProvider.complete(messages)

    return {
      answer,
      history: [
        ...compacted,
        { content: question, role: 'user' },
        { content: answer, role: 'assistant' },
      ],
      sources: topChunks,
    }
  }

  protected async chunk(text: string): Promise<Chunk[]> {
    const textChunks = await this.textChunkerService.chunk(text)
    return textChunks.map((tc) => ({ metadata: {}, summary: tc.summary, text: tc.text }))
  }

  protected buildSystemPrompt(): string {
    return "You are a helpful assistant. Answer the user's question based on the provided context."
  }

  protected expandQuery(query: string): Promise<string[]> {
    return Promise.resolve([query])
  }

  protected presentContext(chunks: Chunk[]): string {
    return chunks.map((chunk, index) => `[${index + 1}] ${chunk.text}`).join('\n\n')
  }
}

export { RagPlugin }
