import dotenv from 'dotenv'
import { beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test'
import { ConversationalRag } from '@/plugins/ConversationalRag'
import { OpenAIProvider } from '@/providers/OpenAIProvider'
import { QdrantVectorStore } from '@/stores/QdrantVectorStore'
import type { RagResponse } from '@/models/RagResponse'

describe('ConversationalRag — end-to-end ingest and query', async function() {
  setDefaultTimeout(120000)
  dotenv.config()

  let rag: ConversationalRag
  let response: RagResponse

  const text = [
    'The Battle of Hastings took place in 1066.',
    'William the Conqueror defeated King Harold at the Battle of Hastings.',
    'The Norman conquest of England changed the English language profoundly.',
  ].join('\n')

  beforeAll(async () => {
    const provider = new OpenAIProvider({ apiKey: process.env['OPENAI_API_KEY']! })

    rag = new ConversationalRag({
      chatProvider: provider,
      embeddingProvider: provider,
      vectorStore: new QdrantVectorStore(),
    })

    const result = await rag.ingest(text)

    if (!result.embeddingId) {
      throw new Error('Ingest failed')
    }

    response = await rag.query('Who defeated King Harold?')
  })

  it('should return an answer string', () => {
    expect(typeof response.answer).toBe('string')
    expect(response.answer.length).toBeGreaterThan(0)
  })

  it('should include source chunks', () => {
    expect(response.sources.length).toBeGreaterThan(0)
  })

  it('should return history with user and assistant turns', () => {
    expect(response.history.some((message) => message.role === 'user')).toBeTrue()
    expect(response.history.some((message) => message.role === 'assistant')).toBeTrue()
  })

  it('should carry history across a follow-up query', async () => {
    const followUp = await rag.query('What year did that battle happen?', response.history)
    expect(followUp.answer).toInclude('1066')
  })
})
