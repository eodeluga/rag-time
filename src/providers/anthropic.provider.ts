import Anthropic from '@anthropic-ai/sdk'
import type { ChatProvider, CompletionOptions } from '@/models/chat-provider.model'
import type { Message } from '@/models/message.model'

type AnthropicProviderConfig = {
  apiKey: string
  model?: string
}

class AnthropicProvider implements ChatProvider {
  private client: Anthropic
  private model: string

  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model ?? 'claude-opus-4-6'
  }

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

export { AnthropicProvider }
