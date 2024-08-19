import { expect } from 'chai'
import dotenv from 'dotenv'
import OpenAI from 'openai'
import { EmbeddingProcessingService } from '@@services/EmbeddingProcessing.service'
import { TextChunkerService } from '@@services/TextChunker.service'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const embeddingService = new EmbeddingProcessingService(openai)
const textChunkerService = new TextChunkerService(openai)

describe('TextChunkEmbeddingService test', async function() {
  this.timeout(5000)
  
  
  it('checks the embeddings of text chunks matches the embeddings of the text', async function() {
    const chunks = [
      'Mr. and Mrs. Dursley, of number four, Privet Drive, ',
      'were proud to say that they were perfectly normal, thank you very much.',
      'They were the last people you’d expect to be involved in anything strange or mysterious, ',
      'because they just didn’t hold with such nonsense.',
      'Mr. Dursley was the director of a firm called Grunnings, which made drills. He was a big, beef',
    ]

    const embeddingProcessingService = new EmbeddingProcessingService(openai)
    const textEmbedding = embeddingProcessingService.createTextEmbedding(chunks)
    
    const chunkEmbeddings = await textChunkerService.chunk(chunks)
    const texts = chunkEmbeddings.map((embedding, index) => ({
      index,
      text: embedding.text,
    }))
    
    const textEmbeddings = await embeddingService.embedTexts(texts.map((text) => text.text))
    chunkEmbeddings.forEach((chunkEmbedding, index) => {
      const textEmbedding = textEmbeddings.find((textEmbedding) => textEmbedding.index === index)
      expect(chunkEmbedding).to.have.property('vector').that.deep.equals(textEmbedding?.vector)
    })
  })
})
