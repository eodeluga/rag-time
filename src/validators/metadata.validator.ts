import { z } from 'zod'

const reservedEmbeddingMetadataKeys = new Set(['index', 'text'])

const MetadataValueValidator = z.union([z.boolean(), z.number(), z.string()])

const MetadataValidator = z.record(z.string(), MetadataValueValidator)

const EmbeddingMetadataValidator = MetadataValidator.refine((metadata) =>
  Object.keys(metadata).every((key) => !reservedEmbeddingMetadataKeys.has(key)), {
  message: 'Metadata must not override reserved keys: index, text',
})

export { EmbeddingMetadataValidator, MetadataValidator }
