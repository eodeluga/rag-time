/**
 * A single conversational turn exchanged with a chat model.
 */
export interface Message {
  /** Text content of the message. */
  content: string
  /**
   * Conversation role:
   * - `'system'` — sets the model's behaviour and persona
   * - `'user'` — a human turn
   * - `'assistant'` — a model reply
   */
  role: 'assistant' | 'system' | 'user'
}
