import { describe, expect, it } from 'bun:test'
import { MongoRagObservationStore } from '@/stores/mongo-rag-observation.store'
import type { MongoObservationCollection, MongoObservationFilter } from '@/stores/mongo-rag-observation.store'
import type { RagObservation } from '@/models/rag-observation.model'

function makeObservation(overrides?: Partial<RagObservation>): RagObservation {
  return {
    correlationId: 'correlation-1',
    createdAt: '2026-07-08T12:00:00.000Z',
    data: {
      response: 'answer',
    },
    durationMs: 12,
    eventKey: 'rag.query.completed',
    id: 'observation-1',
    level: 'info',
    message: 'Query completed.',
    operationId: 'operation-1',
    ...overrides,
  }
}

describe('MongoRagObservationStore', () => {
  it('inserts observations into a MongoDB-compatible collection', async () => {
    const inserted: RagObservation[] = []
    const collection: MongoObservationCollection = {
      find: (_filter): ReturnType<MongoObservationCollection['find']> => ({
        limit: (_limit) => collection.find({}),
        sort: (_sort) => collection.find({}),
        toArray: async () => [],
      }),
      insertOne: async (observation): Promise<void> => {
        inserted.push(observation)
      },
    }
    const store = new MongoRagObservationStore(collection)

    await store.append(makeObservation())

    expect(inserted).toEqual([makeObservation()])
  })

  it('queries observations through a MongoDB-compatible cursor', async () => {
    const capturedFilters: MongoObservationFilter[] = []
    const capturedLimits: number[] = []
    const capturedSorts: Record<string, 1 | -1>[] = []
    const collection: MongoObservationCollection = {
      find: (filter): ReturnType<MongoObservationCollection['find']> => {
        capturedFilters.push(filter)

        return {
          limit: (limit): ReturnType<MongoObservationCollection['find']> => {
            capturedLimits.push(limit)
            return collection.find(filter)
          },
          sort: (sort): ReturnType<MongoObservationCollection['find']> => {
            capturedSorts.push(sort)
            return collection.find(filter)
          },
          toArray: async (): Promise<RagObservation[]> => [
            makeObservation({
              eventKey: 'rag.query.llm.completed',
              id: 'observation-3',
            }),
            makeObservation({
              eventKey: 'rag.query.completed',
              id: 'observation-2',
            }),
          ],
        }
      },
      insertOne: async (): Promise<void> => {
        await Promise.resolve()
      },
    }
    const store = new MongoRagObservationStore(collection)

    const page = await store.getObservations({
      eventKeyPrefix: 'rag.query.',
      limit: 1,
      sortDirection: 'desc',
    })

    expect(page.hasMore).toBeTrue()
    expect(page.nextCursor).toBe('observation-3')
    expect(page.observations.map((observation) => observation.id)).toEqual(['observation-3'])
    expect(capturedFilters[0]).toEqual({
      $and: [
        {
          eventKey: {
            $gte: 'rag.query.',
            $lt: 'rag.query.\uffff',
          },
        },
      ],
    })
    expect(capturedLimits).toContain(2)
    expect(capturedSorts).toContainEqual({
      createdAt: -1,
      id: -1,
    })
  })
})
