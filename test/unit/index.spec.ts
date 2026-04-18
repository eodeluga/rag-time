import { describe, expect, it } from 'bun:test'

describe('Root entrypoint', () => {
  it('exports core API symbols without exporting provider classes', async () => {
    const indexModule = await import('../../src/index')

    expect(indexModule.BaseRag).toBeDefined()
    expect(indexModule.ConversationalRag).toBeDefined()
    expect(indexModule.DocumentRag).toBeDefined()
    expect(indexModule.QdrantVectorStore).toBeDefined()

    expect('AnthropicProvider' in indexModule).toBeFalse()
    expect('GeminiProvider' in indexModule).toBeFalse()
    expect('OpenAIProvider' in indexModule).toBeFalse()
  })
})
