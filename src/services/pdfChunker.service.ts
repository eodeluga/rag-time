import { TextChunkerService } from '@@services/textChunker.service'
import { hashBuffer } from '@@utils/hashBuffer.util'
import { promises as fs } from 'fs'
import pdfparse from 'pdf-parse-debugging-disabled'
import { TextChunkEmbeddingService } from './textChunkEmbedding.service'
import { TextChunkIndexingService } from './textChunkIndexing.service'


export class PDFChunkerService {
  
  private textChunkerService: TextChunkerService
  private textChunkIndexingService?: TextChunkIndexingService
  
  constructor(
    textChunkerService: TextChunkerService,
    textChunkIndexingService?: TextChunkIndexingService
  ) {
    this.textChunkerService = textChunkerService
    this.textChunkIndexingService = textChunkIndexingService
  }
  
  async chunkPdf(filePath: string, opts?: { embeddingExistsCheck: true }) {
    
    if (opts && opts.embeddingExistsCheck) {
     
      if (!this.textChunkIndexingService) {
        throw new Error('Text chunk indexing service required for this operation')
      }
          
      try {
        const buffer = await fs.readFile(filePath)
        const hashAsCollectionName = await hashBuffer(buffer)
        const exists = await this.textChunkIndexingService.collectionExists(hashAsCollectionName)
        
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

