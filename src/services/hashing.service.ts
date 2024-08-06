import { createHash } from 'crypto'
import { QdrantDbConnection } from '@@utils/connectionManager.util'
export class HashingService {
  
  static async hashExists(hash: string) {
    try {
      const qdrant = await QdrantDbConnection.getQdrantClient()
      const { exists } = await qdrant.collectionExists(hash)
      return exists
    } catch (error) {
      throw new Error(`Error checking if hash exists: ${error instanceof Error ? error.message : ''}`)
    }
  }
  
  static async hashBuffer(fileBuffer: Buffer): Promise<string> {
    try {
      const hash = createHash('sha256')
      hash.update(fileBuffer)
      return hash.digest('hex')
    } catch (error) {
      throw new Error(`Error creating hash: ${error instanceof Error ? error.message : ''}`)
    }
  }
}
