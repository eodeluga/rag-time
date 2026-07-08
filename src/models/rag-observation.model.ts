type RagObservationData = Record<string, unknown>

type RagObservationLevel = 'debug' | 'error' | 'info' | 'warn'

type RagObservationSortDirection = 'asc' | 'desc'

type RagObservationStage =
  | 'chunking'
  | 'embedding'
  | 'ingest'
  | 'llm'
  | 'persistence'
  | 'prompt'
  | 'query'
  | 'rerank'
  | 'retrieval'
  | 'validation'

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
  stage?: RagObservationStage
}

interface RagObservationContext {
  [key: string]: unknown
}

interface RagObservationDataProjectionInput {
  data?: RagObservationData
  eventKey: string
  level: RagObservationLevel
  message: string
  stage?: RagObservationStage
}

interface RagObservationInput {
  data?: RagObservationData
  durationMs?: number
  eventKey: string
  level: RagObservationLevel
  message: string
  operationId: string
  stage?: RagObservationStage
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
  stage?: RagObservationStage
  to?: Date | string
}

interface RagObservationSink {
  append(observation: RagObservation): Promise<void>
}

interface RagObservationStore extends RagObservationSink {
  getObservations(query: RagObservationQuery): Promise<RagObservationPage>
}

interface RagObserver {
  debug(
    eventKey: string,
    message: string,
    data?: RagObservationData,
    durationMs?: number,
    stage?: RagObservationStage
  ): Promise<void>
  error(
    eventKey: string,
    message: string,
    data?: RagObservationData,
    durationMs?: number,
    stage?: RagObservationStage
  ): Promise<void>
  info(
    eventKey: string,
    message: string,
    data?: RagObservationData,
    durationMs?: number,
    stage?: RagObservationStage
  ): Promise<void>
  warn(
    eventKey: string,
    message: string,
    data?: RagObservationData,
    durationMs?: number,
    stage?: RagObservationStage
  ): Promise<void>
}

type RagObservationDataProjector = (
  input: RagObservationDataProjectionInput
) => RagObservationData | undefined

interface RagObservabilityConfig {
  context?: RagObservationContext
  correlationId?: string
  enabled?: boolean
  errorSampleRate?: number
  eventKeys?: string[]
  excludedEventKeys?: string[]
  includePrompt?: boolean
  includeResponse?: boolean
  includeSources?: boolean
  levels?: RagObservationLevel[]
  maxObservationDataSize?: number
  maxPromptLength?: number
  maxResponseLength?: number
  maxSourceTextLength?: number
  projectData?: RagObservationDataProjector
  sink?: RagObservationSink | RagObservationSink[]
  successSampleRate?: number
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
  RagObservationStage,
  RagObservationStore,
  RagObservabilityConfig,
  RagObserver,
}
