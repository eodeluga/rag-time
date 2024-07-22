import { TextEmbeddingService } from '@@services/textEmbedding.service'
import { LlmTextSplitters } from '@@utils/llmTextSplitters.util'
import { describe, it } from 'bun:test'
// import { describe, it } from 'mocha'

import OpenAI from 'openai'
import dotenv from 'dotenv'
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
  it('tests the performance of gpt-3-encoder library', async function() {
    const llmTextSplitters = new LlmTextSplitters(openai)
    const sentences = await llmTextSplitters.textChunker(text)
    const textEmbeddingService = new TextEmbeddingService(openai) 
    const startTime = performance.now()
    const embedding = await textEmbeddingService.gpt3EmbedSentences(sentences)
    const endTime = performance.now()
    const timeTaken = endTime - startTime
    console.log(`Time taken to produce embedding of size ${embedding.length} gpt-3-encoder: ${timeTaken} ms`)
  })
  
  it('tests the performance of Open AI embedding', async function() {
    const llmTextSplitters = new LlmTextSplitters(openai)
    const sentences = await llmTextSplitters.textChunker(text)
    const textEmbeddingService = new TextEmbeddingService(openai) 
    const startTime = performance.now()
    const embedding = await textEmbeddingService.embedSentences(sentences)
    const endTime = performance.now()
    const timeTaken = endTime - startTime
    console.log(`Time taken to produce embedding of size ${embedding.length} Open AI: ${timeTaken} ms`)
  })
  
  it('tests the performance of transformers library', async function() {
    const llmTextSplitters = new LlmTextSplitters(openai)
    const sentences = await llmTextSplitters.textChunker(text)
    const textEmbeddingService = new TextEmbeddingService(openai) 
    const startTime = performance.now()
    await textEmbeddingService.transformersEmbedSentences(sentences)
    const endTime = performance.now()
    const timeTaken = endTime - startTime
    console.log(`Time taken to produce embedding of size ${sentences.length} transformers: ${timeTaken} ms`)
  })
  
})
