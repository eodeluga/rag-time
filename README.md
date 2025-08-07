
# RAGtime

RAGtime is a lightweight and intuitive Retrieval-Augmented Generation (RAG) framework built for LLM workflows. It supports PDF and raw text embedding, storage, and retrieval using OpenAI embeddings and Qdrant vector search.

Text is automatically chunked and embedded with relevant summaries, and queries return contextually similar results via cosine similarity.

## Features
- 📄 Embed PDFs and raw text content
- ⚙️ Chunking with optional summarisation
- 🧠 Vector embeddings with OpenAI
- 📦 Embedding storage in Qdrant
- 🔍 Querying across single or multiple collections
- 🧪 Tests double as usage examples

## Requirements
- Bun runtime
- Docker + Docker Compose (for Qdrant)
- OpenAI API Key

## Getting Started
1. Install Dependencies
```
bun install
```
2. Setup Qdrant and Run Tests
```
bun run setup
```
This will:
- Build and run Qdrant via Docker Compose
- Run the full test suite to verify embedding/query workflows

## Usage

### Embed a PDF
```ts
import OpenAI from 'openai'
import { EmbeddingProcessingService } from '@@services/EmbeddingProcessing.service'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const embeddingProcessor = new EmbeddingProcessingService(openai)

const { embeddingId } = await embeddingProcessor.embedPDF('path/to/file.pdf')
```

### Embed Raw Text
```ts
const input = [
  'Some historical account...',
  'Details about your hardware...',
]

const { embeddingId } = await embeddingProcessor.embedText(input)
```

### Query a Collection
```ts
import { EmbeddingQueryService } from '@@services/EmbeddingQuery.service'
import { EmbeddingManagementService } from '@@services/EmbeddingManagement.service'

const queryService = new EmbeddingQueryService(
  new EmbeddingManagementService(),
  embeddingProcessor
)

const results = await queryService.query('What year did I get the Amiga 500?', embeddingId!)
console.log(results)
```

### Query Multiple Collections
```ts
const results = await queryService.queryCollections(
  'What GPUs did I use and how is key exchange done?',
  [embeddingId1, embeddingId2],
  2
)

console.log(results)
```

## Environment
Create a `.env` file in your project root with:
```
OPENAI_API_KEY=your-key-here
```

## Tests
Run all tests with:
```
bun test
```

Test files in `spec/` demonstrate full examples of:
- PDF embedding and querying
- Text chunking and embedding
- Multi-document collection search
- Expected RAG-based responses

## License
MIT © Eugene Odeluga
