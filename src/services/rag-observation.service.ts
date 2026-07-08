import { nanoid } from 'nanoid'
import type {
  RagObservation,
  RagObservationData,
  RagObservationInput,
  RagObservationSink,
  RagObservabilityConfig,
  RagObserver,
} from '@/models/rag-observation.model'

type ResolvedRagObservabilityConfig = {
  context: RagObservabilityConfig['context']
  correlationId: string
  enabled: boolean
  includePrompt: boolean
  includeResponse: boolean
  includeSources: boolean
  projectData: RagObservabilityConfig['projectData']
  sinks: RagObservationSink[]
}

class NoOpRagObservationSink implements RagObservationSink {
  async append(): Promise<void> {
    await Promise.resolve()
  }
}

const noopRagObservationSink = new NoOpRagObservationSink()

const appendRagObservationBestEffort = async (
  sink: RagObservationSink,
  observation: RagObservation
): Promise<void> => {
  try {
    await sink.append(observation)
  } catch (error) {
    console.error('[RagObservationService] failed to persist observation', error)
  }
}

const createNoOpRagObserver = (): RagObserver => ({
  debug: async (): Promise<void> => {
    await Promise.resolve()
  },
  error: async (): Promise<void> => {
    await Promise.resolve()
  },
  info: async (): Promise<void> => {
    await Promise.resolve()
  },
  warn: async (): Promise<void> => {
    await Promise.resolve()
  },
})

const normaliseRagObservabilityConfig = (
  config?: RagObservabilityConfig
): ResolvedRagObservabilityConfig => {
  const configuredSinks = config?.sink === undefined
    ? []
    : Array.isArray(config.sink)
      ? config.sink
      : [config.sink]

  return {
    context: config?.context,
    correlationId: config?.correlationId ?? nanoid(),
    enabled: config?.enabled === true,
    includePrompt: config?.includePrompt ?? true,
    includeResponse: config?.includeResponse ?? true,
    includeSources: config?.includeSources ?? true,
    projectData: config?.projectData,
    sinks: configuredSinks,
  }
}

const createRagObservation = (
  config: ResolvedRagObservabilityConfig,
  input: RagObservationInput
): RagObservation => {
  const projectedData = config.projectData === undefined
    ? input.data
    : config.projectData({
      data: input.data,
      eventKey: input.eventKey,
      level: input.level,
      message: input.message,
    })

  return {
    context: config.context,
    correlationId: config.correlationId,
    createdAt: new Date().toISOString(),
    data: projectedData,
    durationMs: input.durationMs,
    eventKey: input.eventKey,
    id: nanoid(),
    level: input.level,
    message: input.message,
    operationId: input.operationId,
  }
}

const createRagObserver = (
  config?: RagObservabilityConfig,
  operationId: string = nanoid()
): RagObserver => {
  const resolvedConfig = normaliseRagObservabilityConfig(config)

  if (!resolvedConfig.enabled || resolvedConfig.sinks.length === 0) {
    return createNoOpRagObserver()
  }

  const observe = async (
    input: Omit<RagObservationInput, 'operationId'>
  ): Promise<void> => {
    const observation = createRagObservation(resolvedConfig, {
      ...input,
      operationId,
    })

    await Promise.all(
      resolvedConfig.sinks.map((sink) =>
        appendRagObservationBestEffort(sink, observation)
      )
    )
  }

  return {
    debug: async (eventKey, message, data, durationMs): Promise<void> => {
      await observe({ data, durationMs, eventKey, level: 'debug', message })
    },
    error: async (eventKey, message, data, durationMs): Promise<void> => {
      await observe({ data, durationMs, eventKey, level: 'error', message })
    },
    info: async (eventKey, message, data, durationMs): Promise<void> => {
      await observe({ data, durationMs, eventKey, level: 'info', message })
    },
    warn: async (eventKey, message, data, durationMs): Promise<void> => {
      await observe({ data, durationMs, eventKey, level: 'warn', message })
    },
  }
}

const buildLlmObservationData = (
  config: ResolvedRagObservabilityConfig,
  data: {
    durationMs: number
    prompt: unknown
    response: string
  }
): RagObservationData => {
  const observationData: RagObservationData = {
    durationMs: data.durationMs,
    responseLength: data.response.length,
  }

  if (config.includePrompt) {
    observationData['prompt'] = data.prompt
  }

  if (config.includeResponse) {
    observationData['response'] = data.response
  }

  return observationData
}

export {
  appendRagObservationBestEffort,
  buildLlmObservationData,
  createRagObserver,
  noopRagObservationSink,
  normaliseRagObservabilityConfig,
  type ResolvedRagObservabilityConfig,
}
