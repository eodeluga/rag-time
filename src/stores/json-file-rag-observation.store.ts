import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  RagObservation,
  RagObservationPage,
  RagObservationQuery,
  RagObservationStore,
} from '@/models/rag-observation.model'

type JsonFileRagObservationStoreConfig = {
  filePath: string
}

/**
 * Persists observation events to a local JSON file.
 *
 * The file is maintained as a JSON array to keep it directly inspectable and easy
 * to import into downstream evaluation tooling.
 */
export class JsonFileRagObservationStore implements RagObservationStore {
  private filePath: string

  constructor(config: JsonFileRagObservationStoreConfig) {
    this.filePath = config.filePath
  }

  private async readObservations(): Promise<RagObservation[]> {
    try {
      const fileContent = await readFile(this.filePath, 'utf8')
      const parsedContent: unknown = JSON.parse(fileContent)

      return Array.isArray(parsedContent)
        ? parsedContent.filter((item): item is RagObservation =>
          typeof item === 'object' && item !== null
        )
        : []
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return []
      }

      throw error
    }
  }

  async append(observation: RagObservation): Promise<void> {
    const observations = await this.readObservations()

    observations.push(observation)

    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, `${JSON.stringify(observations, null, 2)}\n`, 'utf8')
  }

  async getObservations(query: RagObservationQuery): Promise<RagObservationPage> {
    const observations = await this.readObservations()
    const from = query.from === undefined ? undefined : new Date(query.from).getTime()
    const to = query.to === undefined ? undefined : new Date(query.to).getTime()
    const filteredObservations = observations.filter((observation) => {
      const createdAt = new Date(observation.createdAt).getTime()

      if (query.correlationId !== undefined && observation.correlationId !== query.correlationId) {
        return false
      }

      if (query.eventKeyPrefix !== undefined && !observation.eventKey.startsWith(query.eventKeyPrefix)) {
        return false
      }

      if (query.level !== undefined && observation.level !== query.level) {
        return false
      }

      if (query.operationId !== undefined && observation.operationId !== query.operationId) {
        return false
      }

      if (from !== undefined && createdAt < from) {
        return false
      }

      if (to !== undefined && createdAt > to) {
        return false
      }

      return true
    })

    const sortedObservations = filteredObservations.sort((firstObservation, secondObservation) => {
      const firstTime = new Date(firstObservation.createdAt).getTime()
      const secondTime = new Date(secondObservation.createdAt).getTime()

      if (firstTime !== secondTime) {
        return query.sortDirection === 'desc'
          ? secondTime - firstTime
          : firstTime - secondTime
      }

      return query.sortDirection === 'desc'
        ? secondObservation.id.localeCompare(firstObservation.id)
        : firstObservation.id.localeCompare(secondObservation.id)
    })
    const cursorIndex = query.cursor === undefined
      ? -1
      : sortedObservations.findIndex((observation) => observation.id === query.cursor)
    const startIndex = cursorIndex < 0 ? 0 : cursorIndex + 1
    const pagedObservations = sortedObservations.slice(startIndex, startIndex + query.limit)
    const hasMore = sortedObservations.length > startIndex + query.limit
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
  JsonFileRagObservationStoreConfig,
}
