type RagObservationData = Record<string, unknown>

type RagObservationLevel = 'debug' | 'error' | 'info' | 'warn'

type RagObservationSortDirection = 'asc' | 'desc'

interface RagObservation {
  context?: RagObservationContext
  correlationId: string
  createdAt: string
  data?: RagObservationData
  durationMs?: number
  eventKey: string
  id: string
  level: RagObservationLevel
  message: string
  operationId: string
}

interface RagObservationContext {
  [key: string]: unknown
}

interface RagObservationDataProjectionInput {
  data?: RagObservationData
  eventKey: string
  level: RagObservationLevel
  message: string
}

interface RagObservationInput {
  data?: RagObservationData
  durationMs?: number
  eventKey: string
  level: RagObservationLevel
  message: string
  operationId: string
}

interface RagObservationPage {
  hasMore: boolean
  nextCursor: string | null
  observations: RagObservation[]
}

interface RagObservationQuery {
  correlationId?: string
  cursor?: string
  eventKeyPrefix?: string
  from?: Date | string
  level?: RagObservationLevel
  limit: number
  operationId?: string
  sortDirection: RagObservationSortDirection
  to?: Date | string
}

interface RagObservationSink {
  append(observation: RagObservation): Promise<void>
}

interface RagObservationStore extends RagObservationSink {
  getObservations(query: RagObservationQuery): Promise<RagObservationPage>
}

interface RagObserver {
  debug(eventKey: string, message: string, data?: RagObservationData, durationMs?: number): Promise<void>
  error(eventKey: string, message: string, data?: RagObservationData, durationMs?: number): Promise<void>
  info(eventKey: string, message: string, data?: RagObservationData, durationMs?: number): Promise<void>
  warn(eventKey: string, message: string, data?: RagObservationData, durationMs?: number): Promise<void>
}

type RagObservationDataProjector = (
  input: RagObservationDataProjectionInput
) => RagObservationData | undefined

interface RagObservabilityConfig {
  context?: RagObservationContext
  correlationId?: string
  enabled?: boolean
  includePrompt?: boolean
  includeResponse?: boolean
  includeSources?: boolean
  projectData?: RagObservationDataProjector
  sink?: RagObservationSink | RagObservationSink[]
}

export type {
  RagObservation,
  RagObservationContext,
  RagObservationData,
  RagObservationDataProjectionInput,
  RagObservationDataProjector,
  RagObservationInput,
  RagObservationLevel,
  RagObservationPage,
  RagObservationQuery,
  RagObservationSink,
  RagObservationSortDirection,
  RagObservationStore,
  RagObservabilityConfig,
  RagObserver,
}
