import type OpenAI from 'openai'
import { promises as fs } from 'fs'
import pdfparse from 'pdf-parse-debugging-disabled'
import { CreateEmbeddingValidator } from '@/validators/CreateEmbedding.validator'
import { TextChunkerService } from '@/services/TextChunker.service'
import { EmbeddingManagementService } from '@/services/EmbeddingManagement.service'
import { EmbeddingError } from '@/errors/embedding.error'
import { PdfParseError } from '@/errors/pdf-parse.error'
import { hashString } from '@/utils/hashing.util'
import type { EmbeddingResult } from '@/models/EmbeddingResult'
import type { TextEmbedding } from '@/models/TextEmbedding'

class EmbeddingProcessingService {
  private embeddingManagementService: EmbeddingManagementService
  private llm: OpenAI
  private model: string
  private textChunkerService: TextChunkerService

  constructor(llm: OpenAI, model = 'text-embedding-ada-002') {
    this.embeddingManagementService = new EmbeddingManagementService()
    this.llm = llm
    this.model = model
    this.textChunkerService = new TextChunkerService(llm)
  }

  async createTextEmbedding(input: string | string[]): Promise<TextEmbedding[]> {
    const inputs = Array.isArray(input) ? input : [input]

    const response = await this.llm.embeddings.create({
      input: inputs,
      model: this.model,
    })

    return CreateEmbeddingValidator.parse(response.data)
      .map((item) => {
        const text = inputs[item.index]

        if (!text) {
          throw new EmbeddingError(`Text not found at embedding index ${item.index}`)
        }

        return {
          index: item.index,
          text,
          vector: item.embedding,
        } satisfies TextEmbedding
      })
  }

  async embedText(text: string | string[]): Promise<EmbeddingResult> {
    try {
      const textAsString = Array.isArray(text) ? text.join() : text
      const hashAsCollectionId = hashString(textAsString)
      const embeddingExists = await this.embeddingManagementService.embeddingExists(hashAsCollectionId)

      if (!embeddingExists) {
        const chunkedTexts = await this.textChunkerService.chunk(textAsString)

        const combinedTextWithSummary = chunkedTexts.map((chunk, index) => ({
          index,
          text: chunk.summary
            ? chunk.text + '.' + chunk.summary
            : chunk.text,
        }))

        const textEmbedding = await this.createTextEmbedding(
          combinedTextWithSummary.map((chunk) => chunk.text)
        )

        await this.embeddingManagementService.insertEmbedding(hashAsCollectionId, textEmbedding)
      }

      return {
        embeddingId: hashAsCollectionId,
      }
    } catch (err) {
      return {
        embeddingId: null,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async embedPDF(filePath: string): Promise<EmbeddingResult> {
    let buffer: Buffer

    try {
      buffer = await fs.readFile(filePath)
    } catch (err) {
      throw new PdfParseError(`Failed to read PDF file: ${filePath}`, err)
    }

    try {
      const { text } = await pdfparse(buffer)
      return this.embedText(text)
    } catch (err) {
      throw new PdfParseError('Failed to parse PDF content', err)
    }
  }
}

export { EmbeddingProcessingService }
