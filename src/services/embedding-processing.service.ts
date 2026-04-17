import { promises as fs } from 'fs'
import pdfparse from 'pdf-parse-debugging-disabled'
import { EmbeddingManagementService } from '@/services/embedding-management.service'
import { EmbeddingError } from '@/errors/embedding.error'
import { PdfParseError } from '@/errors/pdf-parse.error'
import { hashString } from '@/utils/hashing.util'
import type { EmbeddingProvider } from '@/models/embedding-provider.model'
import type { Metadata } from '@/models/metadata.model'
import type { EmbeddingResult } from '@/models/embedding-result.model'
import type { TextChunk } from '@/models/text-chunk.model'
import type { TextEmbedding } from '@/models/text-embedding.model'

type EmbedOpts = {
  chunkFn?: (text: string) => Promise<TextChunk[]>
  metadata?: Metadata
}

class EmbeddingProcessingService {
  private embeddingManagementService: EmbeddingManagementService
  private embeddingProvider: EmbeddingProvider

  constructor(
    embeddingProvider: EmbeddingProvider,
    embeddingManagementService: EmbeddingManagementService
  ) {
    this.embeddingManagementService = embeddingManagementService
    this.embeddingProvider = embeddingProvider
  }

  async createTextEmbedding(input: string | string[]): Promise<TextEmbedding[]> {
    const inputs = Array.isArray(input) ? input : [input]
    const vectors = await this.embeddingProvider.embed(inputs)

    return vectors.map((item) => {
      const text = inputs[item.index]

      if (!text) {
        throw new EmbeddingError(`Text not found at embedding index ${item.index}`)
      }

      return {
        index: item.index,
        text,
        vector: item.vector,
      } satisfies TextEmbedding
    })
  }

  async embedText(text: string | string[], opts?: EmbedOpts): Promise<EmbeddingResult> {
    try {
      const textAsString = Array.isArray(text) ? text.join() : text
      const hashAsCollectionId = hashString(textAsString)
      const embeddingExists = await this.embeddingManagementService.embeddingExists(hashAsCollectionId)

      if (!embeddingExists) {
        if (!opts?.chunkFn) {
          throw new EmbeddingError(
            'chunkFn is required. Pass a TextChunkerService.chunk bound method via opts.chunkFn.'
          )
        }

        const chunkedTexts = await opts.chunkFn(textAsString)

        const combinedTextWithSummary = chunkedTexts.map((chunk, index) => ({
          index,
          text: chunk.summary
            ? chunk.text + '.' + chunk.summary
            : chunk.text,
        }))

        const textEmbedding = await this.createTextEmbedding(
          combinedTextWithSummary.map((chunk) => chunk.text)
        )

        await this.embeddingManagementService.insertEmbedding(
          hashAsCollectionId,
          textEmbedding,
          opts?.metadata
        )
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

  async embedPDF(filePath: string, opts?: EmbedOpts): Promise<EmbeddingResult> {
    let buffer: Buffer

    try {
      buffer = await fs.readFile(filePath)
    } catch (err) {
      throw new PdfParseError(`Failed to read PDF file: ${filePath}`, err)
    }

    try {
      const { text } = await pdfparse(buffer)
      return this.embedText(text, opts)
    } catch (err) {
      throw new PdfParseError('Failed to parse PDF content', err)
    }
  }
}

export { EmbeddingProcessingService }
