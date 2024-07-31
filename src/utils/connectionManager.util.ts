import { QdrantClient } from '@qdrant/qdrant-js'

class ConnectionManager {
  private static qdrantClient: QdrantClient | null = null
  
  private static async getQdrant() {
    const { QDRANT_URL } = process.env
    return new QdrantClient({url: QDRANT_URL ?? 'http://localhost:6333'})
  }
  
  public static async getQdrantClient() {
    ConnectionManager.qdrantClient = ConnectionManager.qdrantClient !== null
      ? ConnectionManager.qdrantClient
      : await this.getQdrant()
    return ConnectionManager.qdrantClient
  }  
}

export const QdrantDbConnection = ConnectionManager
