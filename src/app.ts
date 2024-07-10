import dotenv from 'dotenv'
import { chunkTextWithLlm } from '@@utils/textChunker.util'

dotenv.config();

(async () => {
  // Chunk the first page of Harry Potter and the Philosopher's Stone
  const chunks = await chunkTextWithLlm(
    'Mr. and Mrs. Dursley, of number four, Privet Drive, were proud to say that they were perfectly normal, thank you very much.'
    + 'They were the last people you’d expect to be involved in anything strange or mysterious,'
    + 'because they just didn’t hold with such nonsense.'
    + 'Mr. Dursley was the director of a firm called Grunnings, which made drills. He was a big, beef'
  )
  console.log(chunks)
})()

