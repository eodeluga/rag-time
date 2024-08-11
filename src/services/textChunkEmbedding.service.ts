import type { TextChunk } from '@@models/TextChunk'
import type { TextEmbedding } from '@@models/TextEmbedding'
import { EmbeddingService } from '@@services/embedding.service'

/**
 * @class TextEmbeddingService
 * @classdesc TextEmbeddingService class for embedding text
 * @param {EmbeddingService} embeddingService - EmbeddingService instance
 * @returns {TextEmbedding} TextEmbedding object
 */
export class TextChunkEmbeddingService {
  private embeddingService: EmbeddingService
  
  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService
  }
  
  /**
   * @function embedChunks
   * @description Embed text chunks
   * @param {TextChunk[]} chunks - The text and optional text summaries chunks to embed
   * @returns {TextEmbedding[]} The embeddings of text object of the chunks
   */
  async embedChunks(chunks: TextChunk[]): Promise<TextEmbedding[]> {
  
    const chunkMap = chunks.map(
      (chunk, index) => ({
        index,
        text: chunk.summary
          ? chunk.text + '.' + chunk.summary
          : chunk.text,
      })
    )
    
    const embeddings = await this.embeddingService.embedTexts(chunkMap.map((chunk) => chunk.text))
        
    return embeddings.map((embedding) => ({
      index: embedding.index,
      text: chunkMap.find((chunk) => chunk.index === embedding.index)?.text!,
      vector: embedding.vector,
    })) satisfies TextEmbedding[]
  }  
}
