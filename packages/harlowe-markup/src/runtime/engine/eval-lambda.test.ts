import { createLambda, invokeLambda } from './eval-lambda.js'
import type { EvaluationContext, HarloweEngineScope, VariableResolver, HookNameEvaluator } from '../types'
import { HarloweCustomDataType } from '../types'
import { Markup } from '../../markup/markup.js'
import type { MacroNode, ExpressionNode } from '../../markup/types'

/**
 * Helper to extract expressions from code
 */
const getExpressions = (code: string): ExpressionNode[] => {
  const macroNode = Markup.parse(Markup.lex(`(expr: ${code})`)).children[0] as MacroNode
  return macroNode.args
}

/**
 * Helper to create a basic evaluation context
 */
const createTestContext = (vars: Record<string, any> = {}): EvaluationContext => {
  const scope: HarloweEngineScope = {
    srcPassage: 'test',
    srcPos: 0,
    vars: new Map(Object.entries(vars)),
  }

  const resolver: VariableResolver = {
    getVariable: (name: string, scope: HarloweEngineScope) => {
      // Check current scope
      if (scope.vars.has(name)) {
        return scope.vars.get(name)
      }
      // Check parent scopes
      let currentScope = scope.parent
      while (currentScope) {
        if (currentScope.vars.has(name)) {
          return currentScope.vars.get(name)
        }
        currentScope = currentScope.parent
      }
      return undefined
    },
  }

  const hookNameEvaluator: HookNameEvaluator = {
    evaluateHookName: (node, scope) => {
      return {
        [HarloweCustomDataType]: 'HookName',
        hookName: node.name,
        chars: '',
        links: [],
        lines: [],
        slice: () => ({} as any),
        visited: {} as any,
      }
    },
  }

  return {
    scope,
    reserved: {},
    resolver,
    hookNameEvaluator,
  }
}

describe('Lambda Evaluation Module', () => {
  describe('createLambda', () => {
    it('should create a lambda variable', () => {
      const [bodyExpr] = getExpressions('$x + 1')
      const scope: HarloweEngineScope = {
        srcPassage: 'test',
        srcPos: 0,
        vars: new Map(),
      }

      const lambda = createLambda(['x'], bodyExpr, scope)

      expect(lambda[HarloweCustomDataType]).toBe('Lambda')
      expect(lambda.argNames).toEqual(['x'])
      expect(lambda.body).toBe(bodyExpr)
    })

    it('should create a lambda with multiple arguments', () => {
      const [bodyExpr] = getExpressions('$x + $y')
      const scope: HarloweEngineScope = {
        srcPassage: 'test',
        srcPos: 0,
        vars: new Map(),
      }

      const lambda = createLambda(['x', 'y'], bodyExpr, scope)

      expect(lambda.argNames).toEqual(['x', 'y'])
    })

    it('should create a lambda with no arguments', () => {
      const [bodyExpr] = getExpressions('42')
      const scope: HarloweEngineScope = {
        srcPassage: 'test',
        srcPos: 0,
        vars: new Map(),
      }

      const lambda = createLambda([], bodyExpr, scope)

      expect(lambda.argNames).toEqual([])
    })
  })

  describe('invokeLambda', () => {
    it('should invoke a simple lambda', () => {
      const [bodyExpr] = getExpressions('$x + 1')
      const context = createTestContext()
      const lambda = createLambda(['x'], bodyExpr, context.scope)

      const result = invokeLambda(lambda, [5], context)

      expect(result).toBe(6)
    })

    it('should invoke a lambda with multiple arguments', () => {
      const [bodyExpr] = getExpressions('$x + $y')
      const context = createTestContext()
      const lambda = createLambda(['x', 'y'], bodyExpr, context.scope)

      const result = invokeLambda(lambda, [3, 7], context)

      expect(result).toBe(10)
    })

    it('should invoke a lambda with no arguments', () => {
      const [bodyExpr] = getExpressions('42')
      const context = createTestContext()
      const lambda = createLambda([], bodyExpr, context.scope)

      const result = invokeLambda(lambda, [], context)

      expect(result).toBe(42)
    })

    it('should support closure - access variables from creation scope', () => {
      const [bodyExpr] = getExpressions('$x + $outer')
      const context = createTestContext({ outer: 10 })
      const lambda = createLambda(['x'], bodyExpr, context.scope)

      const result = invokeLambda(lambda, [5], context)

      expect(result).toBe(15)
    })

    it('should handle nested lambda calls', () => {
      // Create outer lambda: x => x + outer
      const [outerBody] = getExpressions('$x + $outer')
      const context = createTestContext({ outer: 100 })
      const outerLambda = createLambda(['x'], outerBody, context.scope)

      // Invoke outer lambda
      const result = invokeLambda(outerLambda, [25], context)

      expect(result).toBe(125)
    })

    it('should throw error if argument count mismatch', () => {
      const [bodyExpr] = getExpressions('$x + $y')
      const context = createTestContext()
      const lambda = createLambda(['x', 'y'], bodyExpr, context.scope)

      expect(() => invokeLambda(lambda, [1], context)).toThrow(
        'Lambda expects 2 arguments, got 1'
      )
    })

    it('should handle complex expressions in lambda body', () => {
      const [bodyExpr] = getExpressions('($x * 2) + ($y * 3)')
      const context = createTestContext()
      const lambda = createLambda(['x', 'y'], bodyExpr, context.scope)

      const result = invokeLambda(lambda, [4, 5], context)

      expect(result).toBe(23) // (4 * 2) + (5 * 3) = 8 + 15 = 23
    })

    it('should handle boolean logic in lambda', () => {
      const [bodyExpr] = getExpressions('$x > 5')
      const context = createTestContext()
      const lambda = createLambda(['x'], bodyExpr, context.scope)

      expect(invokeLambda(lambda, [10], context)).toBe(true)
      expect(invokeLambda(lambda, [3], context)).toBe(false)
    })

    it('should support string concatenation', () => {
      const [bodyExpr] = getExpressions('$first')
      const context = createTestContext()
      const lambda = createLambda(['first'], bodyExpr, context.scope)

      const result = invokeLambda(lambda, ['Hello'], context)

      expect(result).toBe('Hello')
    })

    it('should isolate lambda scope from external scope', () => {
      const [bodyExpr] = getExpressions('$x')
      const context = createTestContext({ x: 999 }) // x in outer scope
      const lambda = createLambda(['x'], bodyExpr, context.scope)

      // Lambda parameter x should shadow outer x
      const result = invokeLambda(lambda, [5], context)

      expect(result).toBe(5) // Should use lambda argument, not outer variable
    })
  })
})
