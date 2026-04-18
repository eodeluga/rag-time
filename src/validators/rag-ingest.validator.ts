import { z } from 'zod'
import { MetadataValidator } from '@/validators/metadata.validator'

const IngestInputValidator = z.object({
  input: z.union([
    z.custom<Buffer>((value) => Buffer.isBuffer(value), {
      message: 'input must be a Buffer',
    }),
    z.string().trim().min(1),
  ]),
  metadata: MetadataValidator.optional(),
})

export { IngestInputValidator }
