import { createHash } from 'crypto'
  
/**
* Creates a SHA-256 hash from the provided buffer.
*
* @param {Buffer} buffer - The buffer to be hashed.
* @returns {Promise<string>} - A promise that resolves to the hexadecimal representation of the SHA-256 hash.
* @throws {Error} - Throws an error if there is an issue creating the hash.
*/
export async function hashBuffer(buffer: Buffer): Promise<string> {
  try {
    const hash = createHash('sha256')
    hash.update(buffer)
    return hash.digest('hex')
  } catch (error) {
    throw new Error(`Error creating hash: ${error instanceof Error ? error.message : ''}`)
  }
}
