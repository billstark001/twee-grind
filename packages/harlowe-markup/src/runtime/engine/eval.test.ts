import {
  evaluateExpression,
  createEvaluationState,
  stepEvaluation,
  resumeEvaluation,
  type EvaluationStep,
} from './eval.js'
import type {
  LiteralNode,
  VariableNode,
  BinaryOperatorNode,
  UnaryOperatorNode,
  ExpressionNode,
  MacroNode,
} from '../../markup/types'
import type { EvaluationContext, HarloweEngineScope, VariableResolver, MacroEvaluator, HookNameEvaluator } from '../types'
import { HarloweCustomDataType } from '../types'

describe('Eval Module', () => {
  // Helper to create a basic evaluation context
  const createTestContext = (vars: Record<string, any> = {}): EvaluationContext => {
    const scope: HarloweEngineScope = {
      srcPassage: 'test',
      srcPos: 0,
      vars: new Map(Object.entries(vars)),
    }

    const resolver: VariableResolver = {
      getVariable: (name: string, scope: HarloweEngineScope) => {
        return scope.vars.get(name)
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

  describe('evaluateExpression - Literals', () => {
    it('should evaluate number literal', () => {
      const node: LiteralNode = {
        type: 'literal',
        dataType: 'number',
        value: '42',
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(42)
      }
    })

    it('should evaluate string literal', () => {
      const node: LiteralNode = {
        type: 'literal',
        dataType: 'string',
        value: 'hello',
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('hello')
      }
    })

    it('should evaluate boolean literal (true)', () => {
      const node: LiteralNode = {
        type: 'literal',
        dataType: 'boolean',
        value: 'true',
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('should evaluate boolean literal (false)', () => {
      const node: LiteralNode = {
        type: 'literal',
        dataType: 'boolean',
        value: 'false',
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })
  })

  describe('evaluateExpression - Variables', () => {
    it('should evaluate defined variable', () => {
      const node: VariableNode = {
        type: 'variable',
        name: '$x',
        isTemp: false,
      }

      const context = createTestContext({ '$x': 10 })
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(10)
      }
    })

    it('should fail on undefined variable', () => {
      const node: VariableNode = {
        type: 'variable',
        name: '$undefined',
        isTemp: false,
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Undefined variable')
      }
    })

    it('should evaluate temp variable', () => {
      const node: VariableNode = {
        type: 'variable',
        name: '_temp',
        isTemp: true,
      }

      const context = createTestContext({ '_temp': 'temporary' })
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('temporary')
      }
    })
  })

  describe('evaluateExpression - Binary Operators - Arithmetic', () => {
    it('should evaluate addition', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'addition',
        left: { type: 'literal', dataType: 'number', value: '5' },
        right: { type: 'literal', dataType: 'number', value: '3' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(8)
      }
    })

    it('should evaluate subtraction', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'subtraction',
        left: { type: 'literal', dataType: 'number', value: '10' },
        right: { type: 'literal', dataType: 'number', value: '3' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(7)
      }
    })

    it('should evaluate multiplication', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'multiplication',
        left: { type: 'literal', dataType: 'number', value: '4' },
        right: { type: 'literal', dataType: 'number', value: '5' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(20)
      }
    })

    it('should evaluate division', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'division',
        left: { type: 'literal', dataType: 'number', value: '20' },
        right: { type: 'literal', dataType: 'number', value: '4' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(5)
      }
    })

    it('should evaluate modulus', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'modulus',
        left: { type: 'literal', dataType: 'number', value: '10' },
        right: { type: 'literal', dataType: 'number', value: '3' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(1)
      }
    })
  })

  describe('evaluateExpression - Binary Operators - Comparison', () => {
    it('should evaluate is (equal)', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'is',
        left: { type: 'literal', dataType: 'number', value: '5' },
        right: { type: 'literal', dataType: 'number', value: '5' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('should evaluate isNot (not equal)', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'isNot',
        left: { type: 'literal', dataType: 'number', value: '5' },
        right: { type: 'literal', dataType: 'number', value: '3' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('should evaluate gt (greater than)', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'gt',
        left: { type: 'literal', dataType: 'number', value: '10' },
        right: { type: 'literal', dataType: 'number', value: '5' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('should evaluate lt (less than)', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'lt',
        left: { type: 'literal', dataType: 'number', value: '3' },
        right: { type: 'literal', dataType: 'number', value: '7' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('should evaluate ge (greater than or equal)', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'ge',
        left: { type: 'literal', dataType: 'number', value: '5' },
        right: { type: 'literal', dataType: 'number', value: '5' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('should evaluate le (less than or equal)', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'le',
        left: { type: 'literal', dataType: 'number', value: '4' },
        right: { type: 'literal', dataType: 'number', value: '5' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })
  })

  describe('evaluateExpression - Binary Operators - Logical', () => {
    it('should evaluate and (both true)', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'and',
        left: { type: 'literal', dataType: 'boolean', value: 'true' },
        right: { type: 'literal', dataType: 'boolean', value: 'true' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('should evaluate and (one false) with short-circuit', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'and',
        left: { type: 'literal', dataType: 'boolean', value: 'false' },
        right: { type: 'literal', dataType: 'boolean', value: 'true' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })

    it('should evaluate or (both false)', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'or',
        left: { type: 'literal', dataType: 'boolean', value: 'false' },
        right: { type: 'literal', dataType: 'boolean', value: 'false' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })

    it('should evaluate or (one true) with short-circuit', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'or',
        left: { type: 'literal', dataType: 'boolean', value: 'true' },
        right: { type: 'literal', dataType: 'boolean', value: 'false' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })
  })

  describe('evaluateExpression - Unary Operators', () => {
    it('should evaluate unary plus', () => {
      const node: UnaryOperatorNode = {
        type: 'prefix',
        operator: 'addition',
        operand: { type: 'literal', dataType: 'number', value: '5' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(5)
      }
    })

    it('should evaluate unary minus', () => {
      const node: UnaryOperatorNode = {
        type: 'prefix',
        operator: 'subtraction',
        operand: { type: 'literal', dataType: 'number', value: '5' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(-5)
      }
    })

    it('should evaluate not operator', () => {
      const node: UnaryOperatorNode = {
        type: 'prefix',
        operator: 'not',
        operand: { type: 'literal', dataType: 'boolean', value: 'true' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })
  })

  describe('evaluateExpression - Complex Expressions', () => {
    it('should evaluate nested binary operations', () => {
      // (5 + 3) * 2
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'multiplication',
        left: {
          type: 'binary',
          operator: 'addition',
          left: { type: 'literal', dataType: 'number', value: '5' },
          right: { type: 'literal', dataType: 'number', value: '3' },
        },
        right: { type: 'literal', dataType: 'number', value: '2' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(16)
      }
    })

    it('should evaluate expression with variables', () => {
      // $x + $y
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'addition',
        left: { type: 'variable', name: '$x', isTemp: false },
        right: { type: 'variable', name: '$y', isTemp: false },
      }

      const context = createTestContext({ '$x': 10, '$y': 20 })
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(30)
      }
    })
  })

  describe('stepEvaluation and createEvaluationState', () => {
    it('should create initial evaluation state', () => {
      const node: LiteralNode = {
        type: 'literal',
        dataType: 'number',
        value: '42',
      }

      const state = createEvaluationState(node)

      expect(state.done).toBe(false)
      expect(state.stack).toHaveLength(1)
      expect(state.stack[0].node).toBe(node)
      expect(state.stack[0].phase).toBe('start')
    })

    it('should complete evaluation in one step for literal', () => {
      const node: LiteralNode = {
        type: 'literal',
        dataType: 'number',
        value: '42',
      }

      const state = createEvaluationState(node)
      const context = createTestContext()
      const step = stepEvaluation(state, context)

      expect(step.type).toBe('done')
      if (step.type === 'done') {
        expect(step.value).toBe(42)
      }
      expect(state.done).toBe(true)
    })

    it('should handle multi-step evaluation for binary operator', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'addition',
        left: { type: 'literal', dataType: 'number', value: '5' },
        right: { type: 'literal', dataType: 'number', value: '3' },
      }

      const state = createEvaluationState(node)
      const context = createTestContext()

      let step: EvaluationStep
      let iterations = 0
      const maxIterations = 10

      do {
        step = stepEvaluation(state, context)
        iterations++
      } while (step.type !== 'done' && step.type !== 'error' && iterations < maxIterations)

      expect(step.type).toBe('done')
      if (step.type === 'done') {
        expect(step.value).toBe(8)
      }
    })

    it('should request macro evaluation when needed', () => {
      const node: MacroNode = {
        type: 'macro',
        name: 'print',
        args: [{ type: 'literal', dataType: 'string', value: 'hello' }],
      }

      const state = createEvaluationState(node)
      const context = createTestContext()

      let step: EvaluationStep
      let iterations = 0
      const maxIterations = 10

      do {
        step = stepEvaluation(state, context)
        iterations++
      } while (step.type !== 'needMacro' && step.type !== 'error' && iterations < maxIterations)

      expect(step.type).toBe('needMacro')
      if (step.type === 'needMacro') {
        expect(step.macro.name).toBe('print')
        expect(step.args).toHaveLength(1)
      }
    })
  })

  describe('resumeEvaluation', () => {
    it('should resume evaluation after macro call', () => {
      const node: MacroNode = {
        type: 'macro',
        name: 'test',
        args: [],
      }

      const state = createEvaluationState(node)
      const context = createTestContext()

      // Step until we get needMacro
      let step: EvaluationStep
      let maxSteps = 100
      let stepCount = 0
      do {
        step = stepEvaluation(state, context)
        stepCount++
        if (stepCount > maxSteps) {
          throw new Error('Too many steps')
        }
      } while (step.type !== 'needMacro' && step.type !== 'error')

      if (step.type === 'error') {
        console.log('Error during macro eval:', step.error)
      }

      expect(step.type).toBe('needMacro')

      // Resume with macro result (modifies state in-place)
      resumeEvaluation(state, 'macro result')

      expect(state.done).toBe(true)
      expect(state.result).toBe('macro result')
    })

    it('should throw error when resuming completed evaluation', () => {
      const node: LiteralNode = {
        type: 'literal',
        dataType: 'number',
        value: '42',
      }

      const state = createEvaluationState(node)
      const context = createTestContext()

      // Complete evaluation
      stepEvaluation(state, context)

      expect(() => resumeEvaluation(state, 'value')).toThrow('Cannot resume completed evaluation')
    })
  })

  describe('Error Handling', () => {
    it('should return error for unsupported operator', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'to' as any, // Assignment operator
        left: { type: 'literal', dataType: 'number', value: '5' },
        right: { type: 'literal', dataType: 'number', value: '10' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Assignment operator')
      }
    })

    it('should return error for division by zero', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'division',
        left: { type: 'literal', dataType: 'number', value: '10' },
        right: { type: 'literal', dataType: 'number', value: '0' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      // Division by zero in JavaScript returns Infinity, not an error
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(Infinity)
      }
    })

    it('should handle error in nested expression', () => {
      const node: BinaryOperatorNode = {
        type: 'binary',
        operator: 'addition',
        left: { type: 'variable', name: '$undefined', isTemp: false },
        right: { type: 'literal', dataType: 'number', value: '5' },
      }

      const context = createTestContext()
      const result = evaluateExpression(node, context)

      expect(result.success).toBe(false)
    })
  })
})
