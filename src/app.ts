import dotenv from 'dotenv'
import { LlmTextSplitters } from '@@utils/llmTextSplitters.util'
import OpenAI from 'openai'
import { TextEmbeddingService } from '@@services/textEmbedding.service'
import { TextIndexingService } from '@@services/textIndexing.service'

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
  const llmTextSplitters = new LlmTextSplitters(openai)
  const sentences = await llmTextSplitters.textChunker(text)
  
  const textEmbeddingService = new TextEmbeddingService(openai)
  const embedding = await textEmbeddingService.embedSentences(sentences)
  
  const documentIndexingService = new TextIndexingService()
  await documentIndexingService.insertIndex(embedding)
  
  const results = await documentIndexingService.searchIndex(
    'What were the Dursleys like?',
    1,
    openai
  )
  console.log(results)
  
})()

