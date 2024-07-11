import type { DocumentChunk } from '@@models/DocumentChunk'
import type OpenAI from 'openai'

export class DocumentChunkEmbeddingService {
  private llm: OpenAI
  
  constructor(llm: OpenAI) {
    this.llm = llm
  }
  
  embedText(chunks: DocumentChunk[]) {
    
    const textChunks = chunks.map((chunk) => [chunk.summary, chunk.text])
    return this.llm.embeddings.create({
      model: 'text-davinci-003',
      input: textChunks,
    })
  }
}
