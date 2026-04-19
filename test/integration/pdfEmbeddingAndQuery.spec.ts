import dotenv from 'dotenv'
import { EmbeddingProcessingService } from '@/services/embedding-processing.service'
import { EmbeddingQueryService } from '@/services/embedding-query.service'
import { EmbeddingManagementService } from '@/services/embedding-management.service'
import { TextChunkerService } from '@/services/text-chunker.service'
import { OpenAIProvider } from '@/providers/open-ai.provider'
import { QdrantVectorStore } from '@/stores/qdrant-vector.store'
import { it, describe, expect, beforeAll, setDefaultTimeout } from 'bun:test'

describe('Tests the embedding of text chunks from PDF and the querying and response of the embedded text', async function() {
  setDefaultTimeout(60000)
  dotenv.config()

  let embeddingProcessingService: EmbeddingProcessingService
  let embeddingQueryService: EmbeddingQueryService
  let embeddingId: string | null
  let embeddingIds: string[]

  beforeAll(async () => {
    const provider = new OpenAIProvider({ apiKey: process.env['OPENAI_API_KEY']! })
    const vectorStore = new QdrantVectorStore()
    const mgmtService = new EmbeddingManagementService(vectorStore)
    const chunkerService = new TextChunkerService(provider)

    embeddingProcessingService = new EmbeddingProcessingService(provider, mgmtService)
    embeddingQueryService = new EmbeddingQueryService(mgmtService, embeddingProcessingService)

    const pdfPath = 'assets/Sample.pdf';

    ({ embeddingId } = await embeddingProcessingService.embedPDF(pdfPath, {
      chunkFn: (text) => chunkerService.chunk(text),
    }))

    const pdfs = ['assets/Sample.pdf', 'assets/Secure Secure Shell.pdf']
    const embeddingPromises = await Promise.all(
      pdfs.map(async (pdf) => embeddingProcessingService.embedPDF(pdf, {
        chunkFn: (text) => chunkerService.chunk(text),
      }))
    )

    embeddingIds = embeddingPromises
      .map(({ embeddingId: id }) => id)
      .filter((id): id is string => id !== null)

    if (embeddingId === null || embeddingIds.length === 0) {
      throw new Error('Failed to embed PDF')
    }
  })

  it('should provide text based on query: \'What year did I get the Amiga 500?\'', async () => {
    const query = 'What year did I get the Amiga 500?'
    const results = await embeddingQueryService.query(query, embeddingId!)
    expect(results.some((result) => result.text.includes('1991'))).toBeTrue()
    console.log(results)
  })

  it('should provide text based on query: \'Who made horse racing game?\'', async () => {
    const query = 'Who made horse racing game?'
    const results = await embeddingQueryService.query(query, embeddingId!)
    expect(results.some((result) => result.text.includes('brother'))).toBeTrue()
    console.log(results)
  })

  it('should provide text from multiple documents', async () => {
    const query = 'What is the name of the GPUs I used and what are ways to do key exchange?'
    const results = await embeddingQueryService.queryCollections(query, embeddingIds, { filter: undefined, limit: 1 })
    const resultText = results.map((result) => result.text).join()
    expect(resultText).toSatisfy((text) => text.includes('voodoo') && text.includes('ssh'))
  })
})
