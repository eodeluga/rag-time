import { describe, expect, it } from 'bun:test'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { JsonFileRagObservationStore } from '@/stores/json-file-rag-observation.store'
import type { RagObservation } from '@/models/rag-observation.model'

const observationFilePath = join(process.cwd(), '.agents', 'test-observability', 'observations.json')

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

describe('JsonFileRagObservationStore', () => {
  it('appends observations to a JSON array file', async () => {
    await rm(join(process.cwd(), '.agents', 'test-observability'), { force: true, recursive: true })
    await mkdir(join(process.cwd(), '.agents', 'test-observability'), { recursive: true })

    const store = new JsonFileRagObservationStore({ filePath: observationFilePath })

    await store.append(makeObservation())
    await store.append(makeObservation({
      eventKey: 'rag.query.llm.completed',
      id: 'observation-2',
    }))

    const persisted = JSON.parse(await readFile(observationFilePath, 'utf8'))

    expect(persisted).toEqual([
      makeObservation(),
      makeObservation({
        eventKey: 'rag.query.llm.completed',
        id: 'observation-2',
      }),
    ])

    await rm(join(process.cwd(), '.agents', 'test-observability'), { force: true, recursive: true })
  })

  it('queries observations by event key prefix and sort direction', async () => {
    await rm(join(process.cwd(), '.agents', 'test-observability'), { force: true, recursive: true })
    await mkdir(join(process.cwd(), '.agents', 'test-observability'), { recursive: true })

    const store = new JsonFileRagObservationStore({ filePath: observationFilePath })

    await store.append(makeObservation({
      createdAt: '2026-07-08T12:00:00.000Z',
      eventKey: 'rag.ingest.completed',
      id: 'observation-1',
    }))
    await store.append(makeObservation({
      createdAt: '2026-07-08T12:01:00.000Z',
      eventKey: 'rag.query.completed',
      id: 'observation-2',
    }))
    await store.append(makeObservation({
      createdAt: '2026-07-08T12:02:00.000Z',
      eventKey: 'rag.query.llm.completed',
      id: 'observation-3',
    }))

    const page = await store.getObservations({
      eventKeyPrefix: 'rag.query.',
      limit: 1,
      sortDirection: 'desc',
    })

    expect(page.hasMore).toBeTrue()
    expect(page.nextCursor).toBe('observation-3')
    expect(page.observations.map((observation) => observation.id)).toEqual(['observation-3'])

    await rm(join(process.cwd(), '.agents', 'test-observability'), { force: true, recursive: true })
  })
})
