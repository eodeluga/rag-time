import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChatProvider, CompletionOptions } from '@/models/chat-provider.model'
import type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'
import type { Message } from '@/models/message.model'

type GeminiProviderConfig = {
  apiKey: string
  chatModel?: string
  embeddingModel?: string
}

export class GeminiProvider implements ChatProvider, EmbeddingProvider {
  private chatModel: string
  private client: GoogleGenerativeAI
  private embeddingModel: string

  constructor(config: GeminiProviderConfig) {
    this.chatModel = config.chatModel ?? 'gemini-1.5-pro'
    this.client = new GoogleGenerativeAI(config.apiKey)
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-004'
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
    const model = this.client.getGenerativeModel({
      generationConfig: options?.jsonMode
        ? { responseMimeType: 'application/json' }
        : undefined,
      model: this.chatModel,
    })

    const systemContent = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n')

    const turns = messages.filter((message) => message.role !== 'system')

    const history = turns.slice(0, -1).map((message) => ({
      parts: [{ text: message.content }],
      role: message.role === 'assistant' ? 'model' : 'user',
    }))

    const lastMessage = turns[turns.length - 1]
    const prompt = systemContent
      ? `${systemContent}\n\n${lastMessage?.content ?? ''}`
      : (lastMessage?.content ?? '')

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(prompt)
    return result.response.text()
  }

  async embed(inputs: string[]): Promise<EmbeddingVector[]> {
    const model = this.client.getGenerativeModel({ model: this.embeddingModel })
    const response = await model.batchEmbedContents({
      requests: inputs.map((text) => ({
        content: {
          parts: [{ text }],
          role: 'user',
        },
      })),
    })

    return response.embeddings.map((embedding, index) => ({
      index,
      vector: embedding.values,
    }))
  }
}
