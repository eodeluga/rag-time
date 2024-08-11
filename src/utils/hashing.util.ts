import { createHash } from 'crypto'
  
export async function hashBuffer(buffer: Buffer): Promise<string> {
  try {
    const hash = createHash('sha256')
    hash.update(buffer)
    return hash.digest('hex')
  } catch (error) {
    throw new Error(`Error creating hash: ${error instanceof Error ? error.message : ''}`)
  }
}
