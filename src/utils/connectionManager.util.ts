import { QdrantClient } from '@qdrant/qdrant-js'

/**
 * Manages a singleton instance of the Qdrant client for connecting to a Qdrant database.
 *
 * This class ensures that only one instance of the Qdrant client is created and reused throughout the application.
 * It provides a static method to obtain the Qdrant client, creating it if necessary.
 *
 * @class
 */
class ConnectionManager {
  private static qdrantClient: QdrantClient | null = null
  
  /**
  * Creates a new instance of QdrantClient using the URL from environment variables.
  *
  * @returns {QdrantClient} - An instance of QdrantClient.
  */
  private static getQdrant() {
    const { QDRANT_URL } = process.env
    return new QdrantClient({ url: QDRANT_URL ?? 'http://localhost:6333' })
  }
  
  /**
  * Retrieves the singleton instance of QdrantClient, creating it if it does not already exist.
  *
  * @returns {QdrantClient} - The QdrantClient instance.
  */
  public static getQdrantClient() {
    ConnectionManager.qdrantClient = ConnectionManager.qdrantClient !== null
      ? ConnectionManager.qdrantClient
      : this.getQdrant()
    return ConnectionManager.qdrantClient
  }  
}

export const QdrantDbConnection = ConnectionManager
