import { describe, expect, it } from 'bun:test'
import { VectorFilterValidator } from '@/validators/vector-filter.validator'
import { InvalidVectorFilterError } from '@/errors/invalid-vector-filter.error'

describe('VectorFilterValidator', () => {
  describe('scalar operator conditions', () => {
    it('accepts a valid eq condition', () => {
      const filter = { field: 'source', operator: 'eq', value: 'doc.pdf' }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('accepts a valid ne condition', () => {
      const filter = { field: 'category', operator: 'ne', value: 'archived' }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('accepts a valid gt condition with a numeric value', () => {
      const filter = { field: 'score', operator: 'gt', value: 0.5 }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('rejects gt conditions with non-numeric values', () => {
      const filter = { field: 'score', operator: 'gt', value: '0.5' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('accepts a valid gte condition', () => {
      const filter = { field: 'score', operator: 'gte', value: 0.5 }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('rejects gte conditions with non-numeric values', () => {
      const filter = { field: 'score', operator: 'gte', value: '0.5' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('accepts a valid lt condition', () => {
      const filter = { field: 'rank', operator: 'lt', value: 10 }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('rejects lt conditions with non-numeric values', () => {
      const filter = { field: 'rank', operator: 'lt', value: '10' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('accepts a valid lte condition', () => {
      const filter = { field: 'rank', operator: 'lte', value: 10 }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('rejects lte conditions with non-numeric values', () => {
      const filter = { field: 'rank', operator: 'lte', value: '10' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('accepts boolean primitive values', () => {
      const filter = { field: 'active', operator: 'eq', value: true }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('rejects an empty field string', () => {
      const filter = { field: '', operator: 'eq', value: 'val' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('rejects a non-string field', () => {
      const filter = { field: 42, operator: 'eq', value: 'val' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('rejects a non-primitive value (object)', () => {
      const filter = { field: 'source', operator: 'eq', value: { nested: true } }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('rejects a non-primitive value (array)', () => {
      const filter = { field: 'source', operator: 'eq', value: ['a', 'b'] }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('rejects an unknown operator', () => {
      const filter = { field: 'source', operator: 'like', value: 'doc' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('rejects a missing field property', () => {
      const filter = { operator: 'eq', value: 'doc.pdf' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })
  })

  describe('in operator conditions', () => {
    it('accepts a valid in condition with multiple values', () => {
      const filter = { field: 'source', operator: 'in', values: ['a.pdf', 'b.pdf'] }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('accepts a valid in condition with a single value', () => {
      const filter = { field: 'source', operator: 'in', values: ['only.pdf'] }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('rejects an empty values array', () => {
      const filter = { field: 'source', operator: 'in', values: [] }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('rejects non-primitive values inside the in array', () => {
      const filter = { field: 'source', operator: 'in', values: [{ nested: true }] }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })
  })

  describe('logical operator conditions', () => {
    it('accepts a valid and condition with two leaf conditions', () => {
      const filter = {
        conditions: [
          { field: 'source', operator: 'eq', value: 'doc.pdf' },
          { field: 'rank', operator: 'lt', value: 5 },
        ],
        operator: 'and',
      }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('accepts a valid or condition', () => {
      const filter = {
        conditions: [
          { field: 'source', operator: 'eq', value: 'a.pdf' },
          { field: 'source', operator: 'eq', value: 'b.pdf' },
        ],
        operator: 'or',
      }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('accepts a valid not condition', () => {
      const filter = {
        condition: { field: 'source', operator: 'eq', value: 'excluded.pdf' },
        operator: 'not',
      }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('rejects an and condition with an empty conditions array', () => {
      const filter = { conditions: [], operator: 'and' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('rejects an or condition with an empty conditions array', () => {
      const filter = { conditions: [], operator: 'or' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })

    it('accepts nested logical conditions', () => {
      const filter = {
        conditions: [
          {
            condition: { field: 'archived', operator: 'eq', value: true },
            operator: 'not',
          },
          { field: 'source', operator: 'in', values: ['a.pdf', 'b.pdf'] },
        ],
        operator: 'and',
      }

      expect(() => VectorFilterValidator.validate(filter)).not.toThrow()
    })

    it('rejects a malformed node with no recognised structure', () => {
      const filter = { unknown: 'field', operator: 'and' }

      expect(() => VectorFilterValidator.validate(filter)).toThrow(InvalidVectorFilterError)
    })
  })

  describe('validate return value', () => {
    it('returns the validated filter when valid', () => {
      const filter = { field: 'source', operator: 'eq', value: 'doc.pdf' } as const
      const result = VectorFilterValidator.validate(filter)

      expect(result).toEqual(filter)
    })
  })

  describe('validateSearchOptions', () => {
    it('accepts retrieval options with positive integer limit', () => {
      const result = VectorFilterValidator.validateSearchOptions({
        filter: undefined,
        limit: 5,
      })

      expect(result.limit).toBe(5)
      expect(result.filter).toBeUndefined()
    })

    it('rejects retrieval options with zero limit', () => {
      expect(() =>
        VectorFilterValidator.validateSearchOptions({
          filter: undefined,
          limit: 0,
        })
      ).toThrow(InvalidVectorFilterError)
    })

    it('rejects retrieval options with negative limit', () => {
      expect(() =>
        VectorFilterValidator.validateSearchOptions({
          filter: undefined,
          limit: -1,
        })
      ).toThrow(InvalidVectorFilterError)
    })

    it('rejects retrieval options with non-integer limit', () => {
      expect(() =>
        VectorFilterValidator.validateSearchOptions({
          filter: undefined,
          limit: 1.5,
        })
      ).toThrow(InvalidVectorFilterError)
    })
  })
})
