import Anthropic from '@anthropic-ai/sdk'
import type { ChatProvider, CompletionOptions } from '@/models/chat-provider.model'
import type { Message } from '@/models/message.model'

type AnthropicProviderConfig = {
  apiKey: string
  model?: string
}

/**
 * Anthropic provider implementing {@link ChatProvider}.
 *
 * Wraps the Anthropic Messages API for chat completions using Claude models
 * (`claude-opus-4-6` by default). Use this as the `chatProvider` in {@link RagConfig}
 * when using Anthropic for LLM completions.
 *
 * Note: Anthropic does not provide an embedding API. Pair with a separate
 * {@link EmbeddingProvider} (e.g. {@link OpenAIProvider} or {@link GeminiProvider})
 * for the embedding step.
 *
 * @example
 * const chat = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
 * const embed = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
 * const rag = new ConversationalRag({ chatProvider: chat, embeddingProvider: embed })
 */
export class AnthropicProvider implements ChatProvider {
  private client: Anthropic
  private model: string

  /**
   * @param {object} config - Provider configuration.
   * @param {string} config.apiKey - Anthropic API key.
   * @param {string} [config.model='claude-opus-4-6'] - Claude model identifier.
   */
  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model ?? 'claude-opus-4-6'
  }

  /**
   * Sends messages to the configured Claude model and returns the reply.
   *
   * `'system'` role messages are extracted and forwarded as the Anthropic system prompt.
   * When `jsonMode` is enabled, a JSON instruction is appended to the final user message.
   *
   * @param {Message[]} messages - Conversation messages including system, user, and assistant turns.
   * @param {CompletionOptions} [options] - Optional settings (jsonMode).
   * @returns {Promise<string>} The model's text response, or an empty string if the response is empty.
   */
  async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
    const systemContent = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n')

    let conversationMessages = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        content: message.content,
        role: message.role as 'assistant' | 'user',
      }))

    if (options?.jsonMode && conversationMessages.length > 0) {
      const last = conversationMessages[conversationMessages.length - 1]!
      conversationMessages = [
        ...conversationMessages.slice(0, -1),
        { ...last, content: last.content + ' Respond with valid JSON only.' },
      ]
    }

    const response = await this.client.messages.create({
      max_tokens: 4096,
      messages: conversationMessages,
      model: this.model,
      system: systemContent || undefined,
    })

    const firstBlock = response.content[0]
    return firstBlock?.type === 'text' ? firstBlock.text : ''
  }
}
