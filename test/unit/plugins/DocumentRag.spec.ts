import { describe, expect, it } from 'bun:test'
import { DocumentRag } from '@/plugins/document.plugin'
import type { Chunk } from '@/models/chunk.model'

/**
 * Expose protected methods for unit testing via a thin subclass.
 * This avoids reaching for private internals or casting to any.
 */
class TestableDocumentRag extends DocumentRag {
  testPresentContext(chunks: Chunk[]): string {
    return this.presentContext(chunks)
  }

  testBuildSystemPrompt(): string {
    return this.buildSystemPrompt()
  }
}

const stubConfig = {
  chatProvider: {
    complete: async () => '',
  },
  embeddingProvider: {
    embed: async () => [],
  },
  vectorStore: {
    exists: async () => false,
    insert: async (collectionId: string) => ({ collectionId, status: 'completed' }),
    search: async () => [],
  },
}

describe('DocumentRag', () => {
  describe('buildSystemPrompt', () => {
    it('references document assistant behaviour and citation instruction', () => {
      const rag = new TestableDocumentRag(stubConfig)
      const prompt = rag.testBuildSystemPrompt()

      expect(prompt).toContain('document assistant')
      expect(prompt).toContain('[1]')
    })
  })

  describe('presentContext', () => {
    it('formats chunks with "Source [n]:" prefix', () => {
      const chunks: Chunk[] = [
        { metadata: {}, text: 'First chunk text.' },
        { metadata: {}, text: 'Second chunk text.' },
      ]

      const rag = new TestableDocumentRag(stubConfig)
      const context = rag.testPresentContext(chunks)

      expect(context).toContain('Source [1]: First chunk text.')
      expect(context).toContain('Source [2]: Second chunk text.')
    })

    it('returns empty string for an empty chunks array', () => {
      const rag = new TestableDocumentRag(stubConfig)
      expect(rag.testPresentContext([])).toBe('')
    })

    it('numbers sources starting at 1', () => {
      const chunks: Chunk[] = [{ metadata: {}, text: 'Only chunk.' }]

      const rag = new TestableDocumentRag(stubConfig)
      const context = rag.testPresentContext(chunks)

      expect(context).toContain('Source [1]:')
      expect(context).not.toContain('Source [0]:')
    })
  })
})
