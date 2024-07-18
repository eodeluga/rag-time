import type { TextEmbedding } from '@@models/TextEmbedding'
import { LlmEmbeddingValidator } from '@@validators/llmEmbedding.validator'
import type OpenAI from 'openai'

export class TextEmbeddingService {
  private llm: OpenAI
  
  constructor(llm: OpenAI) {
    this.llm = llm
  }
  
  async embedSentences(sentences: string[]) {
    const response = await this.llm.embeddings.create({
      model: 'text-embedding-ada-002',
      input: sentences,
    })
    
    return LlmEmbeddingValidator.parse(response?.data)
      .map((llmEmbedding, i) => ({
        index: llmEmbedding.index,
        text: sentences[i],
        embedding: llmEmbedding.embedding,
      })) satisfies TextEmbedding[]
  }  
}
