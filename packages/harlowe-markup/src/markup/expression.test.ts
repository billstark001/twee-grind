import { Expression, harloweOperatorConfigs } from './expression.js'
import type { AnyToken } from './types'
import type { PrattASTNode } from '../utils/pratt-parser'

// Helper to create minimal tokens for testing
const tok = (data: any): AnyToken => data as AnyToken

describe('Expression Module', () => {
  describe('parseExpression', () => {
    it('should parse simple addition', () => {
      const tokens = [
        tok({ type: 'number', text: '1', start: 0, end: 1 }),
        tok({ type: 'addition', text: '+', start: 2, end: 3 }),
        tok({ type: 'number', text: '2', start: 4, end: 5 }),
      ]

      const result = Expression.parse(tokens)
      
      expect(result).toBeDefined()
      expect(result?.type).toBe('binary')
      expect((result as any).operator).toBe('addition')
    })

    it('should parse unary minus', () => {
      const tokens = [
        tok({ type: 'subtraction', text: '-', start: 0, end: 1 }),
        tok({ type: 'number', text: '5', start: 1, end: 2 }),
      ]

      const result = Expression.parse(tokens)
      
      expect(result).toBeDefined()
      expect(result?.type).toBe('prefix')
      expect((result as any).operator).toBe('subtraction')
    })

    it('should respect operator precedence (multiplication over addition)', () => {
      const tokens = [
        tok({ type: 'number', text: '1', start: 0, end: 1 }),
        tok({ type: 'addition', text: '+', start: 2, end: 3 }),
        tok({ type: 'number', text: '2', start: 4, end: 5 }),
        tok({ type: 'multiplication', text: '*', start: 6, end: 7 }),
        tok({ type: 'number', text: '3', start: 8, end: 9 }),
      ]

      const result = Expression.parse(tokens) as any
      
      expect(result).toBeDefined()
      expect(result.type).toBe('binary')
      expect(result.operator).toBe('addition')
      // Right side should be multiplication
      expect(result.right.type).toBe('binary')
      expect(result.right.operator).toBe('multiplication')
    })

    it('should handle comparison operators', () => {
      const tokens = [
        tok({ type: 'number', text: '5', start: 0, end: 1 }),
        tok({ type: 'inequality', text: '>', operator: '>', negate: false, start: 2, end: 3 }),
        tok({ type: 'number', text: '3', start: 4, end: 5 }),
      ]

      const result = Expression.parse(tokens) as any
      
      expect(result).toBeDefined()
      expect(result.type).toBe('binary')
      expect(result.operator).toBe('gt')
    })

    it('should handle logical AND operator', () => {
      const tokens = [
        tok({ type: 'boolean', text: 'true', start: 0, end: 4 }),
        tok({ type: 'and', text: 'and', start: 5, end: 8 }),
        tok({ type: 'boolean', text: 'false', start: 9, end: 14 }),
      ]

      const result = Expression.parse(tokens) as any
      
      expect(result).toBeDefined()
      expect(result.type).toBe('binary')
      expect(result.operator).toBe('and')
    })

    it('should parse grouping tokens', () => {
      const innerTokens = [
        tok({ type: 'number', text: '1', start: 1, end: 2 }),
        tok({ type: 'addition', text: '+', start: 3, end: 4 }),
        tok({ type: 'number', text: '2', start: 5, end: 6 }),
      ]

      const tokens = [
        tok({ 
          type: 'grouping', 
          text: '(1 + 2)', 
          start: 0, 
          end: 7,
          children: innerTokens,
        }),
      ]

      const result = Expression.parse(tokens)
      
      expect(result).toBeDefined()
    })

    it('should skip excluded tokens (whitespace, comment)', () => {
      const tokens = [
        tok({ type: 'number', text: '1', start: 0, end: 1 }),
        tok({ type: 'whitespace', text: ' ', start: 1, end: 2 }),
        tok({ type: 'addition', text: '+', start: 2, end: 3 }),
        tok({ type: 'whitespace', text: ' ', start: 3, end: 4 }),
        tok({ type: 'number', text: '2', start: 4, end: 5 }),
      ]

      const result = Expression.parse(tokens) as any
      
      expect(result).toBeDefined()
      expect(result.type).toBe('binary')
      expect(result.operator).toBe('addition')
    })

    it('should handle division vs modulus', () => {
      const tokens1 = [
        tok({ type: 'number', text: '10', start: 0, end: 2 }),
        tok({ type: 'division', text: '/', start: 3, end: 4 }),
        tok({ type: 'number', text: '2', start: 5, end: 6 }),
      ]

      const result1 = Expression.parse(tokens1) as any
      expect(result1.operator).toBe('division')

      const tokens2 = [
        tok({ type: 'number', text: '10', start: 0, end: 2 }),
        tok({ type: 'division', text: '%', start: 3, end: 4 }),
        tok({ type: 'number', text: '3', start: 5, end: 6 }),
      ]

      const result2 = Expression.parse(tokens2) as any
      expect(result2.operator).toBe('modulus')
    })

    it('should return undefined for empty token array', () => {
      const result = Expression.parse([])
      expect(result).toBeUndefined()
    })
  })

  describe('extractCommaArgs', () => {
    it('should extract single argument', () => {
      const ast: PrattASTNode = {
        type: 'leaf',
        value: { type: 'number', text: '42' },
      }

      const args = Expression.extractCommaArgs(ast)
      
      expect(args).toHaveLength(1)
      expect(args[0]).toBe(ast)
    })

    it('should extract multiple comma-separated arguments', () => {
      const ast: PrattASTNode = {
        type: 'binary',
        operator: 'comma',
        left: {
          type: 'binary',
          operator: 'comma',
          left: { type: 'leaf', value: { type: 'number', text: '1' } },
          right: { type: 'leaf', value: { type: 'number', text: '2' } },
        },
        right: { type: 'leaf', value: { type: 'number', text: '3' } },
      }

      const args = Expression.extractCommaArgs(ast)
      
      expect(args).toHaveLength(3)
    })

    it('should handle undefined input', () => {
      const args = Expression.extractCommaArgs(undefined)
      
      expect(args).toHaveLength(0)
    })

    it('should handle non-comma binary operator', () => {
      const ast: PrattASTNode = {
        type: 'binary',
        operator: 'addition',
        left: { type: 'leaf', value: { type: 'number', text: '1' } },
        right: { type: 'leaf', value: { type: 'number', text: '2' } },
      }

      const args = Expression.extractCommaArgs(ast)
      
      expect(args).toHaveLength(1)
      expect(args[0]).toBe(ast)
    })
  })

  describe('extractTokenValue', () => {
    it('should extract token value without metadata', () => {
      const token = tok({
        type: 'number',
        text: '42',
        start: 0,
        end: 2,
        place: 'Start',
      })

      const value = Expression.extractTokenValue(token)
      
      expect(value.type).toBe('number')
      expect(value.text).toBe('42')
      expect(value.start).toBeUndefined()
      expect(value.end).toBeUndefined()
      expect(value.place).toBeUndefined()
    })

    it('should omit common fields when requested', () => {
      const token = tok({
        type: 'string',
        text: 'hello',
        innerText: 'hello',
        start: 0,
        end: 5,
      })

      const value = Expression.extractTokenValue(token, true)
      
      expect(value.type).toBeUndefined()
      expect(value.text).toBeUndefined()
      expect(value.innerText).toBeUndefined()
    })
  })

  describe('operator configs', () => {
    it('should have correct precedence for arithmetic operators', () => {
      expect(harloweOperatorConfigs.addition.precedence).toBe(13)
      expect(harloweOperatorConfigs.multiplication.precedence).toBe(14)
      expect(harloweOperatorConfigs.multiplication.precedence).toBeGreaterThan(
        harloweOperatorConfigs.addition.precedence
      )
    })

    it('should have correct precedence for logical operators', () => {
      expect(harloweOperatorConfigs.or.precedence).toBe(8)
      expect(harloweOperatorConfigs.and.precedence).toBe(9)
      expect(harloweOperatorConfigs.not.precedence).toBe(10)
    })

    it('should have comma operator with lowest precedence', () => {
      const commaPrecedence = harloweOperatorConfigs.comma.precedence
      const allPrecedences = Object.values(harloweOperatorConfigs).map(c => c.precedence)
      
      expect(commaPrecedence).toBe(Math.min(...allPrecedences))
    })

    it('should have property access operators with high precedence', () => {
      expect(harloweOperatorConfigs.possessiveOperator.precedence).toBe(16)
      expect(harloweOperatorConfigs.belongingOperator.precedence).toBe(16)
    })
  })

  describe('token handlers', () => {
    it('should get token handler for division', () => {
      const handler = Expression.getTokenHandler('division')
      expect(handler).toBeDefined()
    })

    it('should get token handler for inequality', () => {
      const handler = Expression.getTokenHandler('inequality')
      expect(handler).toBeDefined()
    })

    it('should get token handler for property', () => {
      const handler = Expression.getTokenHandler('property')
      expect(handler).toBeDefined()
    })

    it('should return undefined for unknown token type', () => {
      const handler = Expression.getTokenHandler('unknown')
      expect(handler).toBeUndefined()
    })
  })
})
