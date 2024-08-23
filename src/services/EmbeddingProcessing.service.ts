import type OpenAI from 'openai'
import { promises as fs } from 'fs'
import pdfparse from 'pdf-parse-debugging-disabled'
import { CreateEmbeddingValidator } from '@@validators/CreateEmbedding.validator'
import { TextChunkerService } from '@@services/TextChunker.service'
import { EmbeddingManagementService } from '@@services/EmbeddingManagement.service'
import { hashBuffer } from '@@utils/hashing.util'
import { EmbeddingResult } from '@@models/EmbeddingResult'
import { TextEmbedding } from '@@models/TextEmbedding'

/**
 * Service for processing embeddings using OpenAI's models and managing them in a Qdrant database.
 *
 * This class handles the creation and embedding of text and PDFs, interacts with the embedding management service,
 * and processes text into embeddings by chunking and validating.
 *
 * @class
 */
export class EmbeddingProcessingService {

  private embeddingManagementService: EmbeddingManagementService
  private llm: OpenAI
  private model: string
  
  /**
  * Creates an instance of EmbeddingProcessingService.
  *
  * @param {OpenAI} llm - The OpenAI client used for generating embeddings.
  * @param {string} [model='text-embedding-ada-002'] - The model to use for embeddings, defaults to 'text-embedding-ada-002'.
  */
  constructor(llm: OpenAI, model = 'text-embedding-ada-002') {
    this.embeddingManagementService = new EmbeddingManagementService()
    this.llm = llm
    this.model = model
  }
  
  /**
  * Creates embeddings for the provided text or array of texts.
  *
  * @param {string | string[]} input - The text or array of texts to be embedded.
  * @returns {Promise<TextEmbedding[]>} - A promise that resolves to an array of text embeddings.
  * @throws {Error} - Throws an error if a text is not found in the chunk map.
  */
  async createTextEmbedding(input: string | string[]): Promise<TextEmbedding[]> {
    const textWithIndex = Array.isArray(input)
      ? input.map((text, index) => ({
        index,
        text,
      }))
      : [{
        index: 0,
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
  * Embeds the provided text or array of texts, chunking and indexing if necessary.
  *
  * @param {string | string[]} text - The text or array of texts to embed.
  * @returns {Promise<EmbeddingResult>} - A promise that resolves to the embedding result.
  */
  async embedText(text: string | string[]): Promise<EmbeddingResult> {
    try {
      const { Buffer } = await import('node:buffer')
      const textAsString = `${Array.isArray(text) ? text.join() : text}`
      const buffer = Buffer.from(`${Array.isArray(text) ? text.join() : text}`)
      const hashAsCollectionId = await hashBuffer(buffer)
      
      const embeddingExists = await this.embeddingManagementService.embeddingExists(hashAsCollectionId)
      
      if (!embeddingExists) {
        const textChunker = new TextChunkerService(this.llm)
        const chunkedTexts = await textChunker.chunk(textAsString)
        
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
        
        await this.embeddingManagementService.insertEmbedding(hashAsCollectionId, textEmbedding)
      }
      
      return {
        embeddingId: hashAsCollectionId,
      }
      
    } catch (err){
      return {
        embeddingId: null,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }
  
  /**
  * Embeds the text extracted from a PDF file.
  *
  * @param {string} filePath - The path to the PDF file.
  * @returns {Promise<EmbeddingResult>} - A promise that resolves to the embedding result.
  * @throws {Error} - Throws an error if there is a problem parsing the PDF.
  */
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
