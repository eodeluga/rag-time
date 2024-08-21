import dotenv from 'dotenv'
import OpenAI from 'openai'
import { expect } from 'chai'
import { EmbeddingProcessingService } from '@@services/EmbeddingProcessing.service'
import { EmbeddingQueryService } from '@@services/EmbeddingQuery.service'

describe('Tests the embedding of text chunks from PDF and the querying and response of the embedded text', async function() {
  this.timeout(5000)
  dotenv.config()
  
  let embeddingQueryService: EmbeddingQueryService
  let embeddingId: string | null
  
  this.beforeAll(async () => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const pdfPath = 'test/assets/Sample.pdf'
    const embeddingProcessingService = new EmbeddingProcessingService(openai)
    embeddingQueryService = new EmbeddingQueryService(embeddingProcessingService);
    ({ embeddingId } = await embeddingProcessingService.embedPDF(pdfPath))
    
    if (embeddingId === null) {
      throw new Error('Failed to embed PDF')
    }
  })
  
  it('should provide text that contains answer to query 1', async () => {
    const query = 'What year did I get the Amiga 500?'
    const results = await embeddingQueryService.query(query, embeddingId!)
    expect(results.some((result) => result.includes('1991'))).to.be.true
    console.log(results)
  })
  
  it('should provide text that contains answer to query 2', async () => {
    const query = 'Who made horse racing game?'
    const results = await embeddingQueryService.query(query, embeddingId!)
    expect(results.some((result) => result.includes('brother'))).to.be.true
    console.log(results)
  })
})
