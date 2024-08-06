import { expect } from 'chai'
import dotenv from 'dotenv'
import OpenAI from 'openai'
import { EmbeddingService } from '@@services/embedding.service'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})


describe('EmbeddingService test', async function() {
  this.timeout(5000)
  it('embeds text as vector embeddings', async function() {
    const text = [
      'Mr . and Mrs . Dursley, of number four, Privet Drive, ',
      'were proud to say that they were perfectly normal, thank you very much.',
      'They were the last people you’d expect to be involved in anything strange or mysterious, ',
      'because they just didn’t hold with such nonsense.',
      'Mr. Dursley was the director of a firm called Grunnings, which made drills. He was a big, beef',
    ]
    
    const embeddingService = new EmbeddingService(openai)
    const embeddings = await embeddingService.embed(text)
    embeddings.forEach((embedding) => {
      expect(embedding).to.have.property('index').that.is.a('number')
      expect(embedding).to.have.property('vector').that.is.an('array')
    })
  })
})
