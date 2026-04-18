import { z } from 'zod'

const FilePathValidator = z
  .string()
  .min(1, 'filePath must not be empty')
  .refine((filePath) => !filePath.includes('\0'), 'filePath must not contain null bytes')

export { FilePathValidator }
