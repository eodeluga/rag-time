import type { TextEmbedding } from '@@models/TextEmbedding'
import { LlmEmbeddingValidator } from '@@validators/llmEmbedding.validator'
import type OpenAI from 'openai'
import { encode } from 'gpt-3-encoder'
import { env, pipeline } from '@xenova/transformers'

export class TextEmbeddingService {
  private llm: OpenAI
  
  constructor(llm: OpenAI) {
    this.llm = llm
    // env.allowRemoteModels = true
    env.localModelPath = 'models'
    env.allowLocalModels = true
  }
  
  async embedSentences(sentences: string[]) {
    const response = await this.llm.embeddings.create({
      model: 'text-embedding-ada-002',
      input: sentences,
    })
    
    return LlmEmbeddingValidator.parse(response?.data)
      .map((llmEmbedding, i) => ({
        index: llmEmbedding.index,
        text: sentences[i],
        embedding: llmEmbedding.embedding,
      })) satisfies TextEmbedding[]
  }
  
  // Use gt-3-encoder library to embed sentences
  async gpt3EmbedSentences(sentences: string[]) {
    return sentences.map((sentence, i) => ({
      index: i,
      text: sentence,
      embedding: encode(sentence),
    })) satisfies TextEmbedding[]
  }
  
  async transformersEmbedSentences(sentences: string[]) {
    const pipe = await pipeline('embeddings', 'jina-embeddings-v2-base-en', {
      // model_file_name: 'model.onnx',
      local_files_only: true,
    })
    const embeddingsPromises = sentences.map((sentence) => pipe(sentence))
    const embeddings = await Promise.all(embeddingsPromises)
    
    //console.log(embeddings.data as Float32Array[])
    return sentences.map((sentence, i) => ({
      index: i,
      text: sentence,
      embedding: embeddings[i].data,
    }))
  }
}
