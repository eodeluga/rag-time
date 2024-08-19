import type OpenAI from 'openai'
import { promises as fs } from 'fs'
import pdfparse from 'pdf-parse-debugging-disabled'
import { CreateEmbeddingValidator } from '@@validators/CreateEmbedding.validator'
import { TextChunkerService } from '@@services/TextChunker.service'
import { EmbeddingIndexingService } from '@@services/EmbeddingIndexing.service'
import { hashBuffer } from '@@utils/hashing.util'
import { EmbeddingResult } from '@@models/EmbeddingResult'
import { TextEmbedding } from '@@models/TextEmbedding'

/**
 * @class EmbeddingProcessingService
 * @classdesc EmbeddingProcessingService class for embedding text
 * @param {OpenAI} llm - OpenAI instance
 * @param {string} model - The model to use for embedding
 * @returns {TextEmbedding} TextEmbedding object
 */
export class EmbeddingProcessingService {

  private embeddingIndexingService: EmbeddingIndexingService
  private llm: OpenAI
  private model: string
  
  constructor(llm: OpenAI, model = 'text-embedding-ada-002') {
    this.embeddingIndexingService = new EmbeddingIndexingService()
    this.llm = llm
    this.model = model
  }
  
  async createTextEmbedding(input: string | string[]): Promise<TextEmbedding[]> {
    const textWithIndex = Array.isArray(input)
      ? input.map((text, index) => ({
        index,
        text,
      }))
      : [{
        index: 1,
        text: input,
      }]
      
    const embedding = await this.llm.embeddings.create({
      model: this.model,
      input,
    })
  
    return CreateEmbeddingValidator.parse(embedding?.data)
      .map((embedding) => {
        const text = textWithIndex.find((combinedItem) => combinedItem.index === embedding.index)?.text
        
        if (!text) {
          throw new Error('Text not found in chunk map')
        }
        
        return {
          index: embedding.index,
          text,
          vector: embedding.embedding,
        } satisfies TextEmbedding
      })
  }
  
  /**
   * @function embed
   * @description Creates a vector embedding of a text array
   * @param {string[]} text - The texts to embed
   * @returns {number[]} The vector embedding representation of text array
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    try {
      const { Buffer } = await import('node:buffer')
      const buffer = Buffer.from(text)
      const hashAsCollectionId = await hashBuffer(buffer)
      
      const embeddingExists = await this.embeddingIndexingService.embeddingExists(hashAsCollectionId)
      
      if (!embeddingExists) {
        const textChunker = new TextChunkerService(this.llm)
        const chunkedTexts = await textChunker.chunk(text)
        
        const combinedTextWithSummary = chunkedTexts.map(
          (chunk, index) => ({
            index,
            text: chunk.summary
              ? chunk.text + '.' + chunk.summary
              : chunk.text,
          })
        )
        
        const textEmbedding = await this.createTextEmbedding(
          combinedTextWithSummary.map((chunk) => chunk.text)
        )
        
        await this.embeddingIndexingService.insert(hashAsCollectionId, textEmbedding)
      }
      
      return {
        result: 'ok',
        embeddingId: hashAsCollectionId,
      }
      
    } catch (err){
      return {
        result: 'error',
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }
  
  async embedPDF(filePath: string): Promise<EmbeddingResult> {
    try {
      const buffer = await fs.readFile(filePath)
      const { text } = await pdfparse(buffer)
      const result = await this.embedText(text)
      return result
    } catch {
      throw new Error('Problem parsing PDF')
    }
  }
}
