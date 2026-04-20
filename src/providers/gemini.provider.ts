import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChatProvider, CompletionOptions } from '@/models/chat-provider.model'
import type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'
import type { Message } from '@/models/message.model'

type GeminiProviderConfig = {
  apiKey: string
  chatModel?: string
  embeddingModel?: string
}

/**
 * Google Gemini provider implementing both {@link ChatProvider} and {@link EmbeddingProvider}.
 *
 * Wraps the Google Generative AI SDK for chat completions (`gemini-1.5-pro` by default)
 * and text embeddings (`text-embedding-004` by default). Pass an instance of this class
 * as both `chatProvider` and `embeddingProvider` in {@link RagConfig} to use a single
 * Google API key for the entire RAG pipeline.
 *
 * @example
 * const provider = new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY! })
 * const rag = new ConversationalRag({ chatProvider: provider, embeddingProvider: provider })
 */
export class GeminiProvider implements ChatProvider, EmbeddingProvider {
  private chatModel: string
  private client: GoogleGenerativeAI
  private embeddingModel: string

  /**
   * @param {object} config - Provider configuration.
   * @param {string} config.apiKey - Google Generative AI API key.
   * @param {string} [config.chatModel='gemini-1.5-pro'] - Gemini chat model identifier.
   * @param {string} [config.embeddingModel='text-embedding-004'] - Gemini embedding model identifier.
   */
  constructor(config: GeminiProviderConfig) {
    this.chatModel = config.chatModel ?? 'gemini-1.5-pro'
    this.client = new GoogleGenerativeAI(config.apiKey)
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-004'
  }

  /**
   * Sends messages to the configured Gemini chat model and returns the reply.
   *
   * `'system'` role messages are prepended to the final user prompt. Conversation
   * history is forwarded as Gemini chat turns.
   *
   * @param {Message[]} messages - Conversation messages including system, user, and assistant turns.
   * @param {CompletionOptions} [options] - Optional settings (jsonMode).
   * @returns {Promise<string>} The model's text response.
   */
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

  /**
   * Converts an array of strings into embedding vectors using the configured Gemini model.
   *
   * @param {string[]} inputs - Strings to embed.
   * @returns {Promise<EmbeddingVector[]>} One {@link EmbeddingVector} per input string, in input order.
   */
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
