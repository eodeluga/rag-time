# rag-time — Refactor Plan

## Context and Motivation

The current `rag-time` library hard-codes two external dependencies: OpenAI (for LLM and embeddings) and Qdrant (for vector storage). Callers must wire four service classes together manually, there is no answer generation, no conversational memory, and no way to customise the pipeline without large reimplementations.

This refactor introduces three things:

1. **LLM provider abstraction** — `ChatProvider` and `EmbeddingProvider` interfaces decouple all LLM calls from the rest of the library. Three concrete providers ship out of the box: `OpenAIProvider`, `AnthropicProvider`, `GeminiProvider`. All internal code touches only the interfaces.

2. **Vector store abstraction** — a `VectorStore` interface decouples all vector database operations. `QdrantVectorStore` ships as the sole built-in implementation, but the interface is intentionally minimal so any developer can add a new backend (Pinecone, Weaviate, pgvector, etc.) without touching library internals.

3. **`RagPlugin` abstract class** — the single high-level entry point, implementing the Template Method pattern. Every step in the RAG pipeline is a protected hook with a fully working default. A plugin developer extends `RagPlugin`, overrides only what is domain-specific, and inherits everything else: ingestion, retrieval, prompt assembly, token budget management, history compaction, and answer generation.

The existing low-level services remain exported for callers who need direct access. `RagPlugin` uses them internally as the composition root.

---

## Touchpoints

### LLM API Touchpoints

All LLM calls are confined to exactly four locations, which become the provider abstraction boundary:

| File | API call | After refactor |
|---|---|---|
| `src/services/TextChunker.service.ts` | `openai.chat.completions.create()` | `ChatProvider.complete()` |
| `src/services/EmbeddingProcessing.service.ts` | `openai.embeddings.create()` | `EmbeddingProvider.embed()` |
| `src/functions/textChunker.function.ts` | `ChatCompletionTool` type (OpenAI-specific) | **Deleted** — replaced by JSON prompt |
| `src/RagPlugin.ts` *(planned)* | chat completions for answer gen + history compaction | `ChatProvider.complete()` |

The Zod validators import only from `zod` — no LLM provider imports. They are unchanged.

### Vector DB Touchpoints

All Qdrant calls are confined to two locations:

| File | Usage | After refactor |
|---|---|---|
| `src/utils/connectionManager.util.ts` | Qdrant singleton client | **Deleted** — absorbed into `QdrantVectorStore` |
| `src/services/EmbeddingManagement.service.ts` | All Qdrant operations | Delegates to `VectorStore` interface |

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
└───────────┬─────────────────────────────────────┬───────────────┘
            │ uses via interfaces                 │
┌───────────▼───────────────┐      ┌──────────────▼──────────────┐
│     LLM Providers         │      │     Vector Stores           │
│  ChatProvider (interface) │      │  VectorStore (interface)    │
│  EmbeddingProvider (iface)│      │       ▲                     │
│         ▲          ▲      │      │  QdrantVectorStore          │
│  Anthropic  OpenAI Gemini │      │  (only built-in impl)       │
└───────────────────────────┘      └──────────────┬──────────────┘
                                                  │
┌─────────────────────────────────────────────────▼───────────────┐
│                   Existing Services Layer                       │
│  TextChunkerService         (uses ChatProvider)                 │
│  EmbeddingProcessingService (uses EmbeddingProvider)            │
│  EmbeddingManagementService (delegates to VectorStore)          │
│  EmbeddingQueryService      (unchanged — no direct DB access)   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: ingest()

```
ingest(input: string | Buffer, metadata?)
  │
  ├─ Buffer? → pdf-parse → text string
  │
  ├─ this.chunk(text) → Chunk[]               ← overridable hook
  │     default: TextChunkerService → ChatProvider.complete() → JSON parse
  │
  ├─ combine chunk.text + '.' + chunk.summary per chunk
  │
  ├─ EmbeddingProvider.embed() → EmbeddingVector[]
  │
  ├─ EmbeddingManagementService.insertEmbedding()
  │     → VectorStore.insert() with payload { index, text, ...metadata }
  │
  └─ store collectionId on this.embeddingId, return EmbeddingResult
```

### Data Flow: query()

```
query(question, history?)
  │
  ├─ this.expandQuery(question) → string[]    ← hook (default: [question])
  │
  ├─ for each variant:
  │     EmbeddingQueryService → EmbeddingManagementService
  │     → VectorStore.search() → string[]
  │
  ├─ flatten → deduplicateChunks() → take top `limit`
  │
  ├─ this.presentContext(chunks) → context    ← hook
  ├─ this.buildSystemPrompt() → sysPrompt     ← hook
  │
  ├─ countTokens() — over budget? → compactHistory() via ChatProvider
  │
  ├─ assemblePrompt → ChatProvider.complete() → answer
  │
  └─ return RagResponse { answer, sources, history }
```

---

## New Types and Interfaces

### LLM Provider Interfaces

#### `src/providers/ChatProvider.ts`

```typescript
import type { Message } from '@@models/Message'

export interface CompletionOptions {
  temperature?: number
  topP?:        number
  jsonMode?:    boolean  // hint provider to return valid JSON
}

export interface ChatProvider {
  complete(messages: Message[], options?: CompletionOptions): Promise<string>
}
```

#### `src/providers/EmbeddingProvider.ts`

```typescript
export interface EmbeddingVector {
  index:  number
  vector: number[]
}

export interface EmbeddingProvider {
  embed(inputs: string[]): Promise<EmbeddingVector[]>
}
```

### Vector Store Interface

#### `src/stores/VectorStore.ts`

```typescript
export interface VectorPoint {
  id:      number | string
  vector:  number[]
  payload: Record<string, unknown>
}

export interface VectorSearchResult {
  id:      number | string
  score:   number
  payload: Record<string, unknown>
}

export interface VectorStoreInsertResult {
  collectionId: string
  status:       string
}

export interface VectorStore {
  exists(collectionId: string): Promise<boolean>
  insert(collectionId: string, points: VectorPoint[]): Promise<VectorStoreInsertResult>
  search(collectionId: string, queryVector: number[], limit: number): Promise<VectorSearchResult[]>
}
```

The interface is intentionally minimal — `exists` + `insert` + `search` cover all operations the library needs. A custom implementation requires only these three methods.

### New Model Types

#### `src/models/Metadata.ts`
```typescript
export type Metadata = Record<string, string | number | boolean>
```

#### `src/models/Chunk.ts`
```typescript
export interface Chunk<TMetadata = Record<string, unknown>> {
  text:      string
  summary?:  string
  metadata:  TMetadata
}
```
`TextChunk` (`{ text, summary? }`) is **not deleted** — it remains the internal type used by `TextChunkerService`. The base class `chunk()` hook converts `TextChunk[]` to `Chunk[]` by adding `metadata: {}`.

#### `src/models/Message.ts`
```typescript
export interface Message {
  role:    'user' | 'assistant' | 'system'
  content: string
}
```

#### `src/models/RagConfig.ts`
```typescript
import type { ChatProvider }      from '@@providers/ChatProvider'
import type { EmbeddingProvider } from '@@providers/EmbeddingProvider'
import type { VectorStore }       from '@@stores/VectorStore'

export interface RagConfig {
  chatProvider:      ChatProvider
  embeddingProvider: EmbeddingProvider
  vectorStore?:      VectorStore  // default: QdrantVectorStore({ url: qdrant.url ?? env })
  qdrant?: {
    url?: string  // convenience shorthand when relying on the default QdrantVectorStore
  }
  retrieval?: {
    limit?:          number  // top chunks returned to context, default: 5
    candidateLimit?: number  // candidate pool before dedup, default: 20
  }
  tokenBudget?: number  // total token cap for assembled prompt, default: 8000
}
```

Model selection is the provider's responsibility, not `RagConfig`. Pass the model when constructing: `new OpenAIProvider({ apiKey, chatModel: 'gpt-4o' })`.

#### `src/models/RagResponse.ts`
```typescript
import type { Chunk }   from './Chunk'
import type { Message } from './Message'

export interface RagResponse {
  answer:  string
  sources: Chunk[]
  history: Message[]
}
```

---

## Files to Create or Modify

### Step 1 — New model files

Create in this order:

1. `src/models/Metadata.ts`
2. `src/models/Chunk.ts`
3. `src/models/Message.ts`
4. `src/models/RagResponse.ts`

`src/models/RagConfig.ts` is created in Step 4 after provider and store interfaces exist.

---

### Step 2 — Create LLM provider interfaces and implementations

Create `src/providers/` directory, then:

#### `src/providers/ChatProvider.ts` and `src/providers/EmbeddingProvider.ts`
Full content in **LLM Provider Interfaces** section above.

#### `src/providers/OpenAIProvider.ts`

Implements both `ChatProvider` and `EmbeddingProvider`. Uses the existing `openai` package (already in `dependencies`).

```typescript
import OpenAI from 'openai'
import type { ChatProvider, CompletionOptions } from './ChatProvider'
import type { EmbeddingProvider, EmbeddingVector } from './EmbeddingProvider'
import type { Message } from '@@models/Message'

interface OpenAIProviderConfig {
  apiKey:           string
  chatModel?:       string  // default: 'gpt-4o'
  embeddingModel?:  string  // default: 'text-embedding-ada-002'
}

export class OpenAIProvider implements ChatProvider, EmbeddingProvider {
  private client:         OpenAI
  private chatModel:      string
  private embeddingModel: string

  constructor(config: OpenAIProviderConfig) {
    this.client         = new OpenAI({ apiKey: config.apiKey })
    this.chatModel      = config.chatModel      ?? 'gpt-4o'
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-ada-002'
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model:           this.chatModel,
      messages:        messages.map(m => ({ role: m.role, content: m.content })),
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
      index:  item.index,
      vector: item.embedding,
    }))
  }
}
```

#### `src/providers/AnthropicProvider.ts`

Implements `ChatProvider` only. Anthropic does not provide an embeddings API — callers must pair it with `OpenAIProvider` or `GeminiProvider` for embeddings.

New dependency: `@anthropic-ai/sdk` — add to `optionalDependencies` in `package.json`.

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { ChatProvider, CompletionOptions } from './ChatProvider'
import type { Message } from '@@models/Message'

interface AnthropicProviderConfig {
  apiKey:  string
  model?:  string  // default: 'claude-opus-4-6'
}

export class AnthropicProvider implements ChatProvider {
  private client: Anthropic
  private model:  string

  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model  = config.model ?? 'claude-opus-4-6'
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
    const systemContent = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n')

    let conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Anthropic has no native JSON mode — append instruction to last user message
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
}
```

#### `src/providers/GeminiProvider.ts`

Implements both `ChatProvider` and `EmbeddingProvider`.

New dependency: `@google/generative-ai` — add to `optionalDependencies` in `package.json`.

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChatProvider, CompletionOptions } from './ChatProvider'
import type { EmbeddingProvider, EmbeddingVector } from './EmbeddingProvider'
import type { Message } from '@@models/Message'

interface GeminiProviderConfig {
  apiKey:           string
  chatModel?:       string  // default: 'gemini-1.5-pro'
  embeddingModel?:  string  // default: 'text-embedding-004'
}

export class GeminiProvider implements ChatProvider, EmbeddingProvider {
  private client:         GoogleGenerativeAI
  private chatModel:      string
  private embeddingModel: string

  constructor(config: GeminiProviderConfig) {
    this.client         = new GoogleGenerativeAI(config.apiKey)
    this.chatModel      = config.chatModel      ?? 'gemini-1.5-pro'
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-004'
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<string> {
    const model = this.client.getGenerativeModel({
      model:            this.chatModel,
      generationConfig: options?.jsonMode
        ? { responseMimeType: 'application/json' }
        : undefined,
    })

    const systemContent = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n')

    const turns = messages.filter(m => m.role !== 'system')

    // Gemini requires alternating user/model turns
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

### Step 3 — Create vector store interface and Qdrant implementation

Create `src/stores/` directory, then:

#### `src/stores/VectorStore.ts`
Full content in **Vector Store Interface** section above.

#### `src/stores/QdrantVectorStore.ts`

Absorbs all logic from `src/utils/connectionManager.util.ts` and the Qdrant-specific parts of `src/services/EmbeddingManagement.service.ts`. `connectionManager.util.ts` is **deleted** after this step.

```typescript
import { QdrantClient } from '@qdrant/qdrant-js'
import type {
  VectorStore,
  VectorPoint,
  VectorSearchResult,
  VectorStoreInsertResult,
} from './VectorStore'

interface QdrantVectorStoreConfig {
  url?: string  // default: process.env.QDRANT_URL ?? 'http://localhost:6333'
}

export class QdrantVectorStore implements VectorStore {
  private client: QdrantClient

  constructor(config: QdrantVectorStoreConfig = {}) {
    const url = config.url ?? process.env.QDRANT_URL ?? 'http://localhost:6333'
    this.client = new QdrantClient({ url })
  }

  async exists(collectionId: string): Promise<boolean> {
    const { exists } = await this.client.collectionExists(collectionId)
    return exists
  }

  async insert(collectionId: string, points: VectorPoint[]): Promise<VectorStoreInsertResult> {
    await this.client.createCollection(collectionId, {
      vectors: {
        size:     points[0].vector.length,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 2,
    })

    const { status } = await this.client.upsert(collectionId, {
      points: points.map(p => ({
        id:      p.id,
        vector:  p.vector,
        payload: p.payload,
      })),
    })

    return { collectionId, status }
  }

  async search(
    collectionId: string,
    queryVector:  number[],
    limit:        number,
  ): Promise<VectorSearchResult[]> {
    const results = await this.client.search(collectionId, {
      vector: queryVector,
      limit,
    })
    return results.map(r => ({
      id:      r.id as number,
      score:   r.score,
      payload: (r.payload ?? {}) as Record<string, unknown>,
    }))
  }
}
```

---

### Step 4 — Create `src/models/RagConfig.ts`

Full content in **New Model Types** section above. Created after provider and store interfaces exist.

---

### Step 5 — Modify `src/services/EmbeddingManagement.service.ts`

**What changes:** Accepts a `VectorStore` and delegates all operations to it. Becomes a pure adapter between domain types (`TextEmbedding`, `EmbeddingInsertResult`) and the abstract store interface. All Qdrant-specific code is removed — no `QdrantDbConnection` import.

```typescript
import type { VectorStore }           from '@@stores/VectorStore'
import type { TextEmbedding }         from '@@models/TextEmbedding'
import type { Metadata }              from '@@models/Metadata'
import type { EmbeddingInsertResult } from '@@models/EmbeddingInsertResult'

export class EmbeddingManagementService {
  private vectorStore: VectorStore

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore
  }

  async embeddingExists(embeddingId: string): Promise<boolean> {
    return this.vectorStore.exists(embeddingId)
  }

  async insertEmbedding(
    embeddingId:      string,
    textEmbeddingArr: TextEmbedding[],
    metadata?:        Metadata,
  ): Promise<EmbeddingInsertResult> {
    const points = textEmbeddingArr.map(e => ({
      id:      e.index,
      vector:  e.vector,
      payload: { index: e.index, text: e.text, ...(metadata ?? {}) },
    }))
    const result = await this.vectorStore.insert(embeddingId, points)
    return {
      embeddingId: result.collectionId,
      status:      result.status as 'acknowledged' | 'completed',
    }
  }

  async searchByEmbedding(
    collectionId: string,
    opts: { embedding: TextEmbedding; limit: number },
  ): Promise<string[]> {
    const results = await this.vectorStore.search(
      collectionId,
      opts.embedding.vector,
      opts.limit,
    )
    return results.map(r => (r.payload.text as string) ?? '')
  }
}
```

---

### Step 6 — Modify `src/services/EmbeddingProcessing.service.ts`

**What changes:**
- Constructor accepts `EmbeddingProvider` and `EmbeddingManagementService` as injected parameters (no longer self-constructs `EmbeddingManagementService` — it cannot, since that now requires a `VectorStore`)
- `createTextEmbedding` delegates to `EmbeddingProvider.embed()`
- `embedText` gains optional `opts` for `chunkFn` injection and metadata pass-through
- `CreateEmbeddingValidator` usage removed — the provider returns typed data directly

Remove imports: `import type OpenAI from 'openai'`, `import { CreateEmbeddingValidator }...`

Add imports:
```typescript
import type { EmbeddingProvider } from '@@providers/EmbeddingProvider'
import type { Metadata }          from '@@models/Metadata'
```

New constructor:
```typescript
constructor(
  embeddingProvider:          EmbeddingProvider,
  embeddingManagementService: EmbeddingManagementService,
) {
  this.embeddingProvider          = embeddingProvider
  this.embeddingManagementService = embeddingManagementService
}
```

New `createTextEmbedding`:
```typescript
async createTextEmbedding(input: string | string[]): Promise<TextEmbedding[]> {
  const inputs  = Array.isArray(input) ? input : [input]
  const vectors = await this.embeddingProvider.embed(inputs)
  return vectors.map(v => ({
    index:  v.index,
    text:   inputs[v.index],
    vector: v.vector,
  }))
}
```

New `embedText` signature:
```typescript
async embedText(
  text: string | string[],
  opts?: {
    metadata?: Metadata
    chunkFn?:  (text: string) => Promise<TextChunk[]>
  }
): Promise<EmbeddingResult>
```

Inside the `if (!embeddingExists)` block, replace the hardcoded `TextChunkerService` instantiation:
```typescript
// EmbeddingProcessingService holds no ChatProvider, so it cannot construct
// a TextChunkerService itself. The caller (RagPlugin) must always provide chunkFn.
if (!opts?.chunkFn) {
  throw new Error(
    'chunkFn is required. Pass a TextChunkerService.chunk bound method via opts.chunkFn.'
  )
}
const chunkedTexts = await opts.chunkFn(textAsString)
```

Pass metadata to `insertEmbedding`:
```typescript
await this.embeddingManagementService.insertEmbedding(
  hashAsCollectionId,
  textEmbedding,
  opts?.metadata,
)
```

`embedPDF` must also accept and forward `opts` (same signature change as `embedText`):
```typescript
async embedPDF(filePath: string, opts?: { metadata?: Metadata; chunkFn?: ... }): Promise<EmbeddingResult>
```

---

### Step 7 — Modify `src/services/TextChunker.service.ts`

**What changes:** Accept `ChatProvider` instead of `OpenAI`. Replace OpenAI function calling with a JSON prompt that works across all providers. `textChunker.function.ts` is **deleted** — no longer referenced.

```typescript
import type { ChatProvider }    from '@@providers/ChatProvider'
import { TextChunkerValidator } from '@@validators/TextChunker.validator'
import type { TextChunk }       from '@@models/TextChunk'

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
          role:    'system',
          content: 'You are a text chunking assistant. Always respond with valid JSON only.',
        },
        {
          role:    'user',
          content:
            'Split the following text into meaningful chunks for a RAG system. '
            + 'Return a JSON object with this exact structure: '
            + '{"chunks": [{"text": "the chunk text", "summary": "keywords for this chunk"}]}'
            + '\n\nText to chunk:\n' + text,
        },
      ],
      { jsonMode: true, temperature: 0.3 },
    )

    const parsed    = JSON.parse(response)
    const validated = TextChunkerValidator.parse(parsed)

    return validated.chunks.map(chunk => ({
      summary: this.normaliseText(chunk.summary),
      text:    this.normaliseText(chunk.text),
    }))
  }
}
```

---

### Step 8 — Create `src/RagPlugin.ts` and `src/plugins/` directory

`RagPlugin` is the composition root. It constructs and wires all services, manages the full pipeline, and exposes public API + protected hooks.

```typescript
import pdfparse from 'pdf-parse-debugging-disabled'
import { EmbeddingProcessingService } from '@@services/EmbeddingProcessing.service'
import { EmbeddingManagementService } from '@@services/EmbeddingManagement.service'
import { EmbeddingQueryService }      from '@@services/EmbeddingQuery.service'
import { TextChunkerService }         from '@@services/TextChunker.service'
import { QdrantVectorStore }          from '@@stores/QdrantVectorStore'
import type { RagConfig }             from '@@models/RagConfig'
import type { RagResponse }           from '@@models/RagResponse'
import type { Chunk }                 from '@@models/Chunk'
import type { Message }               from '@@models/Message'
import type { Metadata }              from '@@models/Metadata'
import type { EmbeddingResult }       from '@@models/EmbeddingResult'
import type { TextChunk }             from '@@models/TextChunk'
import type { ChatProvider }          from '@@providers/ChatProvider'

export abstract class RagPlugin {
  private chatProvider:               ChatProvider
  private embeddingProcessingService: EmbeddingProcessingService
  private embeddingQueryService:      EmbeddingQueryService
  private textChunkerService:         TextChunkerService

  private readonly retrievalLimit: number
  private readonly candidateLimit: number
  private readonly tokenBudget:    number

  // Set by ingest(); used by query(). One instance = one corpus.
  protected embeddingId: string | null = null

  constructor(config: RagConfig) {
    this.chatProvider   = config.chatProvider
    this.retrievalLimit = config.retrieval?.limit          ?? 5
    this.candidateLimit = config.retrieval?.candidateLimit ?? 20
    this.tokenBudget    = config.tokenBudget               ?? 8000

    const vectorStore            = config.vectorStore ?? new QdrantVectorStore({ url: config.qdrant?.url })
    const embeddingMgmtService   = new EmbeddingManagementService(vectorStore)

    this.textChunkerService         = new TextChunkerService(config.chatProvider)
    this.embeddingProcessingService = new EmbeddingProcessingService(
      config.embeddingProvider,
      embeddingMgmtService,
    )
    this.embeddingQueryService = new EmbeddingQueryService(
      embeddingMgmtService,
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

    const variants   = await this.expandQuery(question)
    const rawResults = await Promise.all(
      variants.map(v => this.embeddingQueryService.query(v, this.embeddingId!, this.candidateLimit))
    )

    const allChunks: Chunk[] = rawResults.flat().map(text => ({ text, metadata: {} }))
    const topChunks = this.deduplicateChunks(allChunks).slice(0, this.retrievalLimit)

    const context      = this.presentContext(topChunks)
    const systemPrompt = this.buildSystemPrompt()

    const baseTokens    = this.countTokens(systemPrompt + context + question)
    const historyBudget = this.tokenBudget - baseTokens
    const compacted     = await this.compactHistory(history, historyBudget)

    const messages = this.assemblePrompt(systemPrompt, context, compacted, question)
    const answer   = await this.chatProvider.complete(messages)

    return {
      answer,
      sources: topChunks,
      history: [...compacted, { role: 'user', content: question }, { role: 'assistant', content: answer }],
    }
  }

  // ── Protected hooks (all have working defaults) ───────────────────────

  protected async chunk(text: string): Promise<Chunk[]> {
    const textChunks = await this.textChunkerService.chunk(text)
    return textChunks.map(tc => ({ text: tc.text, summary: tc.summary, metadata: {} }))
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
    if (this.countTokens(historyText) <= tokenBudget || history.length <= 2) return history

    const midpoint    = Math.floor(history.length / 2)
    const toSummarise = history.slice(0, midpoint)
    const toKeep      = history.slice(midpoint)

    const summary = await this.chatProvider.complete([{
      role:    'user',
      content: `Summarise the following conversation concisely:\n\n${
        toSummarise.map(m => `${m.role}: ${m.content}`).join('\n')
      }`,
    }])

    return [{ role: 'assistant', content: `[Summary]: ${summary}` }, ...toKeep]
  }

  private deduplicateChunks(chunks: Chunk[]): Chunk[] {
    const seen = new Set<string>()
    return chunks.filter(chunk => {
      if (seen.has(chunk.text)) return false
      seen.add(chunk.text)
      return true
    })
  }

  // Approximation: 1 token ≈ 4 characters. No additional dependency required.
  private countTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private assemblePrompt(
    systemPrompt: string,
    context:      string,
    history:      Message[],
    question:     string,
  ): Message[] {
    return [
      { role: 'system', content: `${systemPrompt}\n\nContext:\n${context}` },
      ...history,
      { role: 'user',   content: question },
    ]
  }
}
```

**Known limitation:** `embeddingId` is set by the most recent `ingest()` call — one instance = one corpus. For multi-corpus queries use `EmbeddingQueryService.queryCollections()` directly.

---

### Step 9 — Create `src/plugins/ConversationalRag.ts`

```typescript
import { RagPlugin } from '../RagPlugin'

/**
 * ConversationalRag uses all default RagPlugin behaviours.
 * The recommended starting point for general-purpose conversational RAG.
 */
export class ConversationalRag extends RagPlugin {}
```

---

### Step 10 — Create `src/plugins/DocumentRag.ts`

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

### Step 11 — Update `tsconfig.json`

Add `@@plugins/*`, `@@providers/*`, and `@@stores/*` aliases. Remove the trailing comma after the last existing entry (JSON does not allow trailing commas). Full updated `paths` block:

```json
"paths": {
  "@@functions/*":  ["functions/*"],
  "@@models/*":     ["models/*"],
  "@@plugins/*":    ["plugins/*"],
  "@@providers/*":  ["providers/*"],
  "@@schemas/*":    ["schemas/*"],
  "@@services/*":   ["services/*"],
  "@@stores/*":     ["stores/*"],
  "@@utils/*":      ["utils/*"],
  "@@validators/*": ["validators/*"]
}
```

---

### Step 12 — Create `src/index.ts`

```typescript
// High-level plugin API
export { RagPlugin }         from './RagPlugin'
export { ConversationalRag } from './plugins/ConversationalRag'
export { DocumentRag }       from './plugins/DocumentRag'

// LLM provider interfaces
export type { ChatProvider, CompletionOptions }    from './providers/ChatProvider'
export type { EmbeddingProvider, EmbeddingVector } from './providers/EmbeddingProvider'

// LLM provider implementations
export { OpenAIProvider }    from './providers/OpenAIProvider'
export { AnthropicProvider } from './providers/AnthropicProvider'
export { GeminiProvider }    from './providers/GeminiProvider'

// Vector store interface
export type {
  VectorStore,
  VectorPoint,
  VectorSearchResult,
  VectorStoreInsertResult,
} from './stores/VectorStore'

// Vector store implementation
export { QdrantVectorStore } from './stores/QdrantVectorStore'

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

### Step 13 — Update `package.json`

Add optional dependencies. Callers using only OpenAI + Qdrant do not need these installed.

```json
"optionalDependencies": {
  "@anthropic-ai/sdk":     "^0.54.0",
  "@google/generative-ai": "^0.24.0"
}
```

Verify latest versions at install time.

---

### Step 14 — Delete obsolete files

- `src/functions/textChunker.function.ts` — OpenAI function calling schema; replaced by JSON prompt
- `src/utils/connectionManager.util.ts` — Qdrant singleton logic absorbed into `QdrantVectorStore`

---

### Step 15 — Update existing integration tests

The existing tests (`textEmbeddingAndQuery.spec.ts`, `pdfEmbeddingAndQuery.spec.ts`) directly instantiate `OpenAI` and `EmbeddingManagementService()` with no args. Both must be updated.

Replace the `beforeAll` setup in both files:

```typescript
// Before:
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const embeddingProcessingService = new EmbeddingProcessingService(openai)
embeddingQueryService = new EmbeddingQueryService(
  new EmbeddingManagementService(),
  embeddingProcessingService,
)
;({ embeddingId } = await embeddingProcessingService.embedText(texts))
```

```typescript
// After:
import { OpenAIProvider }    from '@@providers/OpenAIProvider'
import { QdrantVectorStore } from '@@stores/QdrantVectorStore'

const provider       = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
const vectorStore    = new QdrantVectorStore()
const mgmtService    = new EmbeddingManagementService(vectorStore)
const chunkerService = new TextChunkerService(provider)

embeddingProcessingService = new EmbeddingProcessingService(provider, mgmtService)
embeddingQueryService      = new EmbeddingQueryService(mgmtService, embeddingProcessingService)

;({ embeddingId } = await embeddingProcessingService.embedText(texts, {
  chunkFn: (t) => chunkerService.chunk(t),
}))
```

For `embedPDF` calls in `pdfEmbeddingAndQuery.spec.ts`:
```typescript
;({ embeddingId } = await embeddingProcessingService.embedPDF(pdfPath, {
  chunkFn: (t) => chunkerService.chunk(t),
}))
```

---

### Step 16 — Create new integration tests

#### `test/integration/conversationalRag.spec.ts`

```typescript
import dotenv from 'dotenv'
import { beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test'
import { ConversationalRag } from '@@plugins/ConversationalRag'
import { OpenAIProvider }    from '@@providers/OpenAIProvider'
import { QdrantVectorStore } from '@@stores/QdrantVectorStore'
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
      vectorStore:       new QdrantVectorStore(),
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

  it('should return history with user and assistant turns', () => {
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
import { QdrantVectorStore } from '@@stores/QdrantVectorStore'
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
      vectorStore:       new QdrantVectorStore(),
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
| 1  | CREATE | `src/models/Metadata.ts`, `Chunk.ts`, `Message.ts`, `RagResponse.ts` |
| 2  | CREATE | `src/providers/ChatProvider.ts`, `EmbeddingProvider.ts` |
| 2  | CREATE | `src/providers/OpenAIProvider.ts`, `AnthropicProvider.ts`, `GeminiProvider.ts` |
| 3  | CREATE | `src/stores/VectorStore.ts`, `QdrantVectorStore.ts` |
| 4  | CREATE | `src/models/RagConfig.ts` |
| 5  | MODIFY | `src/services/EmbeddingManagement.service.ts` |
| 6  | MODIFY | `src/services/EmbeddingProcessing.service.ts` |
| 7  | MODIFY | `src/services/TextChunker.service.ts` |
| 8  | CREATE | `src/RagPlugin.ts`, `src/plugins/` directory |
| 9  | CREATE | `src/plugins/ConversationalRag.ts` |
| 10 | CREATE | `src/plugins/DocumentRag.ts` |
| 11 | MODIFY | `tsconfig.json` |
| 12 | CREATE | `src/index.ts` |
| 13 | MODIFY | `package.json` |
| 14 | DELETE | `src/functions/textChunker.function.ts`, `src/utils/connectionManager.util.ts` |
| 15 | MODIFY | `test/integration/textEmbeddingAndQuery.spec.ts`, `pdfEmbeddingAndQuery.spec.ts` |
| 16 | CREATE | `test/integration/conversationalRag.spec.ts`, `documentRag.spec.ts` |

Also delete: `IMPLEMENTATION_PLAN.md` (superseded by this document).

---

## Verification

### 1. TypeScript compile check
```bash
bun run tsc --noEmit
```
Expect zero errors. Common failure causes:
- Missing `@@plugins/*`, `@@providers/*`, or `@@stores/*` alias → check Step 11
- `QdrantClient.upsert` status type → cast `result.status` to `'acknowledged' | 'completed'`
- `Buffer.isBuffer` not in scope → add `const { Buffer } = await import('node:buffer')` inside `RagPlugin.ingest()` if needed

### 2. Existing integration tests (updated per Step 15)
```bash
bun run setup   # starts Qdrant via docker-compose, runs all tests
```
Both existing tests must pass after the constructor and `chunkFn` updates.

### 3. New integration tests
```bash
bun test spec
```
Requires Qdrant running and valid `OPENAI_API_KEY` in `.env`.

---

## What NOT to Change

| File | Reason |
|------|--------|
| `src/services/EmbeddingQuery.service.ts` | No LLM or DB calls — uses injected services only; unchanged |
| `src/utils/hashing.util.ts` | No changes needed |
| `src/validators/TextChunker.validator.ts` | Still used in `TextChunkerService` to validate JSON response |
| `src/validators/CreateEmbedding.validator.ts` | No longer used in new flow; harmless to keep |
| `src/validators/TextChunkEmbedding.validator.ts` | No longer used in new flow; harmless to keep |
| `src/models/TextChunk.ts` | Internal chunker type; `Chunk` is additive |
| `src/models/TextEmbedding.ts` | Still used internally by services |
| `src/models/EmbeddingResult.ts` | Return type of `ingest()` |
| `src/models/EmbeddingInsertResult.ts` | No changes needed |
| `test/assets/` | No changes |
| `docker-compose.yml` | No changes |
| `ts-helper-types/` | No changes |

---

## Adding a Custom Vector Store (Developer Reference)

Implement the three-method `VectorStore` interface and pass an instance via `RagConfig.vectorStore`:

```typescript
import type {
  VectorStore,
  VectorPoint,
  VectorSearchResult,
  VectorStoreInsertResult,
} from 'rag-time'

export class PineconeVectorStore implements VectorStore {
  constructor(private config: { apiKey: string; indexName: string }) {}

  async exists(collectionId: string): Promise<boolean> {
    // check if namespace exists in the Pinecone index
  }

  async insert(collectionId: string, points: VectorPoint[]): Promise<VectorStoreInsertResult> {
    // upsert vectors into Pinecone namespace = collectionId
    return { collectionId, status: 'completed' }
  }

  async search(
    collectionId: string,
    queryVector:  number[],
    limit:        number,
  ): Promise<VectorSearchResult[]> {
    // query Pinecone namespace, map results to VectorSearchResult[]
  }
}

const rag = new ConversationalRag({
  chatProvider:      new AnthropicProvider({ apiKey: '...' }),
  embeddingProvider: new OpenAIProvider({ apiKey: '...' }),
  vectorStore:       new PineconeVectorStore({ apiKey: '...', indexName: 'my-index' }),
})
```

---

## Building a Domain Plugin (Developer Reference)

```typescript
import {
  RagPlugin,
  QdrantVectorStore,
  AnthropicProvider,
  OpenAIProvider,
} from 'rag-time'
import type { Chunk } from 'rag-time'

interface LegalMetadata {
  clauseNumber?:   string
  sectionHeading?: string
  pageNumber?:     number
  limitationType?: string
}

export class LegalDocumentRag extends RagPlugin {
  protected async chunk(text: string): Promise<Chunk<LegalMetadata>[]> {
    // Parse numbered/lettered clause structure (1., 1.1, (a), etc.)
    // Detect headings, limitation of liability blocks, break clauses
    // Return chunks with populated LegalMetadata
  }

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

  protected buildSystemPrompt(): string {
    return (
      'You are a legal document analyst specialising in property risk. '
      + 'Answer questions based on the provided clauses. '
      + 'Always cite clause numbers and section headings. '
      + 'Flag any limitations of liability or break clause conditions explicitly.'
    )
  }

  // ingest(), query(), token budget, history compaction — all inherited
}

// Anthropic for reasoning, OpenAI for embeddings (Anthropic has no embeddings API)
const rag = new LegalDocumentRag({
  chatProvider:      new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! }),
  embeddingProvider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! }),
  vectorStore:       new QdrantVectorStore(),
})
```
