import { z } from 'zod'
import type { RetrievalSearchOptions, VectorFilterCondition } from '@/models/vector-filter.model'

const VectorFilterPrimitiveSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
])

const VectorFilterConditionSchema: z.ZodType<VectorFilterCondition> = z.lazy(
  () => z.union([
    z.object({
      field: z.string().min(1),
      operator: z.enum(['eq', 'ne']),
      value: VectorFilterPrimitiveSchema,
    }),
    z.object({
      field: z.string().min(1),
      operator: z.enum(['gt', 'gte', 'lt', 'lte']),
      value: z.number().finite(),
    }),
    z.object({
      field: z.string().min(1),
      operator: z.literal('in'),
      values: z.array(VectorFilterPrimitiveSchema).min(1),
    }),
    z.object({
      conditions: z.array(VectorFilterConditionSchema).min(1),
      operator: z.enum(['and', 'or']),
    }),
    z.object({
      condition: VectorFilterConditionSchema,
      operator: z.literal('not'),
    }),
  ])
)

const RetrievalSearchOptionsSchema: z.ZodType<RetrievalSearchOptions> = z.object({
  filter: VectorFilterConditionSchema.optional(),
  limit: z.number().int().positive(),
})

export { RetrievalSearchOptionsSchema, VectorFilterConditionSchema, VectorFilterPrimitiveSchema }
