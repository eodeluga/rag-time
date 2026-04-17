import dotenv from 'dotenv'
import { beforeAll, describe, expect, it, setDefaultTimeout } from 'bun:test'
import { EmbeddingProcessingService } from '@/services/EmbeddingProcessing.service'
import { EmbeddingQueryService } from '@/services/EmbeddingQuery.service'
import { EmbeddingManagementService } from '@/services/EmbeddingManagement.service'
import { TextChunkerService } from '@/services/TextChunker.service'
import { OpenAIProvider } from '@/providers/OpenAIProvider'
import { QdrantVectorStore } from '@/stores/QdrantVectorStore'

describe('Tests the embedding of text chunks from text array and querying and response of the embedded text', async function() {
  setDefaultTimeout(60000)
  dotenv.config()

  let embeddingProcessingService: EmbeddingProcessingService
  let embeddingQueryService: EmbeddingQueryService
  let embeddingId: string | null

  const texts = [
    'Now this is a story all about me,',
    'I was born in \'78, the youngest of six you see,',
    'Grew up in the 80s, tech was my flair,',
    'A software engineer now, but let me take you there,',
    'It started way back, when I was just ten,',
    'A ZX Spectrum +2 from my Mum, my best friend,',
    'With a tape deck built-in, and graphics in colour,',
    'It was the start of my journey, like no other.',
    'In South West London, I was born and raised,',
    'On 8-bit micros is where I spent most of my days,',
    'Typing in BASIC, assembly too,',
    'Then on to C and Java, I knew what to do,',
    'Python\'s a mess, but TypeScript\'s all right,',
    'Been coding since \'88, and I\'m still tight.',
    'My brother had a ZX81, a relic from the past,',
    'Rubber keyed piece of magic, and back then, top class,',
    'He made a horse racing game, and I was hooked on the code',
    'So when I got my own Spectrum, many games I would load,',
    'Typed in some BASIC, from the back of a book,',
    'Made the Union Jack with a glitch, but it still had the look,',
    'Later on assembly, caught my eye,',
    'Started making games, like I was born to fly.',
    'In South West London, I was born and raised,',
    'On 16-bit micros is where I spent most of my days,',
    'The Amiga came next, 1991,',
    'Making music and coding, that machine was fun,',
    'Four channels of 8-bit samples at 28kHz,',
    'Jungle beats pumping, man that was my church.',
    'Made a shoot \'em up, with parallax scrolling,',
    'Had Street Fighter 2\'s 3D floor effect, now I was rolling,',
    'Stayed with the Amiga, hoping for a rise,',
    'But Commodore fell, no big surprise,',
    'So I moved to PC, Quake was the deal,',
    'Voodoo then GeForce GPUs, shout out to Unreal,',
    'Played so many good games, it was like a nirvana,',
    'But Mum said "Get a job", so she sent me to learn Java.',
    'In South West London, I was born and raised,',
    'Gaming on PC is where I spent most of my days,',
    'Worked sysadmin, but that got old quick,',
    'So I became a dev, now that did the trick,',
    'From C# to JavaScript, I\'ve seen it all,',
    'Now I\'m a pro, standing tall.',
    'So here I am, 46 years old,',
    'From BASIC to TypeScript, my story\'s been told,',
    'Still coding every day, it\'s what I love to do,',
    'The journey\'s been long, but I\'m not through.',
  ]

  const firstQuery = 'What year did I get the Amiga 500?'
  const secondQuery = 'Who made horse racing game?'

  beforeAll(async () => {
    const provider = new OpenAIProvider({ apiKey: process.env['OPENAI_API_KEY']! })
    const vectorStore = new QdrantVectorStore()
    const mgmtService = new EmbeddingManagementService(vectorStore)
    const chunkerService = new TextChunkerService(provider)

    embeddingProcessingService = new EmbeddingProcessingService(provider, mgmtService)
    embeddingQueryService = new EmbeddingQueryService(mgmtService, embeddingProcessingService);

    ({ embeddingId } = await embeddingProcessingService.embedText(texts, {
      chunkFn: (text) => chunkerService.chunk(text),
    }))

    if (embeddingId === null) {
      throw new Error('Failed to embed text')
    }
  })

  it(`should provide text that contains answer to: ${firstQuery}`, async () => {
    const results = await embeddingQueryService.query(firstQuery, embeddingId!)
    expect(results.some((result) => result.includes('1991'))).toBeTrue()
    console.log(results)
  })

  it(`should provide text that contains answer to: ${secondQuery}`, async () => {
    const results = await embeddingQueryService.query(secondQuery, embeddingId!)
    expect(results.some((result) => result.includes('brother'))).toBeTrue()
    console.log(results)
  })
})
