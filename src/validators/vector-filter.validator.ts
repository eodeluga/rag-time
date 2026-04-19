import { RetrievalSearchOptionsSchema, VectorFilterConditionSchema } from '@/validators/vector-filter.schema'
import { InvalidVectorFilterError } from '@/errors/invalid-vector-filter.error'
import type { RetrievalSearchOptions, VectorFilterCondition } from '@/models/vector-filter.model'

export class VectorFilterValidator {
  static validate(input: unknown): VectorFilterCondition {
    const result = VectorFilterConditionSchema.safeParse(input)

    if (!result.success) {
      throw new InvalidVectorFilterError('Invalid vector filter', result.error.issues)
    }

    return result.data
  }

  static validateSearchOptions(input: unknown): RetrievalSearchOptions {
    const result = RetrievalSearchOptionsSchema.safeParse(input)

    if (!result.success) {
      throw new InvalidVectorFilterError('Invalid retrieval search options', result.error.issues)
    }

    return result.data
  }
}
