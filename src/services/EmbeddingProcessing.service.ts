import { CreateEmbedding } from '@@models/CreateEmbedding'
import { CreateEmbeddingResponseValidator } from '@@validators/CreateEmbeddingResponse.validator'
import type OpenAI from 'openai'
import { TextChunkerService } from './TextChunker.service'
import { EmbeddingIndexingService } from './EmbeddingIndexing.service'
import { hashBuffer } from '@@utils/hashing.util'
import { EmbeddingResult } from '@@models/EmbeddingResult'

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
  
  /**
   * @function embed
   * @description Creates a vector embedding of a text array
   * @param {string[]} texts - The texts to embed
   * @returns {number[]} The vector embedding representation of text array
   */
  async embedTexts(texts: string[]): Promise<EmbeddingResult> {
    try {
      const text = texts.join()
      const { Buffer } = await import('node:buffer')
      const buffer = Buffer.from(text)
      const hashAsCollectionId = await hashBuffer(buffer)
      
      const embeddingExists = await this.embeddingIndexingService.embeddingExists(hashAsCollectionId)
      
      const textChunker = new TextChunkerService(this.llm)
      const chunkedTexts = await textChunker.chunk(texts.join())
      
      const consolidatedTextAndSummary = chunkedTexts.map(
        (chunk) => chunk.summary
          ? chunk.text + '.' + chunk.summary
          : chunk.text,
      )
      
      const createEmbeddingResponse = await this.llm.embeddings.create({
        model: this.model,
        input: consolidatedTextAndSummary,
      })
      
      const vectorEmbedding = CreateEmbeddingResponseValidator.parse(createEmbeddingResponse?.data)
        .map((vector) => ({
          index: vector.index,
          vector: vector.embedding,
        })) satisfies CreateEmbedding[]
        
      
      const textEmbeddingMap = vectorEmbedding.map(({ vector, index }) => {
      
      }
      
          const embeddings = await this.EmbeddingProcessingService.embedTexts(chunkMap.map((chunk) => chunk.text))
        
    return embeddings.map((embedding) => ({
      index: embedding.index,
      text: chunkMap.find((chunk) => chunk.index === embedding.index)?.text!,
      vector: embedding.vector,
    })) satisfies TextEmbedding[]
      
        
      this.embeddingIndexingService.insert(hashAsCollectionId, vectorEmbedding[0].vecto)
        
    } catch (err){
      return {
        result: 'error',
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }
  
  async embedPDF(filePath: string): Promise<CreateEmbedding[]> {
  
    try {
          const buffer = await fs.readFile(filePath)
          const hashAsCollectionName = await HashingService.hashBuffer(buffer)
          const exists = await this.textChunkIndexingService.embeddingExists(hashAsCollectionName)
          
          if (exists) {
            return hashAsCollectionName
          }
        }

        const { text } = await pdfparse(buffer)

        return hashAsCollectionName
        // const chunks = this.textChunkerService.chunk(text)
        // return chunks
      } catch {
        throw new Error('Problem parsing PDF')
      }
  }
}

