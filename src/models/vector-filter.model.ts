type VectorFilterPrimitive = boolean | number | string

type VectorFilterComparisonCondition = {
  field: string
  operator: 'eq' | 'ne'
  value: VectorFilterPrimitive
}

type VectorFilterRangeCondition = {
  field: string
  operator: 'gt' | 'gte' | 'lt' | 'lte'
  value: number
}

type VectorFilterCondition =
  | VectorFilterComparisonCondition
  | VectorFilterRangeCondition
  | {
      field: string
      operator: 'in'
      values: VectorFilterPrimitive[]
    }
  | {
      conditions: VectorFilterCondition[]
      operator: 'and' | 'or'
    }
  | {
      condition: VectorFilterCondition
      operator: 'not'
    }

interface RetrievalSearchOptions {
  filter?: VectorFilterCondition
  limit: number
}

export type {
  RetrievalSearchOptions,
  VectorFilterComparisonCondition,
  VectorFilterCondition,
  VectorFilterPrimitive,
  VectorFilterRangeCondition,
}
