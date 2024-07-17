import OpenAI from 'openai'
import type { DocumentChunk } from '@@models/DocumentChunk'
import { TextChunkerResponseValidator } from '@@validators/textChunker.validator'
import { textChunkFunction } from '@@functions/textChunk.function'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { sentenceSplitterFunction } from '@@functions/sentenceSplitter.function'
import { SentenceSplitterResponseValidator } from '@@validators/sentenceSplitter.validator'

const createPrompt = ((text: string) => (
  `Text to chunk: ${text}\n\n` +
  'Strictly follow this instruction: ' +
  'Split the \'Text to chunk\' into overlapping chunks in recursive pattern then return strictly adhering as JSON array'
))

const normaliseText = ((text: string) => text
  .toLowerCase()
  .replace(/[^\w\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
)

async function chunkTextWithLlm(text: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  

  
  // const response = await openai.chat.completions.create({
  //   model: 'gpt-3.5-turbo',
  //   response_format: { type: 'json_object' },
  //   n: 1,
  //   tools: [textChunkFunction],
  //   tool_choice: 'auto',
  //   messages: [
  //     { role: 'system', content: 'You process text into chunks for RAG purposes' },
  //     { role: 'user', content: createPrompt(text) },
  //   ],
  // })
  
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    response_format: { type: 'json_object' },
    n: 1,
    tools: [sentenceSplitterFunction],
    tool_choice: 'auto',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { 
        role: 'user',
        content: `Split following text into semantically correct sentences: "${text}"` 
          + '\n\nReturn the sentences as JSON array',
      },
    ],
  })
  
  const functionResponse = SentenceSplitterResponseValidator.parse(
    response.choices[0].message?.tool_calls
      ? JSON.parse(response.choices[0].message.tool_calls[0].function.arguments)
      : []
  )
  
  const recursiveCharacterSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 50,
    chunkOverlap: 25,
  })
  
  const sentences = await recursiveCharacterSplitter.splitText(
    functionResponse.sentences.map((sentence) => normaliseText(sentence)).join()
  )
  
  console.log(sentences)
  
  
  
  
  
  
  
  // try {
  //   const validatedResponse = TextChunkerResponseValidator.parse(
  //     textChunkFunctionArgs
  //   ).chunks satisfies DocumentChunk[]
    
  //   return validatedResponse.map((chunk) => ({
  //     index: chunk.index,
  //     text: normaliseText(chunk.text),
  //     summary: normaliseText(chunk.summary),
  //   }))
  // } catch (error) {
  //   console.error('Error parsing response:', error)
  // }
}

export { chunkTextWithLlm }
