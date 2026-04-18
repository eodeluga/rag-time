import type { Message } from '@/models/message.model'

interface CompletionOptions {
  jsonMode?: boolean
  temperature?: number
  topP?: number
}

interface ChatProvider {
  complete(messages: Message[], options?: CompletionOptions): Promise<string>
}

export type {
  ChatProvider,
  CompletionOptions,
}
