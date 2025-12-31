import {
  advancedMatches,
  createArrayPattern,
  createDatamapPattern,
  createDatasetPattern,
  createRegexPattern,
  createRegexDatatype,
  isPattern,
  isRegexDatatype,
} from './eval-matches.js'
import { HarloweCustomDataType } from '../types'

describe('Advanced Matches Module', () => {
  describe('Array Pattern Matching', () => {
    it('should match array with exact values', () => {
      const value = [2, 3]
      const pattern = [2, 3]
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match array with datatype patterns', () => {
      const value = [2, 3]
      const pattern = ['num', 'num']
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match array with mixed patterns', () => {
      const value = [2, 'hello', 3]
      const pattern = ['num', 'string', 'num']
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should fail match if array length differs', () => {
      const value = [2, 3]
      const pattern = ['num', 'num', 'num']
      expect(advancedMatches(value, pattern)).toBe(false)
    })

    it('should fail match if element type differs', () => {
      const value = [2, 'hello']
      const pattern = ['num', 'num']
      expect(advancedMatches(value, pattern)).toBe(false)
    })

    it('should match nested array patterns', () => {
      const value = [[1, 2], [3, 4]]
      const pattern = [['num', 'num'], ['num', 'num']]
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match array containing array with array pattern', () => {
      const value = [[1, 2, 3]]
      const pattern = [['num', 'num', 'num']]
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match with datatype variable', () => {
      const value = [2, 3]
      const pattern = [
        { [HarloweCustomDataType]: 'Datatype', datatype: 'num' },
        { [HarloweCustomDataType]: 'Datatype', datatype: 'num' },
      ]
      expect(advancedMatches(value, pattern)).toBe(true)
    })
  })

  describe('Datamap Pattern Matching', () => {
    it('should match datamap with exact key-value pairs', () => {
      const value = new Map([
        ['Love', 2],
        ['Fear', 4],
      ])
      const pattern = new Map([
        ['Love', 2],
        ['Fear', 4],
      ])
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match datamap with datatype patterns', () => {
      const value = new Map([
        ['Love', 2],
        ['Fear', 4],
      ])
      const pattern = new Map([
        ['Love', 'num'],
        ['Fear', 'num'],
      ])
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match datamap with subset of keys', () => {
      const value = new Map([
        ['Love', 2],
        ['Fear', 4],
        ['Hope', 6],
      ])
      const pattern = new Map([
        ['Love', 'num'],
        ['Fear', 'num'],
      ])
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should fail match if pattern has more keys', () => {
      const value = new Map([['Love', 2]])
      const pattern = new Map([
        ['Love', 'num'],
        ['Fear', 'num'],
      ])
      expect(advancedMatches(value, pattern)).toBe(false)
    })

    it('should fail match if key value type differs', () => {
      const value = new Map([['Love', 'two']])
      const pattern = new Map([['Love', 'num']])
      expect(advancedMatches(value, pattern)).toBe(false)
    })

    it('should match nested datamap patterns', () => {
      const value = new Map([
        ['outer', new Map([['inner', 5]])],
      ])
      const pattern = new Map([
        ['outer', new Map([['inner', 'num']])],
      ])
      expect(advancedMatches(value, pattern)).toBe(true)
    })
  })

  describe('Dataset Pattern Matching', () => {
    it('should match dataset with exact elements', () => {
      const value = new Set([2, 3])
      const pattern = new Set([2, 3])
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match dataset with datatype patterns', () => {
      const value = new Set([2, 3])
      const pattern = new Set([3, 'num'])
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match dataset regardless of order', () => {
      const value = new Set([3, 2, 1])
      const pattern = new Set([1, 'num'])
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should fail match if pattern has more elements', () => {
      const value = new Set([2])
      const pattern = new Set([2, 3])
      expect(advancedMatches(value, pattern)).toBe(false)
    })

    it('should match dataset with subset of patterns', () => {
      const value = new Set([2, 3, 4])
      const pattern = new Set([3, 'num'])
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match dataset containing array', () => {
      const value = new Set([[1, 2]])
      const pattern = new Set([['num', 'num']])
      expect(advancedMatches(value, pattern)).toBe(true)
    })
  })

  describe('Pattern Variable Matching', () => {
    it('should match array pattern variable', () => {
      const value = [2, 3]
      const pattern = createArrayPattern(['num', 'num'])
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match datamap pattern variable', () => {
      const value = new Map([
        ['Love', 2],
        ['Fear', 4],
      ])
      const pattern = createDatamapPattern(
        new Map([
          ['Love', 'num'],
          ['Fear', 'num'],
        ])
      )
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match dataset pattern variable', () => {
      const value = new Set([2, 3])
      const pattern = createDatasetPattern(new Set(['num', 3]))
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match regex pattern variable', () => {
      const value = 'hello123'
      const pattern = createRegexPattern(/hello\d+/)
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should fail regex pattern match', () => {
      const value = 'goodbye'
      const pattern = createRegexPattern(/hello\d+/)
      expect(advancedMatches(value, pattern)).toBe(false)
    })
  })

  describe('Regex Datatype Matching', () => {
    it('should match string with regex datatype', () => {
      const value = 'test123'
      const pattern = createRegexDatatype(/test\d+/)
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should fail regex datatype match', () => {
      const value = 'test'
      const pattern = createRegexDatatype(/test\d+/)
      expect(advancedMatches(value, pattern)).toBe(false)
    })

    it('should match with complex regex', () => {
      const value = 'email@example.com'
      const pattern = createRegexDatatype(/^[\w.-]+@[\w.-]+\.\w+$/)
      expect(advancedMatches(value, pattern)).toBe(true)
    })
  })

  describe('Legacy RegExp Matching', () => {
    it('should match string with native RegExp', () => {
      const value = 'hello world'
      const pattern = /hello/
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should fail RegExp match', () => {
      const value = 'goodbye'
      const pattern = /hello/
      expect(advancedMatches(value, pattern)).toBe(false)
    })
  })

  describe('Datatype Keyword Matching', () => {
    it('should match number with "num" keyword', () => {
      expect(advancedMatches(42, 'num')).toBe(true)
    })

    it('should match string with "str" keyword', () => {
      expect(advancedMatches('hello', 'str')).toBe(true)
    })

    it('should match boolean with "bool" keyword', () => {
      expect(advancedMatches(true, 'bool')).toBe(true)
    })

    it('should match array with "array" keyword', () => {
      expect(advancedMatches([1, 2, 3], 'array')).toBe(true)
    })

    it('should fail type mismatch', () => {
      expect(advancedMatches('hello', 'num')).toBe(false)
    })
  })

  describe('Complex Nested Patterns', () => {
    it('should match deeply nested array patterns', () => {
      const value = [[[1, 2]], [[3, 4]]]
      const pattern = [[['num', 'num']], [['num', 'num']]]
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match array of datamaps', () => {
      const value = [
        new Map([['key', 1]]),
        new Map([['key', 2]]),
      ]
      const pattern = [
        new Map([['key', 'num']]),
        new Map([['key', 'num']]),
      ]
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match datamap with array values', () => {
      const value = new Map([
        ['numbers', [1, 2, 3]],
        ['strings', ['a', 'b']],
      ])
      const pattern = new Map([
        ['numbers', ['num', 'num', 'num']],
        ['strings', ['str', 'str']],
      ])
      expect(advancedMatches(value, pattern)).toBe(true)
    })

    it('should match dataset with complex elements', () => {
      const value = new Set([
        [1, 2],
        [3, 4],
      ])
      const pattern = new Set([['num', 'num']])
      expect(advancedMatches(value, pattern)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should match empty array', () => {
      expect(advancedMatches([], [])).toBe(true)
    })

    it('should match empty datamap', () => {
      expect(advancedMatches(new Map(), new Map())).toBe(true)
    })

    it('should match empty dataset', () => {
      expect(advancedMatches(new Set(), new Set())).toBe(true)
    })

    it('should use exact equality as fallback', () => {
      expect(advancedMatches(42, 42)).toBe(true)
      expect(advancedMatches('hello', 'hello')).toBe(true)
      expect(advancedMatches(true, true)).toBe(true)
    })
  })

  describe('Type Guards', () => {
    it('should identify Pattern variable', () => {
      const pattern = createArrayPattern(['num', 'num'])
      expect(isPattern(pattern)).toBe(true)
    })

    it('should identify RegexDatatype variable', () => {
      const regex = createRegexDatatype(/test/)
      expect(isRegexDatatype(regex)).toBe(true)
    })

    it('should not identify regular values as Pattern', () => {
      expect(isPattern([1, 2, 3])).toBe(false)
      expect(isPattern('num')).toBe(false)
    })

    it('should not identify regular values as RegexDatatype', () => {
      expect(isRegexDatatype(/test/)).toBe(false)
      expect(isRegexDatatype('test')).toBe(false)
    })
  })
})
