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
  let metadataScopedEmbeddingIds: string[]

  beforeAll(async () => {
    const provider = new OpenAIProvider({ apiKey: process.env['OPENAI_API_KEY']! })
    const vectorStore = new QdrantVectorStore()
    const mgmtService = new EmbeddingManagementService(vectorStore)
    const chunkerService = new TextChunkerService(provider)

    embeddingProcessingService = new EmbeddingProcessingService(provider, mgmtService)
    embeddingQueryService = new EmbeddingQueryService(mgmtService, embeddingProcessingService)

    const pdfPath = 'assets/Sample.pdf'
    const sampleSource = 'sample-doc'
    const shellSource = 'shell-doc'

    const sampleEmbeddingResult = await embeddingProcessingService.embedPDF(pdfPath, {
      chunkFn: (text) => chunkerService.chunk(text),
      metadata: { source: sampleSource },
    })
    embeddingId = sampleEmbeddingResult.embeddingId

    const pdfs = [
      { filePath: 'assets/Sample.pdf', source: sampleSource },
      { filePath: 'assets/Secure Secure Shell.pdf', source: shellSource },
    ]
    const embeddingPromises = await Promise.all(
      pdfs.map(async (pdf) => embeddingProcessingService.embedPDF(pdf.filePath, {
        chunkFn: (text) => chunkerService.chunk(text),
        metadata: { source: pdf.source },
      }))
    )

    embeddingIds = embeddingPromises
      .map(({ embeddingId: id }) => id)
      .filter((id): id is string => id !== null)

    const metadataScopedInputs = [
      {
        source: 'scope-alpha',
        text: 'Scoped alpha retrieval content about graphics hardware and retro systems.',
      },
      {
        source: 'scope-beta',
        text: 'Scoped beta retrieval content about secure shell and cryptographic key exchange.',
      },
    ]
    const metadataScopedEmbeddingPromises = await Promise.all(
      metadataScopedInputs.map(async (input) => embeddingProcessingService.embedText(input.text, {
        chunkFn: (text) => chunkerService.chunk(text),
        metadata: { source: input.source },
      }))
    )

    metadataScopedEmbeddingIds = metadataScopedEmbeddingPromises
      .map(({ embeddingId: id }) => id)
      .filter((id): id is string => id !== null)

    if (
      embeddingId === null
      || embeddingIds.length === 0
      || metadataScopedEmbeddingIds.length !== metadataScopedInputs.length
    ) {
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

  it('should narrow retrieved output when a metadata filter is provided', async () => {
    const query = 'Show me content about system security and key exchange'
    const unfilteredResults = await embeddingQueryService.queryCollections(query, metadataScopedEmbeddingIds, {
      filter: undefined,
      limit: 1,
    })
    const unfilteredSources = new Set(
      unfilteredResults.map((result) => String(result.metadata['source'] ?? ''))
    )

    expect(unfilteredSources.has('scope-alpha')).toBeTrue()
    expect(unfilteredSources.has('scope-beta')).toBeTrue()

    const filteredResults = await embeddingQueryService.queryCollections(query, metadataScopedEmbeddingIds, {
      filter: {
        field: 'source',
        operator: 'eq',
        value: 'scope-beta',
      },
      limit: 2,
    })

    expect(filteredResults.length).toBeGreaterThan(0)
    expect(filteredResults.every((result) => result.metadata['source'] === 'scope-beta')).toBeTrue()
  })
})
