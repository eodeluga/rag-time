import { nanoid } from 'nanoid'
import type { VectorChunk } from '@@models/VectorChunk'
import { QdrantDbConnection } from '@@utils/connectionManager.util'

export class DocumentIndexService {
  private client = QdrantDbConnection
  private collectionId = nanoid()
    
  async updateDocumentVectorChunks(chunks: VectorChunk[]) {
    const qdrantPoints = chunks.map((chunk) => ({
      id: chunk.index,
      vector: [...chunk.textEmbeddings, ...chunk.summaryEmbeddings],
      payload: {
        index: chunk.index,
        text: chunk.text,
        summary: chunk.summary,
      },
    }))
    
    await this.client.upsert(this.collectionId, {
      points: qdrantPoints,
    })
  }
  
  // public static async searchDocumentChunks(query: string, k: number) {
  //   const qdrant = await this.getQdrantClient()
  //   const { ids } = await qdrant.search({query, k})
  //   return ids
  // }
}
