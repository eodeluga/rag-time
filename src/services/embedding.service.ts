import { VectorEmbedding } from '@@models/VectorEmbedding'
import { VectorEmbeddingValidator } from '@@validators/vectorEmbedding.validator'
import type OpenAI from 'openai'
import { TextChunkerService } from './textChunker.service'

/**
 * @class EmbeddingService
 * @classdesc EmbeddingService class for embedding text
 * @param {OpenAI} llm - OpenAI instance
 * @param {string} model - The model to use for embedding
 * @returns {TextEmbedding} TextEmbedding object
 */
export class EmbeddingService {

  private llm: OpenAI
  private model: string
  constructor(llm: OpenAI, model = 'text-embedding-ada-002') {
    this.llm = llm
    this.model = model
  }
  
  /**
   * @function embed
   * @description Creates a vector embedding of a text array
   * @param {string[]} texts - The texts to embed
   * @returns {number[]} The vector embedding representation of text array
   */
  async embedTexts(texts: string[]): Promise<VectorEmbedding[]> {
    const textChunker = new TextChunkerService(this.llm)
    const chunkedTexts = textChunker.chunk(texts.join())
     
    const response = await this.llm.embeddings.create({
      model: this.model,
      input: texts,
    })
    
    return VectorEmbeddingValidator.parse(response?.data)
      .map((vector) => ({
        index: vector.index,
        vector: vector.embedding,
      })) satisfies VectorEmbedding[]
  }
  
  async embedPDF(filePath: string): Promise<VectorEmbedding[]> {
  
  }
  
  private async embeddingExists() {
  
  }
}

