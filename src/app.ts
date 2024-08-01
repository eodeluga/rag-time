import dotenv from 'dotenv'
import { TextChunkerService } from '@@services/textChunker.service'
import OpenAI from 'openai'
import { TextChunkEmbeddingService } from '@@services/textChunkEmbedding.service'
import { TextChunkIndexingService } from '@@services/textChunkIndexing.service'
import { PDFChunkerService } from '@@services/pdfChunker.service'

dotenv.config();

(async () => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  
  const textChunkerService = new TextChunkerService(openai)
  const pdfChunkerService = new PDFChunkerService(textChunkerService)
  const pdf = await pdfChunkerService.chunkPdf('docs/CV.pdf')
  console.log(pdf)

  
})()

