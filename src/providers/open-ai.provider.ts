import OpenAI from 'openai'
import type { ChatProvider, CompletionOptions } from '@/models/chat-provider.model'
import type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'
import type { Message } from '@/models/message.model'

type OpenAIProviderConfig = {
  apiKey: string
  chatModel?: string
  embeddingModel?: string
}

class OpenAIProvider implements ChatProvider, EmbeddingProvider {
  private chatModel: string
  private client: OpenAI
  private embeddingModel: string

  constructor(config: OpenAIProviderConfig) {
    this.chatModel = config.chatModel ?? 'gpt-4o'
    this.client = new OpenAI({ apiKey: config.apiKey })
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-ada-002'
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      messages: messages.map((message) => ({
        content: message.content,
        role: message.role,
      })),
      model: this.chatModel,
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
      temperature: options?.temperature,
      top_p: options?.topP,
    })

    return response.choices[0]?.message.content ?? ''
  }

  async embed(inputs: string[]): Promise<EmbeddingVector[]> {
    const response = await this.client.embeddings.create({
      input: inputs,
      model: this.embeddingModel,
    })

    return response.data.map((item) => ({
      index: item.index,
      vector: item.embedding,
    }))
  }
}

export { OpenAIProvider }
