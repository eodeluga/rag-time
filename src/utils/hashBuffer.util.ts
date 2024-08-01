import { createHash } from 'crypto'
const hashBuffer = async (fileBuffer: Buffer): Promise<string> => {
  try {
    const hash = createHash('sha256')
    hash.update(fileBuffer)
    return hash.digest('hex')
  } catch (error) {
    console.error('Error creating hash', error)
    throw error
  }
}

export { hashBuffer }
