import dotenv from 'dotenv'
import OpenAI from 'openai'
import { EmbeddingProcessingService } from '@@services/EmbeddingProcessing.service'
import { EmbeddingQueryService } from '@@services/EmbeddingQuery.service'
import { EmbeddingManagementService } from '@@services/EmbeddingManagement.service'
import { it, describe, expect, beforeAll, setDefaultTimeout } from 'bun:test'

describe('Tests the embedding of text chunks from PDF and the querying and response of the embedded text', async function() {
  setDefaultTimeout(60000)
  dotenv.config()
  
  
  let embeddingQueryService: EmbeddingQueryService
  let embeddingId: string | null
  let embeddingIds: string[]
  
  beforeAll(async () => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const pdfPath = 'test/assets/Sample.pdf'
    const embeddingProcessingService = new EmbeddingProcessingService(openai)
    
    embeddingQueryService = new EmbeddingQueryService(
      new EmbeddingManagementService(),
      embeddingProcessingService
    );
    
    ({ embeddingId } = await embeddingProcessingService.embedPDF(pdfPath))
    
    
    const pdfs = ['test/assets/Sample.pdf', 'test/assets/Secure Secure Shell.pdf']
    const embeddingPromises = await Promise.all(
      pdfs.map(async (pdf) => embeddingProcessingService.embedPDF(pdf))
    )
    
    embeddingIds = embeddingPromises
      .map(({ embeddingId }) => embeddingId)
      .filter((id): id is string => id !== null)
    
    if (embeddingId === null || embeddingIds.length === 0) {
      throw new Error('Failed to embed PDF')
    }
  })
  
  it('should provide text based on query: \'What year did I get the Amiga 500?\'', async () => {
    const query = 'What year did I get the Amiga 500?'
    const results = await embeddingQueryService.query(query, embeddingId!)
    expect(results.some((result) => result.includes('1991'))).toBeTrue()
    console.log(results)
  })
  
  it('should provide text based on query: \'Who made horse racing game?\'', async () => {
    const query = 'Who made horse racing game?'
    const results = await embeddingQueryService.query(query, embeddingId!)
    expect(results.some((result) => result.includes('brother'))).toBeTrue()
    console.log(results)
  })
  
  it('should provide text from multiple documents', async () => {
    const query = 'What is the name of the GPUs I used and what are ways to do key exchange?'
    const results = await embeddingQueryService.queryCollections(query, embeddingIds, 1)
    expect(results.join()).toSatisfy((str: string) => str.includes('voodoo') && str.includes('ssh'))
  })
})
