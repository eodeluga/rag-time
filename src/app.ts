import dotenv from 'dotenv'
import { TextChunkerService } from '@@services/textChunker.service'
import OpenAI from 'openai'
import { TextChunkEmbeddingService } from '@@services/textChunkEmbedding.service'
import { TextChunkIndexingService } from '@@services/textChunkIndexing.service'

dotenv.config();

(async () => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  
  // Chunk the first page of Harry Potter and the Philosopher's Stone
  const text = 'Mr . and Mrs . Dursley, of number four, Privet Drive, '
    + 'were proud to say that they were perfectly normal, thank you very much.'
    + 'They were the last people you’d expect to be involved in anything strange or mysterious, '
    + 'because they just didn’t hold with such nonsense.'
    + 'Mr. Dursley was the director of a firm called Grunnings, which made drills. He was a big, beef'
  
  const textChunkerService = new TextChunkerService(openai)
  const chunks = await textChunkerService.chunk(text)
  
  const textEmbeddingService = new TextChunkEmbeddingService(openai)
  const embedding = await textEmbeddingService.embedChunks(chunks)

  const textChunkIndexingService = new TextChunkIndexingService()
  await textChunkIndexingService.insert(embedding)
  
  const results = await textChunkIndexingService.query({
    query: 'Mr. Dursley\'s job',
    limit: 1,
    openai,
  }
  )
  console.log(results)

  
})()

