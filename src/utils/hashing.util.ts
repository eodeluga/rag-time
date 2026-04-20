import { createHash } from 'crypto'

/**
 * Computes the SHA-256 hash of a string and returns it as a lowercase hex digest.
 *
 * Used internally to derive stable, content-addressable collection identifiers
 * for deduplication of embedding storage.
 *
 * @param {string} input - The string to hash.
 * @returns {string} A 64-character lowercase hexadecimal SHA-256 digest.
 * @throws {Error} If the underlying crypto operation fails.
 */
export function hashString(input: string): string {
  try {
    return createHash('sha256')
      .update(input, 'utf-8')
      .digest('hex')
  } catch (error) {
    throw new Error(`Error creating hash: ${error instanceof Error ? error.message : ''}`)
  }
}
