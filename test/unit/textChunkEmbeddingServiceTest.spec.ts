import { expect } from 'chai'
import dotenv from 'dotenv'
import OpenAI from 'openai'
import { EmbeddingService } from '@@services/embedding.service'
import { TextChunkEmbeddingService } from '@@services/textChunkEmbedding.service'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const embeddingService = new EmbeddingService(openai)
const textChunkEmbeddingService = new TextChunkEmbeddingService(embeddingService)

describe('TextChunkEmbeddingService test', async function() {
  this.timeout(5000)
  
  
  it('checks the embeddings of text chunks matches the embeddings of the text', async function() {
    const chunks = [
      {
        text: 'Mr . and Mrs . Dursley, of number four, Privet Drive, ',
        summary: 'were proud to say that they were perfectly normal, thank you very much.',
      },
      {
        text: 'They were the last people you’d expect to be involved in anything strange or mysterious, ',
        summary: 'because they just didn’t hold with such nonsense.',
      },
      {
        text: 'Mr. Dursley was the director of a firm called Grunnings, which made drills. He was a big, beef',
        summary: '',
      },
    ]

    const chunkEmbeddings = await textChunkEmbeddingService.embedChunks(chunks)
    const texts = chunkEmbeddings.map((embedding, index) => ({
      index,
      text: embedding.text,
    }))
    
    const textEmbeddings = await embeddingService.embed(texts.map((text) => text.text))
    chunkEmbeddings.forEach((chunkEmbedding, index) => {
      const textEmbedding = textEmbeddings.find((textEmbedding) => textEmbedding.index === index)
      expect(chunkEmbedding).to.have.property('vector').that.deep.equals(textEmbedding?.vector)
    })
  })
})
