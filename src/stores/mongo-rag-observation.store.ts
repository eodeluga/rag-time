import type {
  RagObservation,
  RagObservationPage,
  RagObservationQuery,
  RagObservationStore,
} from '@/models/rag-observation.model'

type MongoObservationFilter = Record<string, unknown>

interface MongoObservationCollection {
  find(filter: MongoObservationFilter): MongoObservationCursor
  insertOne(observation: RagObservation): Promise<unknown>
}

interface MongoObservationCursor {
  limit(limit: number): MongoObservationCursor
  sort(sort: Record<string, 1 | -1>): MongoObservationCursor
  toArray(): Promise<RagObservation[]>
}

/**
 * Persists observation events through a MongoDB collection-like object.
 *
 * Pass the result of `db.collection<RagObservation>('ragObservations')` from the
 * official MongoDB driver, or any object with equivalent `insertOne` and `find`
 * methods.
 */
export class MongoRagObservationStore implements RagObservationStore {
  constructor(
    private collection: MongoObservationCollection
  ) { }

  async append(observation: RagObservation): Promise<void> {
    await this.collection.insertOne(observation)
  }

  async getObservations(query: RagObservationQuery): Promise<RagObservationPage> {
    const filters: MongoObservationFilter[] = []

    if (query.correlationId !== undefined) {
      filters.push({ correlationId: query.correlationId })
    }

    if (query.eventKeyPrefix !== undefined) {
      filters.push({
        eventKey: {
          $gte: query.eventKeyPrefix,
          $lt: `${query.eventKeyPrefix}\uffff`,
        },
      })
    }

    if (query.from !== undefined || query.to !== undefined) {
      const createdAt: MongoObservationFilter = {}

      if (query.from !== undefined) {
        createdAt['$gte'] = new Date(query.from).toISOString()
      }

      if (query.to !== undefined) {
        createdAt['$lte'] = new Date(query.to).toISOString()
      }

      filters.push({ createdAt })
    }

    if (query.level !== undefined) {
      filters.push({ level: query.level })
    }

    if (query.operationId !== undefined) {
      filters.push({ operationId: query.operationId })
    }

    if (query.cursor !== undefined) {
      const cursorObservations = await this.collection
        .find({ id: query.cursor })
        .limit(1)
        .toArray()
      const cursorObservation = cursorObservations[0]

      if (cursorObservation === undefined) {
        return {
          hasMore: false,
          nextCursor: null,
          observations: [],
        }
      }

      const comparator = query.sortDirection === 'desc'
        ? '$lt'
        : '$gt'

      filters.push({
        $or: [
          {
            createdAt: {
              [comparator]: cursorObservation.createdAt,
            },
          },
          {
            createdAt: cursorObservation.createdAt,
            id: {
              [comparator]: cursorObservation.id,
            },
          },
        ],
      })
    }

    const sortOrder = query.sortDirection === 'desc' ? -1 : 1
    const filter = filters.length === 0
      ? {}
      : {
        $and: filters,
      }
    const observations = await this.collection
      .find(filter)
      .sort({
        createdAt: sortOrder,
        id: sortOrder,
      })
      .limit(query.limit + 1)
      .toArray()
    const hasMore = observations.length > query.limit
    const pagedObservations = hasMore
      ? observations.slice(0, query.limit)
      : observations
    const nextCursor = hasMore
      ? pagedObservations[pagedObservations.length - 1]?.id ?? null
      : null

    return {
      hasMore,
      nextCursor,
      observations: pagedObservations,
    }
  }
}

export type {
  MongoObservationCollection,
  MongoObservationCursor,
  MongoObservationFilter,
}
