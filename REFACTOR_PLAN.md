# rag-time — RagPlugin Architecture Implementation Plan

## Context and Motivation

The current `rag-time` library exposes four separate service classes (`EmbeddingProcessingService`, `EmbeddingManagementService`, `EmbeddingQueryService`, `TextChunkerService`) that callers must wire together manually. There is no answer generation (only chunk retrieval), no conversational memory, no token budget management, and no way to customise the pipeline without reimplementing large sections. All LLM access is hard-coded to OpenAI.

This plan introduces two things:

1. **A provider abstraction layer** — `ChatProvider` and `EmbeddingProvider` interfaces that decouple LLM API calls from the rest of the library. Three concrete implementations are shipped: `OpenAIProvider`, `AnthropicProvider`, and `GeminiProvider`. All internal services and the new `RagPlugin` class use only the interfaces; callers inject whichever provider they need.

2. **A `RagPlugin` abstract class** as the single high-level entry point, implementing the **Template Method pattern**. Every step in the RAG pipeline is a protected hook with a fully working default. A plugin developer extends `RagPlugin`, overrides only what is domain-specific, and inherits everything else — ingestion, retrieval, context assembly, token budget management, history compaction, and answer generation.

The existing low-level services are **not removed**. They remain exported for callers who need raw access. `RagPlugin` uses them internally.

---

## LLM API Touchpoints

All LLM API calls in the codebase flow through exactly four locations, which become the provider abstraction boundary:

| File | API call | Interface used after refactor |
|---|---|---|
| `src/services/TextChunker.service.ts` | `openai.chat.completions.create()` | `ChatProvider.complete()` |
| `src/services/EmbeddingProcessing.service.ts` | `openai.embeddings.create()` | `EmbeddingProvider.embed()` |
| `src/functions/textChunker.function.ts` | `ChatCompletionTool` type (OpenAI-specific schema) | Deleted — replaced by JSON prompt |
| `src/RagPlugin.ts` (planned, not yet written) | `openai.chat.completions.create()` for answer gen + history compaction | `ChatProvider.complete()` |

The Zod validators (`CreateEmbedding.validator.ts`, `TextChunker.validator.ts`, `TextChunkEmbedding.validator.ts`) import only from `zod` — no LLM provider imports. They are unchanged.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Public Surface                          │
│                                                                 │
│  abstract RagPlugin                                             │
│  ┌──────────────────┐   ┌──────────────────────────────────┐    │
│  │  ingest(input)   │   │  query(question, history?)       │    │
│  └────────┬─────────┘   └─────────────┬────────────────────┘    │
│           │                           │                         │
│  Protected Hooks (all have defaults)  │                         │
│  ┌────────▼──────────────────────────▼──────────────────────┐   │
│  │  chunk(text) → Chunk[]                                   │   │
│  │  presentContext(chunks) → string                         │   │
│  │  buildSystemPrompt() → string                            │   │
│  │  expandQuery(query) → string[]                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Private Internals                                              │
│  compactHistory / deduplicateChunks / countTokens               │
│  assemblePrompt                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │ uses via interfaces
       ┌───────────────────────▼─────────────────────────────┐
       │               Provider Interfaces                   │
       │  ChatProvider      EmbeddingProvider                │
       │       ▲                   ▲                         │
       │  ┌────┴────┐    ┌─────────┴──────┐                  │
       │  │Anthropic│    │OpenAI  Gemini  │                  │
       │  │Provider │    │Provider Provider│                  │
       │  └─────────┘    └────────────────┘                  │
       └───────────────────────┬─────────────────────────────┘
                               │ used by
       ┌───────────────────────▼─────────────────────────────┐
       │               Existing Services Layer               │
       │  TextChunkerService     (uses ChatProvider)         │
       │  EmbeddingProcessingService (uses EmbeddingProvider)│
       │  EmbeddingManagementService (Qdrant — unchanged)    │
       │  EmbeddingQueryService  (unchanged)                 │
       └─────────────────────────────────────────────────────┘
```

### Data Flow: ingest()

```
ingest(input: string | Buffer, metadata?)
  │
  ├─ Buffer? → pdf-parse → text string
  │
  ├─ this.chunk(text) → Chunk[]          ← overridable hook
  │     default: TextChunkerService(chatProvider) → JSON prompt → parse
  │
  ├─ combine chunk.text + '.' + chunk.summary per chunk
  │
  ├─ EmbeddingProvider.embed() → EmbeddingVector[]
  │
  ├─ EmbeddingManagementService.insertEmbedding()
  │     payload per point: { index, text, ...metadata }
  │
  └─ store collectionId on this.embeddingId, return EmbeddingResult
```

### Data Flow: query()

```
query(question, history?)
  │
  ├─ this.expandQuery(question) → string[]   ← hook (default: [question])
  │
  ├─ for each variant:
  │     EmbeddingQueryService.query(variant, embeddingId, candidateLimit)
  │
  ├─ flatten → deduplicateChunks() (exact text match) → take top `limit`
  │
  ├─ this.presentContext(chunks) → context  ← hook
  ├─ this.buildSystemPrompt() → sysPrompt  ← hook
  │
  ├─ countTokens(sysPrompt + context + history + question)
  │     over tokenBudget? → compactHistory() via ChatProvider.complete()
  │
  ├─ assemblePrompt → ChatProvider.complete() → answer
  │
  └─ return RagResponse { answer, sources: chunks, history: [...history, user, assistant] }
```

---

## Provider Interfaces

### `src/providers/ChatProvider.ts`

```typescript
import type { Message } from '@@models/Message'

export interface CompletionOptions {
  temperature?: number
  topP?: number
  jsonMode?: boolean   // hint provider to return valid JSON
}

export interface ChatProvider {
  complete(messages: Message[], options?: CompletionOptions): Promise<string>
}
```

### `src/providers/EmbeddingProvider.ts`

```typescript
export interface EmbeddingVector {
  index: number
  vector: number[]
}

export interface EmbeddingProvider {
  embed(inputs: string[]): Promise<EmbeddingVector[]>
}
```

---

## Provider Implementations

### `src/providers/OpenAIProvider.ts`

Implements both `ChatProvider` and `EmbeddingProvider`. Uses the existing `openai` npm package.

```typescript
import OpenAI from 'openai'
import type { ChatProvider, CompletionOptions } from './ChatProvider'
import type { EmbeddingProvider, EmbeddingVector } from './EmbeddingProvider'
import type { Message } from '@@models/Message'

interface OpenAIProviderConfig {
  apiKey: string
  chatModel?: string       // default: 'gpt-4o'
  embeddingModel?: string  // default: 'text-embedding-ada-002'
}

export class OpenAIProvider implements ChatProvider, EmbeddingProvider {
  private client: OpenAI
  private chatModel: string
  private embeddingModel: string

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey })
    this.chatModel      = config.chatModel      ?? 'gpt-4o'
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-ada-002'
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature:     options?.temperature,
      top_p:           options?.topP,
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
    })
    return response.choices[0].message.content ?? ''
  }

  async embed(inputs: string[]): Promise<EmbeddingVector[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: inputs,
    })
    return response.data.map(item => ({
      index: item.index,
      vector: item.embedding,
    }))
  }
}
```

### `src/providers/AnthropicProvider.ts`

Implements `ChatProvider` only. Anthropic does not provide an embeddings API.

New dependency required: `@anthropic-ai/sdk` (add to `optionalDependencies` in `package.json`).

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { ChatProvider, CompletionOptions } from './ChatProvider'
import type { Message } from '@@models/Message'

interface AnthropicProviderConfig {
  apiKey: string
  model?: string   // default: 'claude-opus-4-6'
}

export class AnthropicProvider implements ChatProvider {
  private client: Anthropic
  private model: string

  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model  = config.model ?? 'claude-opus-4-6'
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
    // Anthropic separates system messages from the conversation array
    const systemContent = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n')

    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role:    m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const response = await this.client.messages.create({
      model:      this.model,
      max_tokens: 4096,
      system:     systemContent || undefined,
      messages:   conversationMessages,
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  }
}
```

**Note on JSON mode:** Anthropic does not have a native JSON mode equivalent to OpenAI's `response_format: json_object`. When `jsonMode: true` is requested, the `AnthropicProvider` should append a brief instruction to the last user message: `" Respond with valid JSON only."`. This is handled inside `complete()` by checking `options?.jsonMode` and modifying the last message content before sending.

Updated `complete()` with JSON mode handling:
```typescript
async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
  const systemContent = messages
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n')

  let conversationMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  if (options?.jsonMode && conversationMessages.length > 0) {
    const last = conversationMessages[conversationMessages.length - 1]
    conversationMessages = [
      ...conversationMessages.slice(0, -1),
      { ...last, content: last.content + ' Respond with valid JSON only.' },
    ]
  }

  const response = await this.client.messages.create({
    model:      this.model,
    max_tokens: 4096,
    system:     systemContent || undefined,
    messages:   conversationMessages,
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
```

### `src/providers/GeminiProvider.ts`

Implements both `ChatProvider` and `EmbeddingProvider`.

New dependency required: `@google/generative-ai` (add to `optionalDependencies` in `package.json`).

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChatProvider, CompletionOptions } from './ChatProvider'
import type { EmbeddingProvider, EmbeddingVector } from './EmbeddingProvider'
import type { Message } from '@@models/Message'

interface GeminiProviderConfig {
  apiKey: string
  chatModel?:      string  // default: 'gemini-1.5-pro'
  embeddingModel?: string  // default: 'text-embedding-004'
}

export class GeminiProvider implements ChatProvider, EmbeddingProvider {
  private client: GoogleGenerativeAI
  private chatModel: string
  private embeddingModel: string

  constructor(config: GeminiProviderConfig) {
    this.client         = new GoogleGenerativeAI(config.apiKey)
    this.chatModel      = config.chatModel      ?? 'gemini-1.5-pro'
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-004'
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.chatModel,
      generationConfig: options?.jsonMode
        ? { responseMimeType: 'application/json' }
        : undefined,
    })

    // Gemini separates system instructions and requires alternating user/model turns
    const systemContent = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n')

    const turns = messages.filter(m => m.role !== 'system')

    // History = all turns except the last (which is sent as the new message)
    const history = turns.slice(0, -1).map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const lastMessage = turns[turns.length - 1]
    const prompt = systemContent
      ? `${systemContent}\n\n${lastMessage?.content ?? ''}`
      : (lastMessage?.content ?? '')

    const chat   = model.startChat({ history })
    const result = await chat.sendMessage(prompt)
    return result.response.text()
  }

  async embed(inputs: string[]): Promise<EmbeddingVector[]> {
    const model = this.client.getGenerativeModel({ model: this.embeddingModel })
    return Promise.all(
      inputs.map(async (text, index) => {
        const result = await model.embedContent(text)
        return { index, vector: result.embedding.values }
      })
    )
  }
}
```

---

## New Types and Interfaces

All new model files live in `src/models/`.

### `src/models/Metadata.ts`
```typescript
export type Metadata = Record<string, string | number | boolean>
```

### `src/models/Chunk.ts`
```typescript
export interface Chunk<TMetadata = Record<string, unknown>> {
  text: string
  summary?: string
  metadata: TMetadata
}
```
Note: `Chunk` is additive. The existing `TextChunk` (`{ text, summary? }`) is **not deleted** — it remains the internal type used by `TextChunkerService`. The base class `chunk()` hook converts `TextChunk[]` to `Chunk[]` by adding `metadata: {}`.

### `src/models/Message.ts`
```typescript
export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}
```

### `src/models/RagConfig.ts`
```typescript
import type { ChatProvider }      from '@@providers/ChatProvider'
import type { EmbeddingProvider } from '@@providers/EmbeddingProvider'

export interface RagConfig {
  chatProvider:      ChatProvider
  embeddingProvider: EmbeddingProvider
  qdrant?: {
    url?: string   // default: 'http://localhost:6333'
  }
  retrieval?: {
    limit?:          number  // top chunks returned to context, default: 5
    candidateLimit?: number  // candidate pool before dedup, default: 20
  }
  tokenBudget?: number       // total token cap for assembled prompt, default: 8000
}
```

Note: Model selection is now the responsibility of the provider, not `RagConfig`. Pass the model when constructing the provider: `new OpenAIProvider({ apiKey, chatModel: 'gpt-4o' })`.

### `src/models/RagResponse.ts`
```typescript
import type { Chunk }   from './Chunk'
import type { Message } from './Message'

export interface RagResponse {
  answer:  string
  sources: Chunk[]
  history: Message[]   // updated history including this exchange
}
```

---

## Files to Create or Modify

### Step 1 — New model files

Create in this order (RagConfig imports from providers, so create providers first):

1. `src/models/Metadata.ts`
2. `src/models/Chunk.ts`
3. `src/models/Message.ts`
4. `src/models/RagResponse.ts`

`src/models/RagConfig.ts` is created in Step 3 after the provider interfaces exist.

---

### Step 2 — Create provider interfaces and implementations

Create `src/providers/` directory, then:

#### `src/providers/ChatProvider.ts`
Full content in **Provider Interfaces** section above.

#### `src/providers/EmbeddingProvider.ts`
Full content in **Provider Interfaces** section above.

#### `src/providers/OpenAIProvider.ts`
Full content in **Provider Implementations** section above.

#### `src/providers/AnthropicProvider.ts`
Full content in **Provider Implementations** section above.

#### `src/providers/GeminiProvider.ts`
Full content in **Provider Implementations** section above.

---

### Step 3 — Create `src/models/RagConfig.ts`

Full content in **New Types and Interfaces** section above. Created after provider interfaces exist.

---

### Step 4 — Modify `src/services/TextChunker.service.ts`

**What changes:** Accept `ChatProvider` instead of `OpenAI`. Replace OpenAI function calling with a JSON prompt approach that works across all providers.

The `textChunker.function.ts` file (which defined the OpenAI function calling schema) is **deleted** in this step — it becomes dead code and is no longer referenced.

New full implementation:

```typescript
import type { ChatProvider }         from '@@providers/ChatProvider'
import { TextChunkerValidator }      from '@@validators/TextChunker.validator'
import type { TextChunk }            from '@@models/TextChunk'

export class TextChunkerService {
  private chatProvider: ChatProvider

  private normaliseText = (text: string) => text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  constructor(chatProvider: ChatProvider) {
    this.chatProvider = chatProvider
  }

  async chunk(text: string): Promise<TextChunk[]> {
    const response = await this.chatProvider.complete(
      [
        {
          role: 'system',
          content: 'You are a text chunking assistant. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content:
            'Split the following text into meaningful chunks for a RAG system. '
            + 'Return a JSON object with this exact structure: '
            + '{"chunks": [{"text": "the chunk text", "summary": "keywords for this chunk"}]}'
            + '\n\nText to chunk:\n' + text,
        },
      ],
      { jsonMode: true, temperature: 0.3 },
    )

    const parsed   = JSON.parse(response)
    const validated = TextChunkerValidator.parse(parsed)

    return validated.chunks.map(chunk => ({
      summary: this.normaliseText(chunk.summary),
      text:    this.normaliseText(chunk.text),
    }))
  }
}
```

---

### Step 5 — Modify `src/services/EmbeddingProcessing.service.ts`

**What changes:** Accept `EmbeddingProvider` instead of `OpenAI`. Remove the raw OpenAI embeddings call from `createTextEmbedding` — delegate to the provider. Accept optional `chunkFn` and `metadata` in `embedText` (same as before but now with provider-based signature).

New imports to replace `import type OpenAI from 'openai'`:
```typescript
import type { EmbeddingProvider } from '@@providers/EmbeddingProvider'
import type { Metadata }          from '@@models/Metadata'
```

New constructor signature:
```typescript
constructor(embeddingProvider: EmbeddingProvider) {
  this.embeddingManagementService = new EmbeddingManagementService()
  this.embeddingProvider = embeddingProvider
}
```

New `createTextEmbedding` — delegates entirely to the provider:
```typescript
async createTextEmbedding(input: string | string[]): Promise<TextEmbedding[]> {
  const inputs = Array.isArray(input) ? input : [input]
  const vectors = await this.embeddingProvider.embed(inputs)
  return vectors.map(v => ({
    index:  v.index,
    text:   inputs[v.index],
    vector: v.vector,
  }))
}
```

The `CreateEmbeddingValidator` import and usage in the current `createTextEmbedding` is removed — the provider is trusted to return the correct shape. The validator was guarding against raw OpenAI API response variance; it is no longer needed here.

New `embedText` signature (adds opts for `chunkFn` injection and metadata):
```typescript
async embedText(
  text: string | string[],
  opts?: {
    metadata?: Metadata
    chunkFn?: (text: string) => Promise<TextChunk[]>
  }
): Promise<EmbeddingResult>
```

Inside the `if (!embeddingExists)` block, replace the hardcoded `TextChunkerService` instantiation:
```typescript
// The chunkFn in opts is injected by RagPlugin so it can use its own chunk() hook.
// If not provided, fall back to constructing TextChunkerService — but note:
// TextChunkerService now requires a ChatProvider, so it cannot be constructed here
// without one. EmbeddingProcessingService does not hold a ChatProvider.
// Therefore: when no chunkFn is provided, throw a descriptive error.
const chunkedTexts = opts?.chunkFn
  ? await opts.chunkFn(textAsString)
  : (() => { throw new Error('chunkFn is required — pass a ChatProvider-backed chunker via opts.chunkFn') })()
```

**Important:** The old `EmbeddingProcessingService` could self-contain chunking because it accepted the same `OpenAI` client for both embedding and chunking. With provider separation, embedding and chat are distinct interfaces. `EmbeddingProcessingService` only holds an `EmbeddingProvider` and cannot construct a `TextChunkerService` internally. The caller (i.e., `RagPlugin`) is responsible for wiring chunking, which it does by passing `chunkFn`. The existing integration tests that call `embedText` directly **do not pass a chunkFn** and will fail — see Step 10 for how to update those tests.

Pass metadata to `insertEmbedding` (same as before):
```typescript
await this.embeddingManagementService.insertEmbedding(hashAsCollectionId, textEmbedding, opts?.metadata)
```

---

### Step 6 — Modify `src/services/EmbeddingManagement.service.ts`

**What changes:** `insertEmbedding` must spread arbitrary metadata into each Qdrant point payload. No provider changes — this service is Qdrant-only.

Add import at top:
```typescript
import type { Metadata } from '@@models/Metadata'
```

Change signature:
```typescript
async insertEmbedding(
  embeddingId: string,
  textEmbeddingArr: TextEmbedding[],
  metadata?: Metadata
): Promise<EmbeddingInsertResult>
```

Change the `qdrantPoints` map payload:
```typescript
payload: {
  index: textEmbedding.index,
  text:  textEmbedding.text,
  ...(metadata ?? {}),
},
```

---

### Step 7 — Create `src/plugins/` directory and `src/RagPlugin.ts`

```typescript
import pdfparse from 'pdf-parse-debugging-disabled'
import { EmbeddingProcessingService } from '@@services/EmbeddingProcessing.service'
import { EmbeddingManagementService } from '@@services/EmbeddingManagement.service'
import { EmbeddingQueryService }      from '@@services/EmbeddingQuery.service'
import { TextChunkerService }         from '@@services/TextChunker.service'
import type { RagConfig }             from '@@models/RagConfig'
import type { RagResponse }           from '@@models/RagResponse'
import type { Chunk }                 from '@@models/Chunk'
import type { Message }               from '@@models/Message'
import type { Metadata }              from '@@models/Metadata'
import type { EmbeddingResult }       from '@@models/EmbeddingResult'
import type { TextChunk }             from '@@models/TextChunk'
import type { ChatProvider }          from '@@providers/ChatProvider'
import type { EmbeddingProvider }     from '@@providers/EmbeddingProvider'

export abstract class RagPlugin {
  private chatProvider:              ChatProvider
  private embeddingProvider:         EmbeddingProvider
  private embeddingProcessingService: EmbeddingProcessingService
  private embeddingManagementService: EmbeddingManagementService
  private embeddingQueryService:      EmbeddingQueryService
  private textChunkerService:         TextChunkerService

  private readonly retrievalLimit:  number
  private readonly candidateLimit:  number
  private readonly tokenBudget:     number

  // Set by ingest(); used by query(). One instance = one corpus.
  protected embeddingId: string | null = null

  constructor(config: RagConfig) {
    this.chatProvider      = config.chatProvider
    this.embeddingProvider = config.embeddingProvider

    this.retrievalLimit = config.retrieval?.limit          ?? 5
    this.candidateLimit = config.retrieval?.candidateLimit ?? 20
    this.tokenBudget    = config.tokenBudget               ?? 8000

    if (config.qdrant?.url) {
      process.env.QDRANT_URL = config.qdrant.url
    }

    this.textChunkerService         = new TextChunkerService(this.chatProvider)
    this.embeddingManagementService = new EmbeddingManagementService()
    this.embeddingProcessingService = new EmbeddingProcessingService(this.embeddingProvider)
    this.embeddingQueryService      = new EmbeddingQueryService(
      this.embeddingManagementService,
      this.embeddingProcessingService,
    )
  }

  // ── Public API ────────────────────────────────────────────────────────

  async ingest(input: string | Buffer, metadata?: Metadata): Promise<EmbeddingResult> {
    let text: string

    if (Buffer.isBuffer(input)) {
      const { text: parsedText } = await pdfparse(input)
      text = parsedText
    } else {
      text = input
    }

    // Bridge: chunk() returns Chunk[], but embedText expects TextChunk[]
    const chunkFn = async (t: string): Promise<TextChunk[]> => {
      const chunks = await this.chunk(t)
      return chunks.map(c => ({ text: c.text, summary: c.summary }))
    }

    const result = await this.embeddingProcessingService.embedText(text, { metadata, chunkFn })
    this.embeddingId = result.embeddingId
    return result
  }

  async query(question: string, history: Message[] = []): Promise<RagResponse> {
    if (!this.embeddingId) {
      throw new Error('No content has been ingested. Call ingest() before query().')
    }

    // 1. Expand query (default: [question])
    const variants = await this.expandQuery(question)

    // 2. Retrieve candidateLimit chunks per variant
    const rawResults = await Promise.all(
      variants.map(v => this.embeddingQueryService.query(v, this.embeddingId!, this.candidateLimit))
    )

    // 3. Deduplicate and take top `limit`
    const allChunks: Chunk[] = rawResults.flat().map(text => ({ text, metadata: {} }))
    const topChunks = this.deduplicateChunks(allChunks).slice(0, this.retrievalLimit)

    // 4. Format context and system prompt via overridable hooks
    const context      = this.presentContext(topChunks)
    const systemPrompt = this.buildSystemPrompt()

    // 5. Token budget: compact history if needed
    const baseTokens    = this.countTokens(systemPrompt + context + question)
    const historyBudget = this.tokenBudget - baseTokens
    const compacted     = await this.compactHistory(history, historyBudget)

    // 6. Call LLM for answer
    const messages = this.assemblePrompt(systemPrompt, context, compacted, question)
    const answer   = await this.chatProvider.complete(messages)

    const updatedHistory: Message[] = [
      ...compacted,
      { role: 'user',      content: question },
      { role: 'assistant', content: answer   },
    ]

    return { answer, sources: topChunks, history: updatedHistory }
  }

  // ── Protected hooks (all have working defaults) ───────────────────────

  protected async chunk(text: string): Promise<Chunk[]> {
    const textChunks = await this.textChunkerService.chunk(text)
    return textChunks.map(tc => ({
      text:     tc.text,
      summary:  tc.summary,
      metadata: {},
    }))
  }

  protected presentContext(chunks: Chunk[]): string {
    return chunks.map((chunk, i) => `[${i + 1}] ${chunk.text}`).join('\n\n')
  }

  protected buildSystemPrompt(): string {
    return "You are a helpful assistant. Answer the user's question based on the provided context."
  }

  protected async expandQuery(query: string): Promise<string[]> {
    return [query]
  }

  // ── Private internals ─────────────────────────────────────────────────

  private async compactHistory(history: Message[], tokenBudget: number): Promise<Message[]> {
    const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n')
    if (this.countTokens(historyText) <= tokenBudget || history.length <= 2) {
      return history
    }

    const midpoint    = Math.floor(history.length / 2)
    const toSummarise = history.slice(0, midpoint)
    const toKeep      = history.slice(midpoint)

    const summaryText = toSummarise.map(m => `${m.role}: ${m.content}`).join('\n')
    const summary     = await this.chatProvider.complete([{
      role:    'user',
      content: `Summarise the following conversation concisely:\n\n${summaryText}`,
    }])

    return [
      { role: 'assistant', content: `[Summary]: ${summary}` },
      ...toKeep,
    ]
  }

  private deduplicateChunks(chunks: Chunk[]): Chunk[] {
    const seen = new Set<string>()
    return chunks.filter(chunk => {
      if (seen.has(chunk.text)) return false
      seen.add(chunk.text)
      return true
    })
  }

  // Approximation: 1 token ≈ 4 characters. No additional dependency needed.
  private countTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private assemblePrompt(
    systemPrompt: string,
    context: string,
    history: Message[],
    question: string,
  ): Message[] {
    return [
      { role: 'system', content: `${systemPrompt}\n\nContext:\n${context}` },
      ...history,
      { role: 'user',   content: question },
    ]
  }
}
```

**Known limitation:** `RagPlugin` stores `embeddingId` from the most recent `ingest()` call. A single instance is scoped to one corpus. For multi-corpus queries use the lower-level `EmbeddingQueryService.queryCollections()` directly.

**Known limitation:** Setting `process.env.QDRANT_URL` in the constructor is a side effect. Since `QdrantDbConnection` is a singleton, the first `RagPlugin` constructed in a process wins for the Qdrant URL. This is an existing architectural constraint of the connection manager and is out of scope for this refactoring.

---

### Step 8 — Create `src/plugins/ConversationalRag.ts`

```typescript
import { RagPlugin } from '../RagPlugin'

/**
 * ConversationalRag uses all default RagPlugin behaviours.
 * It is the recommended starting point for general-purpose conversational RAG.
 */
export class ConversationalRag extends RagPlugin {}
```

---

### Step 9 — Create `src/plugins/DocumentRag.ts`

```typescript
import { RagPlugin } from '../RagPlugin'
import type { Chunk } from '../models/Chunk'

/**
 * DocumentRag is tuned for document Q&A.
 * Formats context as numbered sources and instructs the LLM to cite them.
 */
export class DocumentRag extends RagPlugin {
  protected presentContext(chunks: Chunk[]): string {
    return chunks.map((chunk, i) => `Source [${i + 1}]: ${chunk.text}`).join('\n\n')
  }

  protected buildSystemPrompt(): string {
    return (
      'You are a document assistant. Answer questions based solely on the provided sources. '
      + 'Always cite the source number(s) supporting your answer, e.g. [1], [2].'
    )
  }
}
```

---

### Step 10 — Update `tsconfig.json`

Add `"@@plugins/*"` and `"@@providers/*"` path aliases. Remove trailing comma from last entry (JSON does not allow trailing commas). Full updated `paths` block:

```json
"paths": {
  "@@functions/*":  ["functions/*"],
  "@@models/*":     ["models/*"],
  "@@plugins/*":    ["plugins/*"],
  "@@providers/*":  ["providers/*"],
  "@@schemas/*":    ["schemas/*"],
  "@@services/*":   ["services/*"],
  "@@utils/*":      ["utils/*"],
  "@@validators/*": ["validators/*"]
}
```

---

### Step 11 — Create `src/index.ts`

```typescript
// High-level plugin API
export { RagPlugin }         from './RagPlugin'
export { ConversationalRag } from './plugins/ConversationalRag'
export { DocumentRag }       from './plugins/DocumentRag'

// Provider interfaces
export type { ChatProvider, CompletionOptions } from './providers/ChatProvider'
export type { EmbeddingProvider, EmbeddingVector } from './providers/EmbeddingProvider'

// Provider implementations
export { OpenAIProvider }    from './providers/OpenAIProvider'
export { AnthropicProvider } from './providers/AnthropicProvider'
export { GeminiProvider }    from './providers/GeminiProvider'

// Existing low-level services (preserved for direct access)
export { EmbeddingProcessingService } from './services/EmbeddingProcessing.service'
export { EmbeddingManagementService } from './services/EmbeddingManagement.service'
export { EmbeddingQueryService }      from './services/EmbeddingQuery.service'
export { TextChunkerService }         from './services/TextChunker.service'

// New models
export type { RagConfig }   from './models/RagConfig'
export type { RagResponse } from './models/RagResponse'
export type { Chunk }       from './models/Chunk'
export type { Message }     from './models/Message'
export type { Metadata }    from './models/Metadata'

// Existing models
export type { EmbeddingResult }       from './models/EmbeddingResult'
export type { EmbeddingInsertResult } from './models/EmbeddingInsertResult'
export type { TextChunk }             from './models/TextChunk'
export type { TextEmbedding }         from './models/TextEmbedding'
```

---

### Step 12 — Update `package.json`

Add optional dependencies for Anthropic and Gemini SDKs. Callers who only use OpenAI do not need these installed.

```json
"optionalDependencies": {
  "@anthropic-ai/sdk": "^0.54.0",
  "@google/generative-ai": "^0.24.0"
}
```

Verify the latest versions of both packages at install time.

---

### Step 13 — Delete `src/functions/textChunker.function.ts`

This file defined the OpenAI function calling schema for `TextChunkerService`. It is no longer used — `TextChunkerService` now uses a JSON prompt approach compatible with all providers. Delete it.

---

### Step 14 — Update existing integration tests

The existing tests (`textEmbeddingAndQuery.spec.ts`, `pdfEmbeddingAndQuery.spec.ts`) directly instantiate `OpenAI` and pass it to `EmbeddingProcessingService`. Both must be updated to use `OpenAIProvider` instead.

**In both test files**, replace:

```typescript
// Before:
import OpenAI from 'openai'
// ...
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const embeddingProcessingService = new EmbeddingProcessingService(openai)
```

```typescript
// After:
import { OpenAIProvider } from '@@providers/OpenAIProvider'
// ...
const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
const embeddingProcessingService = new EmbeddingProcessingService(provider)
```

**Important:** These tests also call `embeddingProcessingService.embedText(texts)` without a `chunkFn`. Since `EmbeddingProcessingService` can no longer self-construct a `TextChunkerService` (it no longer holds a `ChatProvider`), these calls will now throw unless a `chunkFn` is passed. Update the test `beforeAll` blocks to also pass a chunker:

```typescript
const chatProvider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
const provider     = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
const chunkerService = new TextChunkerService(chatProvider)

const embeddingProcessingService = new EmbeddingProcessingService(provider)

// When calling embedText directly, pass the chunkFn:
const { embeddingId } = await embeddingProcessingService.embedText(texts, {
  chunkFn: (t) => chunkerService.chunk(t),
})
```

---

### Step 15 — Create new integration tests

#### `test/integration/conversationalRag.spec.ts`

```typescript
import dotenv from 'dotenv'
import { beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test'
import { ConversationalRag } from '@@plugins/ConversationalRag'
import { OpenAIProvider }    from '@@providers/OpenAIProvider'
import type { RagResponse }  from '@@models/RagResponse'

describe('ConversationalRag — end-to-end ingest and query', async function () {
  setDefaultTimeout(120000)
  dotenv.config()

  let rag: ConversationalRag
  let response: RagResponse

  const text = [
    'The Battle of Hastings took place in 1066.',
    'William the Conqueror defeated King Harold at the Battle of Hastings.',
    'The Norman conquest of England changed the English language profoundly.',
  ].join('\n')

  beforeAll(async () => {
    const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
    rag = new ConversationalRag({
      chatProvider:      provider,
      embeddingProvider: provider,
    })
    const result = await rag.ingest(text)
    if (!result.embeddingId) throw new Error('Ingest failed')
    response = await rag.query('Who defeated King Harold?')
  })

  it('should return an answer string', () => {
    expect(typeof response.answer).toBe('string')
    expect(response.answer.length).toBeGreaterThan(0)
  })

  it('should include source chunks', () => {
    expect(response.sources.length).toBeGreaterThan(0)
  })

  it('should return history containing user and assistant turns', () => {
    expect(response.history.some(m => m.role === 'user')).toBeTrue()
    expect(response.history.some(m => m.role === 'assistant')).toBeTrue()
  })

  it('should carry history across a follow-up query', async () => {
    const followUp = await rag.query('What year did that battle happen?', response.history)
    expect(followUp.answer).toInclude('1066')
  })
})
```

#### `test/integration/documentRag.spec.ts`

```typescript
import dotenv from 'dotenv'
import { readFileSync }      from 'fs'
import { beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test'
import { DocumentRag }       from '@@plugins/DocumentRag'
import { OpenAIProvider }    from '@@providers/OpenAIProvider'
import type { RagResponse }  from '@@models/RagResponse'

describe('DocumentRag — PDF ingest and source-cited query', async function () {
  setDefaultTimeout(120000)
  dotenv.config()

  let rag: DocumentRag
  let response: RagResponse

  beforeAll(async () => {
    const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
    rag = new DocumentRag({
      chatProvider:      provider,
      embeddingProvider: provider,
    })
    const pdfBuffer = readFileSync('test/assets/Sample.pdf')
    const result    = await rag.ingest(pdfBuffer)
    if (!result.embeddingId) throw new Error('PDF ingest failed')
    response = await rag.query('What year did I get the Amiga 500?')
  })

  it('should return an answer referencing 1991', () => {
    expect(response.answer).toInclude('1991')
  })

  it('should include source chunks with metadata', () => {
    expect(response.sources.length).toBeGreaterThan(0)
    expect(response.sources[0]).toHaveProperty('text')
    expect(response.sources[0]).toHaveProperty('metadata')
  })

  it('should include source citation markers in the answer', () => {
    expect(response.answer).toMatch(/\[\d+\]/)
  })
})
```

---

## Implementation Order Summary

| Step | Action | File(s) |
|------|--------|---------|
| 1 | CREATE | `src/models/Metadata.ts`, `Chunk.ts`, `Message.ts`, `RagResponse.ts` |
| 2 | CREATE | `src/providers/ChatProvider.ts`, `EmbeddingProvider.ts` |
| 2 | CREATE | `src/providers/OpenAIProvider.ts`, `AnthropicProvider.ts`, `GeminiProvider.ts` |
| 3 | CREATE | `src/models/RagConfig.ts` |
| 4 | MODIFY | `src/services/TextChunker.service.ts` |
| 5 | MODIFY | `src/services/EmbeddingProcessing.service.ts` |
| 6 | MODIFY | `src/services/EmbeddingManagement.service.ts` |
| 7 | CREATE | `src/RagPlugin.ts`, `src/plugins/` directory |
| 8 | CREATE | `src/plugins/ConversationalRag.ts` |
| 9 | CREATE | `src/plugins/DocumentRag.ts` |
| 10 | MODIFY | `tsconfig.json` |
| 11 | CREATE | `src/index.ts` |
| 12 | MODIFY | `package.json` |
| 13 | DELETE | `src/functions/textChunker.function.ts` |
| 14 | MODIFY | `test/integration/textEmbeddingAndQuery.spec.ts`, `pdfEmbeddingAndQuery.spec.ts` |
| 15 | CREATE | `test/integration/conversationalRag.spec.ts`, `documentRag.spec.ts` |

---

## Verification

### 1. TypeScript compile check
```bash
bun run tsc --noEmit
```
Expect zero errors. Common failure causes:
- Missing `@@plugins/*` or `@@providers/*` alias → check Step 10
- `AnthropicProvider` or `GeminiProvider` type errors if optional packages not installed → install them or exclude from compile with conditional imports
- `assemblePrompt` returns `Message[]` — ensure `chatProvider.complete()` accepts `Message[]` not `ChatCompletionMessageParam[]`

### 2. Existing integration tests (updated per Step 14)
```bash
bun run setup   # starts Qdrant via docker-compose, runs all tests
```
`textEmbeddingAndQuery.spec.ts` and `pdfEmbeddingAndQuery.spec.ts` must still pass after the constructor and `chunkFn` updates.

### 3. New integration tests
```bash
bun test spec
```
Requires Qdrant running and valid `OPENAI_API_KEY` in `.env`.

---

## What NOT to Change

| File | Reason |
|------|--------|
| `src/services/EmbeddingQuery.service.ts` | No LLM calls; unchanged |
| `src/utils/connectionManager.util.ts` | Qdrant singleton; unchanged |
| `src/utils/hashing.util.ts` | No changes needed |
| `src/validators/TextChunker.validator.ts` | Still used in `TextChunkerService` to validate JSON response |
| `src/validators/CreateEmbedding.validator.ts` | Can be kept (no longer used in the new flow but not harmful) |
| `src/validators/TextChunkEmbedding.validator.ts` | Can be kept |
| `src/models/TextChunk.ts` | Internal chunker type; `Chunk` is additive |
| `src/models/TextEmbedding.ts` | Still used internally by services |
| `src/models/EmbeddingResult.ts` | Reused as return type of `ingest()` |
| `src/models/EmbeddingInsertResult.ts` | No changes needed |
| `test/assets/` | No changes |
| `docker-compose.yml` | No changes |
| `ts-helper-types/` | No changes |

---

## Building a Domain Plugin (Reference)

A domain-specific plugin (e.g. `LegalDocumentRag` for a property risk use case) lives in a separate package. It extends `RagPlugin` with domain-specific hooks and inherits everything else.

```typescript
import { RagPlugin } from 'rag-time'
import type { Chunk } from 'rag-time'

interface LegalMetadata {
  clauseNumber?:   string
  sectionHeading?: string
  pageNumber?:     number
  documentType?:   string
  limitationType?: string
}

export class LegalDocumentRag extends RagPlugin {
  // Override: clause-boundary aware chunking
  protected async chunk(text: string): Promise<Chunk<LegalMetadata>[]> {
    // Parse numbered/lettered clause structure (1., 1.1, (a), etc.)
    // Detect headings, limitation of liability blocks, break clauses
    // Return chunks with populated LegalMetadata
  }

  // Override: citation-first context — clause + heading + page
  protected presentContext(chunks: Chunk<LegalMetadata>[]): string {
    return chunks.map((chunk, i) => {
      const ref = [
        chunk.metadata.clauseNumber,
        chunk.metadata.sectionHeading,
        chunk.metadata.pageNumber ? `p.${chunk.metadata.pageNumber}` : null,
      ].filter(Boolean).join(' · ')
      return `[${i + 1}] ${ref}\n${chunk.text}`
    }).join('\n\n')
  }

  // Override: legal analysis system prompt
  protected buildSystemPrompt(): string {
    return (
      'You are a legal document analyst specialising in property risk. '
      + 'Answer questions based on the provided clauses. '
      + 'Always cite clause numbers and section headings. '
      + 'Flag any limitations of liability or break clause conditions explicitly.'
    )
  }

  // Override: expand legal query terms
  protected async expandQuery(query: string): Promise<string[]> {
    // e.g. "termination rights" → ["termination", "right to terminate", "notice period"]
    return [query]  // implement with domain term dictionary or LLM call
  }

  // ingest(), query(), token budget, history compaction — all inherited, fully working
}
```

The provider is injected at construction time:
```typescript
const anthropic = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
const openai    = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })

const rag = new LegalDocumentRag({
  chatProvider:      anthropic,  // Claude for legal reasoning
  embeddingProvider: openai,     // OpenAI for embeddings (Anthropic has no embeddings API)
})
```
