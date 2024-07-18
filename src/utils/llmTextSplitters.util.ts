import OpenAI from 'openai'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { sentenceSplitterFunction } from '@@functions/sentenceSplitter.function'
import { SentenceSplitterResponseValidator } from '@@validators/sentenceSplitter.validator'

export class LlmTextSplitters {
  private openai
  
  private normaliseText = ((text: string) => text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  )
  
  constructor(llm: OpenAI) {
    this.openai = llm
  }
  
  async recursiveSentenceSplitter(text: string) {
    const response = await this.openai.chat.completions.create({
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
      functionResponse.sentences.map((sentence) => this.normaliseText(sentence)).join()
    )
    
    return sentences
  }
}
