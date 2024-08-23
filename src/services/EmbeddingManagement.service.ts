import { QdrantDbConnection } from '@@utils/connectionManager.util'
import type { TextEmbedding } from '@@models/TextEmbedding'

/**
 * Manages embeddings within a Qdrant database.
 *
 * Handles operations such as checking collection existence, inserting embeddings,
 * and searching for similar embeddings.
 */
export class EmbeddingManagementService {
  
  /**
  * Checks if a collection with the specified ID exists in the Qdrant database.
  *
  * @param {string} embeddingId - The ID of the collection to check.
  * @returns {Promise<boolean>} - A promise that resolves to `true` if the collection exists, otherwise `false`.
  */
  async embeddingExists(embeddingId: string) {
    const client = await QdrantDbConnection.getQdrantClient()
    const { exists } = await client.collectionExists(embeddingId)
    return exists
  }
  
  /**
  * Inserts an array of text embeddings into a specified collection within the Qdrant database.
  * Creates the collection if it does not exist and configures it with vector and optimizer settings.
  *
  * @param {string} collectionId - The ID of the collection where the embeddings will be inserted.
  * @param {TextEmbedding[]} textEmbeddingArr - An array of text embeddings to be inserted.
  * @returns {Promise<{ collectionId: string, status: string }>} - A promise that resolves to an object containing the collection ID and the status of the insertion.
  */
  async insertEmbedding(collectionId: string, textEmbeddingArr: TextEmbedding[]) {
    const qdrantPoints = textEmbeddingArr.map((textEmbedding) => ({
      id: textEmbedding.index,
      vector: textEmbedding.vector,
      payload: {
        index: textEmbedding.index,
        text: textEmbedding.text,
      },
    }))

    const client = await QdrantDbConnection.getQdrantClient()

    await client.createCollection(collectionId, {
      vectors: {
        size: qdrantPoints[0].vector.length,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 2,
    })
    
    const result = await client.upsert(collectionId, {
      points: qdrantPoints,
    })
    
    return {
      collectionId: collectionId,
      status: result.status,
    }
  }
  
  /**
  * Searches for items similar to the given vector embedding within a specified collection.
  *
  * @param {string} collectionId - The ID of the collection to search within.
  * @param {TextEmbedding} vectorEmbedding - The vector embedding used to find similar items.
  * @param {number} limit - The maximum number of similar items to return.
  * @returns {Promise<string[]>} - A promise that resolves to an array of similar items.
  */
  async searchByEmbedding(collectionId: string, opts: { embedding: TextEmbedding, limit: number }): Promise<string[]> {
    const { embedding, limit } = opts
    const client = await QdrantDbConnection.getQdrantClient()
    const results = await client.search(collectionId, {
      vector: embedding.vector,
      limit,
    })
    
    return results.map((result) => (result.payload?.text as string ?? ''))
  }
}
