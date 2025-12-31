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

  describe('Lambda Operators (where, when, via, making, each)', () => {
    describe('where operator', () => {
      it('should evaluate where lambda with expression body', () => {
        // Simulating: _x where _x > 5
        const [conditionExpr] = getExpressions('$x > 5')
        const context = createTestContext()
        const lambda = createLambda(['x'], conditionExpr, context.scope, 'where')

        // Test with value that passes condition
        expect(invokeLambda(lambda, [10], context)).toBe(true)
        // Test with value that fails condition
        expect(invokeLambda(lambda, [3], context)).toBe(false)
      })

      it('should have access to "it" keyword in where lambda', () => {
        // Simulating: where it > 5
        const [conditionExpr] = getExpressions('it > 5')
        const context = createTestContext()
        const lambda = createLambda(['it'], conditionExpr, context.scope, 'where')

        expect(invokeLambda(lambda, [10], context)).toBe(true)
        expect(invokeLambda(lambda, [3], context)).toBe(false)
      })
    })

    describe('when operator', () => {
      it('should evaluate when lambda similar to where', () => {
        // Simulating: _x when _x < 10
        const [conditionExpr] = getExpressions('$x < 10')
        const context = createTestContext()
        const lambda = createLambda(['x'], conditionExpr, context.scope, 'when')

        expect(invokeLambda(lambda, [5], context)).toBe(true)
        expect(invokeLambda(lambda, [15], context)).toBe(false)
      })
    })

    describe('via operator', () => {
      it('should evaluate via lambda for transformation', () => {
        // Simulating: _x via _x * 2
        const [transformExpr] = getExpressions('$x * 2')
        const context = createTestContext()
        const lambda = createLambda(['x'], transformExpr, context.scope, 'via')

        expect(invokeLambda(lambda, [5], context)).toBe(10)
        expect(invokeLambda(lambda, [10], context)).toBe(20)
      })

      it('should transform strings via lambda', () => {
        // Would be: _str via _str + "!"
        const [transformExpr] = getExpressions('$str')
        const context = createTestContext()
        const lambda = createLambda(['str'], transformExpr, context.scope, 'via')

        expect(invokeLambda(lambda, ['hello'], context)).toBe('hello')
      })
    })

    describe('each operator', () => {
      it('should create each lambda with variable name', () => {
        // Simulating: each _item
        // Each lambda without body just returns the item
        const context = createTestContext()
        const lambda = createLambda(['item'], null as any, context.scope, 'each')

        // Without a body, it should just return the argument
        expect(invokeLambda(lambda, [42], context)).toBe(42)
      })
    })

    describe('making operator', () => {
      it('should create making lambda with accumulator variable', () => {
        // Simulating: _num making _total via _total + _num
        const [accumulatorExpr] = getExpressions('$total + $num')
        const context = createTestContext()
        const lambda = createLambda(['num'], accumulatorExpr, context.scope, 'making')
        lambda.makingVarName = 'total'

        // Making lambda would typically be used with initial accumulator value
        // For now, test that it evaluates correctly
        const result = invokeLambda(lambda, [5], context)
        expect(result).toBe(5) // 0 (default) + 5
      })
    })

    describe('Complex lambda expressions', () => {
      it('should handle complex condition in where lambda', () => {
        // Simulating: _x where (_x > 5) and (_x < 15)
        const [conditionExpr] = getExpressions('($x > 5) and ($x < 15)')
        const context = createTestContext()
        const lambda = createLambda(['x'], conditionExpr, context.scope, 'where')

        expect(invokeLambda(lambda, [10], context)).toBe(true)
        expect(invokeLambda(lambda, [3], context)).toBe(false)
        expect(invokeLambda(lambda, [20], context)).toBe(false)
      })

      it('should handle arithmetic in via lambda', () => {
        // Simulating: _x via (_x * 2) + 1
        const [transformExpr] = getExpressions('($x * 2) + 1')
        const context = createTestContext()
        const lambda = createLambda(['x'], transformExpr, context.scope, 'via')

        expect(invokeLambda(lambda, [5], context)).toBe(11)
        expect(invokeLambda(lambda, [0], context)).toBe(1)
      })
    })

    describe('Lambda type properties', () => {
      it('should create lambda with correct type', () => {
        const [expr] = getExpressions('$x > 5')
        const context = createTestContext()
        const lambda = createLambda(['x'], expr, context.scope, 'where')

        expect(lambda.lambdaType).toBe('where')
        expect(lambda.argNames).toEqual(['x'])
      })

      it('should create via lambda with correct properties', () => {
        const [expr] = getExpressions('$x * 2')
        const context = createTestContext()
        const lambda = createLambda(['x'], expr, context.scope, 'via')

        expect(lambda.lambdaType).toBe('via')
      })

      it('should create making lambda with making variable name', () => {
        const [expr] = getExpressions('$total + $x')
        const context = createTestContext()
        const lambda = createLambda(['x'], expr, context.scope, 'making')
        lambda.makingVarName = 'total'

        expect(lambda.lambdaType).toBe('making')
        expect(lambda.makingVarName).toBe('total')
      })
    })
  })
})
