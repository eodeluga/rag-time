/** Primitive value types accepted by vector filter conditions. */
type VectorFilterPrimitive = boolean | number | string

/**
 * Equality or inequality comparison against a scalar payload field.
 *
 * Used as a constituent of {@link VectorFilterCondition}.
 */
type VectorFilterComparisonCondition = {
  /** Payload field name to compare. */
  field: string
  /** `'eq'` tests strict equality; `'ne'` tests strict inequality. */
  operator: 'eq' | 'ne'
  /** Value to compare against. */
  value: VectorFilterPrimitive
}

/**
 * Numeric range comparison against a scalar payload field.
 *
 * Used as a constituent of {@link VectorFilterCondition}.
 */
type VectorFilterRangeCondition = {
  /** Payload field name to compare. */
  field: string
  /**
   * Comparison direction:
   * - `'gt'` — strictly greater than
   * - `'gte'` — greater than or equal to
   * - `'lt'` — strictly less than
   * - `'lte'` — less than or equal to
   */
  operator: 'gt' | 'gte' | 'lt' | 'lte'
  /** Numeric threshold for the range comparison. */
  value: number
}

/**
 * Recursive filter condition for scoping vector searches by payload metadata.
 *
 * Scalar conditions (`'eq'`, `'ne'`, `'gt'`, `'gte'`, `'lt'`, `'lte'`, `'in'`) test a single
 * field. Logical conditions (`'and'`, `'or'`, `'not'`) compose child conditions
 * to build arbitrarily complex filters.
 *
 * @example
 * // Match chunks where `category` equals "news" AND `score` is greater than 0.8
 * const filter: VectorFilterCondition = {
 *   operator: 'and',
 *   conditions: [
 *     { operator: 'eq', field: 'category', value: 'news' },
 *     { operator: 'gt', field: 'score', value: 0.8 },
 *   ],
 * }
 */
type VectorFilterCondition =
  | VectorFilterComparisonCondition
  | VectorFilterRangeCondition
  | {
      /** Payload field name to test. */
      field: string
      /** Matches if the field value equals any element in `values`. */
      operator: 'in'
      /** Allowlist of accepted values. */
      values: VectorFilterPrimitive[]
    }
  | {
      /** Child conditions to evaluate. All must pass for `'and'`; any must pass for `'or'`. */
      conditions: VectorFilterCondition[]
      operator: 'and' | 'or'
    }
  | {
      /** Child condition to negate. */
      condition: VectorFilterCondition
      operator: 'not'
    }

/**
 * Options that control how vector similarity results are retrieved.
 */
interface RetrievalSearchOptions {
  /** Optional payload filter applied before scoring candidates. */
  filter?: VectorFilterCondition
  /** Maximum number of results to return. Must be a positive integer. */
  limit: number
}

export type {
  RetrievalSearchOptions,
  VectorFilterComparisonCondition,
  VectorFilterCondition,
  VectorFilterPrimitive,
  VectorFilterRangeCondition,
}
