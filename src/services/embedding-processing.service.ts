import { promises as fs } from 'fs'
import pdfparse from 'pdf-parse-debugging-disabled'
import { EmbeddingManagementService } from '@/services/embedding-management.service'
import { EmbeddingError } from '@/errors/embedding.error'
import { PdfParseError } from '@/errors/pdf-parse.error'
import { hashString } from '@/utils/hashing.util'
import { FilePathValidator } from '@/validators/file-path.validator'
import { MetadataValidator } from '@/validators/metadata.validator'
import type { EmbeddingProvider } from '@/models/embedding-provider.model'
import type { Metadata } from '@/models/metadata.model'
import type { EmbeddingResult } from '@/models/embedding-result.model'
import type { TextChunk } from '@/models/text-chunk.model'
import type { TextEmbedding } from '@/models/text-embedding.model'

type EmbedOpts = {
  chunkFn?: (text: string) => Promise<TextChunk[]>
  metadata?: Metadata
}

/**
 * Handles the generation and storage of text embeddings, including LLM-assisted
 * chunking, content-hash deduplication, and PDF ingestion.
 *
 * Acts as the primary entry point for converting raw text or PDF content into
 * searchable vector embeddings persisted in a {@link VectorStore}.
 */
export class EmbeddingProcessingService {
  private embeddingManagementService: EmbeddingManagementService
  private embeddingProvider: EmbeddingProvider

  /**
   * @param {EmbeddingProvider} embeddingProvider - Provider used to generate dense embedding vectors.
   * @param {EmbeddingManagementService} embeddingManagementService - Service used to check existence and persist embeddings.
   */
  constructor(
    embeddingProvider: EmbeddingProvider,
    embeddingManagementService: EmbeddingManagementService
  ) {
    this.embeddingManagementService = embeddingManagementService
    this.embeddingProvider = embeddingProvider
  }

  private serialiseInputForHashing(input: string | string[]): string {
    return JSON.stringify({
      inputType: Array.isArray(input) ? 'text-array' : 'text',
      value: input,
    })
  }

  /**
   * Converts one or more text strings into {@link TextEmbedding} records using the configured provider.
   *
   * @param {string | string[]} input - A single string or an array of strings to embed.
   * @returns {Promise<TextEmbedding[]>} One {@link TextEmbedding} per input string, preserving order by `index`.
   * @throws {EmbeddingError} If the provider returns a vector without a corresponding input text.
   */
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

  /**
   * Embeds text and persists the result in the vector store.
   *
   * The collection identifier is derived from a SHA-256 hash of the input, so
   * identical content is deduplicated — repeated calls with the same text skip
   * the embedding and storage steps entirely.
   *
   * @param {string | string[]} text - A single string or array of strings to embed and store.
   * @param {object} [opts] - Optional embedding options.
   * @param {Function} [opts.chunkFn] - **Required on first embed.** Splits the text into
   *   {@link TextChunk}s before embedding. Typically a bound reference to {@link TextChunkerService.chunk}.
   * @param {Metadata} [opts.metadata] - Optional metadata attached to every stored embedding point.
   * @returns {Promise<EmbeddingResult>} `embeddingId` (content hash) on success,
   *   or `null` with an error `message` on failure.
   */
  async embedText(text: string | string[], opts?: EmbedOpts): Promise<EmbeddingResult> {
    try {
      const textAsString = Array.isArray(text) ? text.join() : text
      const serialisedText = this.serialiseInputForHashing(text)
      const validatedMetadata = opts?.metadata
        ? MetadataValidator.parse(opts.metadata)
        : undefined
      const hashAsCollectionId = hashString(serialisedText)
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
          validatedMetadata
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

  /**
   * Reads a PDF file from disk, extracts its text content, and embeds it via {@link embedText}.
   *
   * @param {string} filePath - Absolute or relative path to the PDF file.
   * @param {object} [opts] - Same options as {@link embedText} (`chunkFn`, `metadata`).
   * @returns {Promise<EmbeddingResult>} `embeddingId` on success, or `null` with an error `message` on failure.
   * @throws {PdfParseError} If the file cannot be read from disk or its content cannot be parsed.
   */
  async embedPDF(filePath: string, opts?: EmbedOpts): Promise<EmbeddingResult> {
    const validatedFilePath = FilePathValidator.parse(filePath)
    let buffer: Buffer

    try {
      buffer = await fs.readFile(validatedFilePath)
    } catch (err) {
      throw new PdfParseError(`Failed to read PDF file: ${validatedFilePath}`, err)
    }

    try {
      const { text } = await pdfparse(buffer)
      return this.embedText(text, opts)
    } catch (err) {
      throw new PdfParseError('Failed to parse PDF content', err)
    }
  }
}
