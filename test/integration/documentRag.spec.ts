import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test'
import { DocumentRag } from '@/plugins/DocumentRag'
import { OpenAIProvider } from '@/providers/OpenAIProvider'
import { QdrantVectorStore } from '@/stores/QdrantVectorStore'
import type { RagResponse } from '@/models/RagResponse'

describe('DocumentRag — PDF ingest and source-cited query', async function() {
  setDefaultTimeout(120000)
  dotenv.config()

  let rag: DocumentRag
  let response: RagResponse

  beforeAll(async () => {
    const provider = new OpenAIProvider({ apiKey: process.env['OPENAI_API_KEY']! })

    rag = new DocumentRag({
      chatProvider: provider,
      embeddingProvider: provider,
      vectorStore: new QdrantVectorStore(),
    })

    const pdfBuffer = readFileSync('test/assets/Sample.pdf')
    const result = await rag.ingest(pdfBuffer)

    if (!result.embeddingId) {
      throw new Error('PDF ingest failed')
    }

    response = await rag.query('What year did I get the Amiga 500?')
  })

  it('should return an answer referencing 1991', () => {
    expect(response.answer).toInclude('1991')
  })

  it('should include source chunks with metadata', () => {
    expect(response.sources.length).toBeGreaterThan(0)
    expect(response.sources[0]).toHaveProperty('text')
    expect(response.sources[0]).toHaveProperty('metadata')
  })

  it('should include source citation markers in the answer', () => {
    expect(response.answer).toMatch(/\[\d+\]/)
  })
})
