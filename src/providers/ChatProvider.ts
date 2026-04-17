import type { Message } from '@/models/Message'

export interface CompletionOptions {
  jsonMode?: boolean
  temperature?: number
  topP?: number
}

export interface ChatProvider {
  complete(messages: Message[], options?: CompletionOptions): Promise<string>
}
