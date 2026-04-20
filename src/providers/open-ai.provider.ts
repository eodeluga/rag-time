import OpenAI from 'openai'
import type { ChatProvider, CompletionOptions } from '@/models/chat-provider.model'
import type { EmbeddingProvider, EmbeddingVector } from '@/models/embedding-provider.model'
import type { Message } from '@/models/message.model'

type OpenAIProviderConfig = {
  apiKey: string
  chatModel?: string
  embeddingModel?: string
}

/**
 * OpenAI provider implementing both {@link ChatProvider} and {@link EmbeddingProvider}.
 *
 * Wraps the OpenAI API for chat completions (`gpt-4o` by default) and text embeddings
 * (`text-embedding-ada-002` by default). Pass an instance of this class as both
 * `chatProvider` and `embeddingProvider` in {@link RagConfig} to use a single OpenAI
 * account for the entire RAG pipeline.
 *
 * @example
 * const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
 * const rag = new ConversationalRag({ chatProvider: provider, embeddingProvider: provider })
 */
export class OpenAIProvider implements ChatProvider, EmbeddingProvider {
  private chatModel: string
  private client: OpenAI
  private embeddingModel: string

  /**
   * @param {object} config - Provider configuration.
   * @param {string} config.apiKey - OpenAI API key.
   * @param {string} [config.chatModel='gpt-4o'] - Chat model identifier.
   * @param {string} [config.embeddingModel='text-embedding-ada-002'] - Embedding model identifier.
   */
  constructor(config: OpenAIProviderConfig) {
    this.chatModel = config.chatModel ?? 'gpt-4o'
    this.client = new OpenAI({ apiKey: config.apiKey })
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-ada-002'
  }

  /**
   * Sends messages to the configured OpenAI chat model and returns the reply.
   *
   * @param {Message[]} messages - Conversation messages including system, user, and assistant turns.
   * @param {CompletionOptions} [options] - Optional settings (temperature, topP, jsonMode).
   * @returns {Promise<string>} The model's text response, or an empty string if the response is empty.
   */
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

  /**
   * Converts an array of strings into embedding vectors using the configured OpenAI model.
   *
   * @param {string[]} inputs - Strings to embed.
   * @returns {Promise<EmbeddingVector[]>} One {@link EmbeddingVector} per input string, in input order.
   */
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
