import OpenAI from 'openai'
import type { DocumentChunk } from '@@models/DocumentChunk'
import { TextChunkerResponseValidator } from '@@validators/textChunker.validator'
import { textChunkFunction } from '@@functions/textChunk.function'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

const createPrompt = ((text: string) => (
  `Text to chunk: ${text}\n\n` +
  'Strictly follow this instruction: ' +
  'Split the \'Text to chunk\' into overlapping chunks in recursive pattern then return strictly adhering as JSON array'
))

const normaliseText = ((text: string) => text
  .replace(/[\n.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
  .toLowerCase()
  .replaceAll(/\s+/g, ' '))

async function chunkTextWithLlm(text: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  
  // Split text into sentences on full stops but not if sentence is 
  const recursiveCharacterSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 50,
    chunkOverlap: 25,
  })
  const chunks = await recursiveCharacterSplitter.splitText(normaliseText(text))
  
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    response_format: { type: 'json_object' },
    n: 1,
    tools: [textChunkFunction],
    tool_choice: 'auto',
    messages: [
      { role: 'system', content: 'You process text into chunks for RAG purposes' },
      { role: 'user', content: createPrompt(text) },
    ],
  })
  
  const textChunkFunctionArgs = response.choices[0].message?.tool_calls
    ? JSON.parse(response.choices[0].message.tool_calls[0].function.arguments)
    : []
    
  try {
    const validatedResponse = TextChunkerResponseValidator.parse(
      textChunkFunctionArgs
    ).chunks satisfies DocumentChunk[]
    
    return validatedResponse.map((chunk) => ({
      index: chunk.index,
      text: normaliseText(chunk.text),
      summary: normaliseText(chunk.summary),
    }))
  } catch (error) {
    console.error('Error parsing response:', error)
  }
}

export { chunkTextWithLlm }
