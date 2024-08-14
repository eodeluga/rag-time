import dotenv from 'dotenv'
import OpenAI from 'openai'
import { TextChunkerService } from '@@services/TextChunker.service'
import { EmbeddingProcessingService } from '@@services/EmbeddingProcessing.service'
import { TextChunkEmbeddingService } from '@@services/textChunkEmbedding.service'
dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
// Chunk the first page of Harry Potter and the Philosopher's Stone
const text = 'Mr . and Mrs . Dursley, of number four, Privet Drive, '
  + 'were proud to say that they were perfectly normal, thank you very much.'
  + 'They were the last people you’d expect to be involved in anything strange or mysterious, '
  + 'because they just didn’t hold with such nonsense.'
  + 'Mr. Dursley was the director of a firm called Grunnings, which made drills. He was a big, beef'

describe('Test template', async function() {
  this.timeout(5000)
  it('tests the performance of Open AI embedding', async function() {
    const textChunkerService = new TextChunkerService(openai)
    const sentences = await textChunkerService.chunk(text)
    
    const embeddingService = new EmbeddingProcessingService(openai)
    const textChunkEmbeddingService = new TextChunkEmbeddingService(embeddingService) 
    const startTime = performance.now()
    const embedding = await textChunkEmbeddingService.embedChunks(sentences)
    const endTime = performance.now()
    const timeTaken = endTime - startTime
    console.log(`Time taken to produce embedding of size ${embedding.length} Open AI: ${timeTaken} ms`)
  })
})
