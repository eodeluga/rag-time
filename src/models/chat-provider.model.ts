import type { Message } from '@/models/message.model'

/**
 * Options for customising LLM completion requests.
 */
interface CompletionOptions {
  /**
   * When `true`, instructs the model to return a valid JSON object.
   * Availability depends on the underlying provider.
   */
  jsonMode?: boolean
  /**
   * Sampling temperature (0–2). Higher values produce more varied output;
   * lower values make output more focused and deterministic.
   */
  temperature?: number
  /**
   * Nucleus sampling probability threshold (0–1). Limits token selection to the
   * cumulative top-p probability mass.
   */
  topP?: number
}

/**
 * Minimal contract for LLM chat-completion providers.
 *
 * Implement this interface to integrate any chat model into the RAG pipeline.
 *
 * @example
 * class MyProvider implements ChatProvider {
 *   async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
 *     // call your LLM API here
 *   }
 * }
 */
interface ChatProvider {
  /**
   * Sends a sequence of messages to the underlying LLM and returns the model's reply.
   *
   * @param {Message[]} messages - Conversation messages in chronological order.
   *   `'system'` messages define instructions; `'user'`/`'assistant'` messages form the dialogue.
   * @param {CompletionOptions} [options] - Optional settings such as temperature or JSON output mode.
   * @returns {Promise<string>} A promise that resolves to the model's text response.
   */
  complete(messages: Message[], options?: CompletionOptions): Promise<string>
}

export type {
  ChatProvider,
  CompletionOptions,
}
