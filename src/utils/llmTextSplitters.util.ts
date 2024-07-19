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
      temperature: 1,
      max_tokens: 256,
      top_p: 0.5,
      frequency_penalty: 0,
      presence_penalty: 0,
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
    
    const longestSentenceLength = functionResponse.sentences.reduce(
      (longest, sentence) => sentence.length > longest ? sentence.length : longest,
      0
    )
    
    // TODO: Implement a better way to chunk the text.
    // Try using the LLM to split where each sentence has a summary of the previous sentence.
    const recursiveCharacterSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: longestSentenceLength > 0 ? longestSentenceLength : 50,
      chunkOverlap: longestSentenceLength > 0 ? Math.ceil(longestSentenceLength/2) : 25,
    })
    
    const sentences = await recursiveCharacterSplitter.splitText(
      functionResponse.sentences.map((sentence) => this.normaliseText(sentence)).join()
    )
    
    return sentences
  }
}
