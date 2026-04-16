import { createHash } from 'crypto'
  
/**
* Creates a SHA-256 hash from the provided string.
*
* @param {Buffer} input - The string to be hashed.
* @returns {string} - The hexadecimal representation of the SHA-256 hash.
* @throws {Error} - Throws an error if there is an issue creating the hash.
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
