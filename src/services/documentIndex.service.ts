import { nanoid } from 'nanoid'
import type { DocumentChunk } from '@@models/DocumentChunk'
import type { VectorChunk } from '@@models/VectorChunk'
import { QdrantDbConnection } from '@@utils/connectionManager.util'

export class DocumentIndexService {
  private client = QdrantDbConnection
  private collectionId = nanoid()
    
  async indexDocumentChunks(chunks: VectorChunk[]) {
    const vectors = chunks.map((chunk) => chunk.embeddings)
    const ids = chunks.map((chunk) => chunk.index)
    await this.client.upsert(this.collectionId, vectors, ids)
    /* {
      
      // vectors, 
      // ids,
    } */
  }
  
  public static async searchDocumentChunks(query: string, k: number) {
    const qdrant = await this.getQdrantClient()
    const { ids } = await qdrant.search({query, k})
    return ids
  }
}
