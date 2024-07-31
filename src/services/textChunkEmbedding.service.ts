import type { TextChunk } from '@@models/TextChunk.model'
import type { TextEmbedding } from '@@models/TextEmbedding.model'
import { LlmEmbeddingValidator } from '@@validators/llmEmbedding.validator'
import type OpenAI from 'openai'

/**
 * @class TextEmbeddingService
 * @classdesc TextEmbeddingService class for embedding text
 * @param {OpenAI} llm - OpenAI instance
 * @returns {TextEmbedding} TextEmbedding object
 */
export class TextChunkEmbeddingService {
  private llm: OpenAI
  
  constructor(llm: OpenAI) {
    this.llm = llm
  }
  
  /**
   * @function embedChunks
   * @description Embed text chunks
   * @param {TextChunk[]} chunks - The text and optional text summaries chunks to embed
   * @returns {TextEmbedding[]} The embeddings of text object of the chunks
   */
  async embedChunks(chunks: TextChunk[]): Promise<TextEmbedding[]> {
    const textAndSummaries = chunks.map(
      (chunk) => chunk.summary
        ? chunk.text + '.' + chunk.summary
        : chunk.text
    )
      
    const response = await this.llm.embeddings.create({
      model: 'text-embedding-ada-002',
      input: textAndSummaries,
    })
    
    return LlmEmbeddingValidator.parse(response?.data)
      .map((llmEmbedding, i) => ({
        index: llmEmbedding.index,
        text: textAndSummaries[i],
        embedding: llmEmbedding.embedding,
      })) satisfies TextEmbedding[]
  }  
}
