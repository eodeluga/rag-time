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
  errorSampleRate: number
  eventKeys: Set<string> | undefined
  excludedEventKeys: Set<string>
  includePrompt: boolean
  includeResponse: boolean
  includeSources: boolean
  levels: Set<string> | undefined
  maxObservationDataSize: number | undefined
  maxPromptLength: number | undefined
  maxResponseLength: number | undefined
  maxSourceTextLength: number | undefined
  projectData: RagObservabilityConfig['projectData']
  sinks: RagObservationSink[]
  successSampleRate: number
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

const clampSampleRate = (sampleRate: number | undefined, fallback: number): number => {
  if (sampleRate === undefined || Number.isNaN(sampleRate)) {
    return fallback
  }

  return Math.min(1, Math.max(0, sampleRate))
}

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
    errorSampleRate: clampSampleRate(config?.errorSampleRate, 1),
    eventKeys: config?.eventKeys === undefined ? undefined : new Set(config.eventKeys),
    excludedEventKeys: new Set(config?.excludedEventKeys ?? []),
    includePrompt: config?.includePrompt ?? true,
    includeResponse: config?.includeResponse ?? true,
    includeSources: config?.includeSources ?? true,
    levels: config?.levels === undefined ? undefined : new Set(config.levels),
    maxObservationDataSize: config?.maxObservationDataSize,
    maxPromptLength: config?.maxPromptLength,
    maxResponseLength: config?.maxResponseLength,
    maxSourceTextLength: config?.maxSourceTextLength,
    projectData: config?.projectData,
    sinks: configuredSinks,
    successSampleRate: clampSampleRate(config?.successSampleRate, 1),
  }
}

const capObservationDataSize = (
  data: RagObservationData | undefined,
  maxObservationDataSize: number | undefined
): RagObservationData | undefined => {
  if (data === undefined || maxObservationDataSize === undefined) {
    return data
  }

  const serialisedData = JSON.stringify(data)

  if (serialisedData.length <= maxObservationDataSize) {
    return data
  }

  return {
    originalSize: serialisedData.length,
    truncated: true,
  }
}

const createRagObservation = (
  config: ResolvedRagObservabilityConfig,
  input: RagObservationInput
): RagObservation => {
  const rawProjectedData = config.projectData === undefined
    ? input.data
    : config.projectData({
      data: input.data,
      eventKey: input.eventKey,
      level: input.level,
      message: input.message,
      stage: input.stage,
    })
  const projectedData = capObservationDataSize(rawProjectedData, config.maxObservationDataSize)

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
    stage: input.stage,
  }
}

const shouldObserve = (
  config: ResolvedRagObservabilityConfig,
  input: Omit<RagObservationInput, 'operationId'>
): boolean => {
  if (!config.enabled || config.sinks.length === 0) {
    return false
  }

  if (config.levels !== undefined && !config.levels.has(input.level)) {
    return false
  }

  if (config.eventKeys !== undefined && !config.eventKeys.has(input.eventKey)) {
    return false
  }

  if (config.excludedEventKeys.has(input.eventKey)) {
    return false
  }

  const sampleRate = input.level === 'error' || input.level === 'warn'
    ? config.errorSampleRate
    : config.successSampleRate

  return sampleRate >= 1 || Math.random() < sampleRate
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
    if (!shouldObserve(resolvedConfig, input)) {
      return
    }

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
    debug: async (eventKey, message, data, durationMs, stage): Promise<void> => {
      await observe({ data, durationMs, eventKey, level: 'debug', message, stage })
    },
    error: async (eventKey, message, data, durationMs, stage): Promise<void> => {
      await observe({ data, durationMs, eventKey, level: 'error', message, stage })
    },
    info: async (eventKey, message, data, durationMs, stage): Promise<void> => {
      await observe({ data, durationMs, eventKey, level: 'info', message, stage })
    },
    warn: async (eventKey, message, data, durationMs, stage): Promise<void> => {
      await observe({ data, durationMs, eventKey, level: 'warn', message, stage })
    },
  }
}

const truncateText = (
  text: string,
  maxLength: number | undefined
): { text: string; truncated: boolean } => {
  if (maxLength === undefined || text.length <= maxLength) {
    return {
      text,
      truncated: false,
    }
  }

  return {
    text: text.slice(0, maxLength),
    truncated: true,
  }
}

const capPrompt = (
  prompt: unknown,
  maxPromptLength: number | undefined
): { prompt: unknown; truncated: boolean } => {
  if (!Array.isArray(prompt)) {
    return {
      prompt,
      truncated: false,
    }
  }

  let truncated = false
  const cappedPrompt = prompt.map((message) => {
    if (
      typeof message !== 'object'
      || message === null
      || !('content' in message)
      || typeof message.content !== 'string'
    ) {
      return message
    }

    const cappedContent = truncateText(message.content, maxPromptLength)
    truncated = truncated || cappedContent.truncated

    return {
      ...message,
      content: cappedContent.text,
    }
  })

  return {
    prompt: cappedPrompt,
    truncated,
  }
}

const buildLlmObservationData = (
  config: ResolvedRagObservabilityConfig,
  data: {
    durationMs: number
    model?: string
    prompt: unknown
    provider?: string
    response: string
    usage?: unknown
  }
): RagObservationData => {
  const cappedResponse = truncateText(data.response, config.maxResponseLength)
  const observationData: RagObservationData = {
    durationMs: data.durationMs,
    responseLength: data.response.length,
  }

  if (data.model !== undefined) {
    observationData['model'] = data.model
  }

  if (data.provider !== undefined) {
    observationData['provider'] = data.provider
  }

  if (data.usage !== undefined) {
    observationData['usage'] = data.usage
  }

  if (config.includePrompt) {
    const cappedPrompt = capPrompt(data.prompt, config.maxPromptLength)

    observationData['prompt'] = cappedPrompt.prompt

    if (cappedPrompt.truncated) {
      observationData['promptTruncated'] = true
    }
  }

  if (config.includeResponse) {
    observationData['response'] = cappedResponse.text

    if (cappedResponse.truncated) {
      observationData['responseTruncated'] = true
    }
  }

  return observationData
}

const buildRetrievalObservationData = (
  config: ResolvedRagObservabilityConfig,
  data: RagObservationData
): RagObservationData => {
  if (!config.includeSources || !Array.isArray(data['sources'])) {
    return data
  }

  let sourcesTruncated = false
  const sources = data['sources'].map((source) => {
    if (
      typeof source !== 'object'
      || source === null
      || !('text' in source)
      || typeof source.text !== 'string'
    ) {
      return source
    }

    const cappedText = truncateText(source.text, config.maxSourceTextLength)
    sourcesTruncated = sourcesTruncated || cappedText.truncated

    return {
      ...source,
      text: cappedText.text,
    }
  })

  return {
    ...data,
    sources,
    sourcesTruncated: sourcesTruncated || undefined,
  }
}

export {
  appendRagObservationBestEffort,
  buildLlmObservationData,
  buildRetrievalObservationData,
  createRagObserver,
  noopRagObservationSink,
  normaliseRagObservabilityConfig,
  type ResolvedRagObservabilityConfig,
}
