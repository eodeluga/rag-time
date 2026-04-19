import { QdrantClient } from '@qdrant/qdrant-js'
import { VectorStoreError } from '@/errors/vector-store.error'
import { UnsupportedVectorFilterOperatorError } from '@/errors/unsupported-vector-filter-operator.error'
import { VectorFilterValidator } from '@/validators/vector-filter.validator'
import type { QdrantVectorStoreConfig } from '@/models/qdrant-config.model'
import type { RetrievalSearchOptions, VectorFilterCondition } from '@/models/vector-filter.model'
import type {
  VectorPoint,
  VectorSearchResult,
  VectorStore,
  VectorStoreInsertResult,
} from '@/models/vector-store.model'

type QdrantFilter =
  | { must: QdrantFilter[] }
  | { must_not: QdrantFilter[] }
  | { should: QdrantFilter[] }
  | { key: string; match: { any: (boolean | number | string)[] } }
  | { key: string; match: { value: boolean | number | string } }
  | { key: string; range: Record<string, number> }

export class QdrantVectorStore implements VectorStore {
  private client: QdrantClient
  private collectionDefaultSegmentNumber: number
  private collectionReplicationFactor: number

  constructor(config: QdrantVectorStoreConfig = {}) {
    const url = config.url ?? process.env['QDRANT_URL'] ?? 'http://localhost:6333'
    this.client = new QdrantClient({ url })
    this.collectionDefaultSegmentNumber = config.collection?.defaultSegmentNumber ?? 2
    this.collectionReplicationFactor = config.collection?.replicationFactor ?? 2
  }

  protected translateFilter(condition: VectorFilterCondition): QdrantFilter {
    switch (condition.operator) {
      case 'eq':
        return { must: [{ key: condition.field, match: { value: condition.value } }] }

      case 'ne':
        return { must_not: [{ key: condition.field, match: { value: condition.value } }] }

      case 'in':
        return { must: [{ key: condition.field, match: { any: condition.values } }] }

      case 'gt':
        return { must: [{ key: condition.field, range: { gt: condition.value } }] }

      case 'gte':
        return { must: [{ key: condition.field, range: { gte: condition.value } }] }

      case 'lt':
        return { must: [{ key: condition.field, range: { lt: condition.value } }] }

      case 'lte':
        return { must: [{ key: condition.field, range: { lte: condition.value } }] }

      case 'and':
        return { must: condition.conditions.map((cond) => this.translateFilter(cond)) }

      case 'or':
        return { should: condition.conditions.map((cond) => this.translateFilter(cond)) }

      case 'not':
        return { must_not: [this.translateFilter(condition.condition)] }

      default: {
        const exhaustiveCheck: never = condition
        throw new UnsupportedVectorFilterOperatorError(
          `Operator is not supported by Qdrant`,
          exhaustiveCheck
        )
      }
    }
  }

  async exists(collectionId: string): Promise<boolean> {
    try {
      const { exists } = await this.client.collectionExists(collectionId)
      return exists
    } catch (err) {
      throw new VectorStoreError(`Failed to check collection existence: ${collectionId}`, err)
    }
  }

  async insert(collectionId: string, points: VectorPoint[]): Promise<VectorStoreInsertResult> {
    if (points.length === 0) {
      throw new VectorStoreError('Cannot insert an empty points array')
    }

    try {
      await this.client.createCollection(collectionId, {
        optimizers_config: {
          default_segment_number: this.collectionDefaultSegmentNumber,
        },
        replication_factor: this.collectionReplicationFactor,
        vectors: {
          distance: 'Cosine',
          size: points[0]!.vector.length,
        },
      })

      const { status } = await this.client.upsert(collectionId, {
        points: points.map((point) => ({
          id: point.id,
          payload: point.payload,
          vector: point.vector,
        })),
      })

      return { collectionId, status }
    } catch (err) {
      throw new VectorStoreError(`Failed to insert into collection: ${collectionId}`, err)
    }
  }

  async search(
    collectionId: string,
    queryVector: number[],
    options: RetrievalSearchOptions
  ): Promise<VectorSearchResult[]> {
    const validatedSearchOptions = VectorFilterValidator.validateSearchOptions(options)
    const translatedFilter = validatedSearchOptions.filter
      ? this.translateFilter(validatedSearchOptions.filter)
      : undefined

    try {
      const results = await this.client.search(collectionId, {
        ...(translatedFilter !== undefined && { filter: translatedFilter }),
        limit: validatedSearchOptions.limit,
        vector: queryVector,
      })

      return results.map((result) => ({
        id: result.id,
        payload: result.payload ?? {},
        score: result.score,
      }))
    } catch (err) {
      throw new VectorStoreError(`Failed to search collection: ${collectionId}`, err)
    }
  }
}
