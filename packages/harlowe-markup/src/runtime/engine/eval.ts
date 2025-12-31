import type {
  ExpressionNode,
  MacroNode,
  VariableNode,
  RawVariableNode,
  HookNameNode,
  LiteralNode,
  UnaryOperatorNode,
  BinaryOperatorNode,
  MacroMetadata,
} from '../../markup/types'
import { type HarloweEngineVariable, HarloweCustomDataType, PredefinedColorName, HookNameVariable, EvaluationContext } from '../types'
import { allPredefinedColors } from '../std/colour'
import {
  accessProperty,
  evaluateArithmetic,
  evaluateComparison,
  evaluateLogical,
  evaluateMembership,
  evaluateMatching,
  evaluateTypeCheck,
} from './eval-helpers'

// #region Types and Interfaces

/**
 * Evaluation result wrapper for error handling
 */
export type EvaluationResult =
  | { success: true; value: HarloweEngineVariable }
  | { success: false; error: string; node?: ExpressionNode }

/**
 * Frame in the evaluation stack
 */
interface EvaluationFrame {
  node: ExpressionNode
  phase: 'start' | 'evaluating' | 'complete'
  // For binary operators: track which operand we're evaluating
  binaryPhase?: 'left' | 'right'
  // For unary operators
  unaryPhase?: 'operand'
  // For macro: track argument evaluation
  macroPhase?: 'args' | 'call'
  argIndex?: number
  // Accumulated values
  leftValue?: HarloweEngineVariable
  rightValue?: HarloweEngineVariable
  operandValue?: HarloweEngineVariable
  argsValues?: HarloweEngineVariable[]
}

/**
 * Serializable evaluation state
 */
export interface EvaluationState {
  stack: EvaluationFrame[]
  done: boolean
  result?: HarloweEngineVariable
  error?: string
  errorNode?: ExpressionNode
}

/**
 * Step result - either completion, error, or need external operation
 */
export type EvaluationStep =
  | { type: 'done'; value: HarloweEngineVariable }
  | { type: 'error'; error: string; node?: ExpressionNode }
  | { type: 'needMacro'; macro: MacroMetadata; args: HarloweEngineVariable[] }

// #endregion

// #region Main Evaluator

/**
 * Create initial evaluation state for an expression
 */
export function createEvaluationState(node: ExpressionNode): EvaluationState {
  return {
    stack: [{ node, phase: 'start' }],
    done: false,
  }
}

/**
 * Resume evaluation with a macro result
 * Modifies the state in-place
 */
export function resumeEvaluation(
  state: EvaluationState,
  macroResult: HarloweEngineVariable
): void {
  if (state.done) {
    throw new Error('Cannot resume completed evaluation')
  }

  const topFrame = state.stack[state.stack.length - 1]
  if (!topFrame) {
    throw new Error('Invalid state: empty stack')
  }

  // Set the macro result as the frame's result
  topFrame.phase = 'complete'

  // Pop the frame (in-place modification)
  state.stack.pop()

  if (state.stack.length === 0) {
    // Evaluation complete
    state.done = true
    state.result = macroResult
    return
  }

  const parentFrame = state.stack[state.stack.length - 1]

  // Update parent frame with the result
  if (parentFrame.binaryPhase === 'left') {
    parentFrame.leftValue = macroResult
    parentFrame.binaryPhase = 'right'
  } else if (parentFrame.binaryPhase === 'right') {
    parentFrame.rightValue = macroResult
    parentFrame.phase = 'complete'
  } else if (parentFrame.unaryPhase === 'operand') {
    parentFrame.operandValue = macroResult
    parentFrame.phase = 'complete'
  } else if (parentFrame.macroPhase === 'args') {
    parentFrame.argsValues = parentFrame.argsValues || []
    parentFrame.argsValues.push(macroResult)
    const macroNode = parentFrame.node as MacroNode
    if (parentFrame.argsValues.length < macroNode.args.length) {
      parentFrame.argIndex = (parentFrame.argIndex || 0) + 1
    } else {
      parentFrame.macroPhase = 'call'
    }
  }
}

/**
 * Execute one step of evaluation
 * Returns either a final result, an error, or a request for external operation
 */
export function stepEvaluation(
  state: EvaluationState,
  context: EvaluationContext
): EvaluationStep {
  if (state.done) {
    if (state.error) {
      return { type: 'error', error: state.error, node: state.errorNode }
    }
    return { type: 'done', value: state.result! }
  }

  try {
    const frame = state.stack[state.stack.length - 1]
    if (!frame) {
      throw new Error('Invalid state: empty stack')
    }

    const node = frame.node

    // Start phase: determine what to do based on node type
    if (frame.phase === 'start') {
      switch (node.type) {
        case 'literal':
          frame.phase = 'complete'
          return continueEvaluation(state, context, evaluateLiteral(node as LiteralNode))

        case 'variable':
          frame.phase = 'complete'
          return continueEvaluation(state, context, evaluateVariable(node as VariableNode, context))

        case 'rawVariable':
          frame.phase = 'complete'
          return continueEvaluation(state, context, evaluateRawVariable(node as RawVariableNode, context))

        case 'hookName':
          frame.phase = 'complete'
          return continueEvaluation(state, context, evaluateHookName(node as HookNameNode, context))

        case 'macro': {
          const macroNode = node as MacroNode
          if (macroNode.args.length === 0) {
            // No args, call macro immediately
            frame.macroPhase = 'call'
            frame.argsValues = []
            frame.phase = 'evaluating'
            return stepEvaluation(state, context)
          } else {
            // Need to evaluate arguments
            frame.macroPhase = 'args'
            frame.argIndex = 0
            frame.argsValues = []
            frame.phase = 'evaluating'
            // Push first arg for evaluation
            state.stack.push({ node: macroNode.args[0], phase: 'start' })
            return stepEvaluation(state, context)
          }
        }

        case 'prefix':
        case 'postfix': {
          const unaryNode = node as UnaryOperatorNode
          frame.unaryPhase = 'operand'
          frame.phase = 'evaluating'
          // Push operand for evaluation
          state.stack.push({ node: unaryNode.operand, phase: 'start' })
          return stepEvaluation(state, context)
        }

        case 'binary': {
          const binaryNode = node as BinaryOperatorNode

          // Special handling for short-circuit operators
          if (binaryNode.operator === 'and' || binaryNode.operator === 'or') {
            frame.binaryPhase = 'left'
            frame.phase = 'evaluating'
            state.stack.push({ node: binaryNode.left, phase: 'start' })
            return stepEvaluation(state, context)
          }

          // Regular binary operators: evaluate both operands
          frame.binaryPhase = 'left'
          frame.phase = 'evaluating'
          state.stack.push({ node: binaryNode.left, phase: 'start' })
          return stepEvaluation(state, context)
        }

        default:
          throw new Error(`Unknown expression node type: ${(node as any).type}`)
      }
    }

    // Evaluating phase: handle intermediate states
    if (frame.phase === 'evaluating') {
      if (node.type === 'macro') {
        const macroNode = node as MacroNode
        if (frame.macroPhase === 'args') {
          // Continue evaluating arguments
          const argIndex = frame.argIndex || 0
          if (argIndex < macroNode.args.length) {
            state.stack.push({ node: macroNode.args[argIndex], phase: 'start' })
            return stepEvaluation(state, context)
          } else {
            // All args evaluated, ready to call macro
            frame.macroPhase = 'call'
            return stepEvaluation(state, context)
          }
        } else if (frame.macroPhase === 'call') {
          // Request macro evaluation
          const macroCall: MacroMetadata = {
            name: macroNode.name,
            args: macroNode.args,
          }
          return { type: 'needMacro', macro: macroCall, args: frame.argsValues || [] }
        }
      } else if (node.type === 'prefix' || node.type === 'postfix') {
        if (frame.unaryPhase === 'operand' && frame.operandValue !== undefined) {
          // Operand evaluated, compute result
          frame.phase = 'complete'
          const result = evaluateUnaryOperatorSync(node as UnaryOperatorNode, frame.operandValue, context)
          return continueEvaluation(state, context, result)
        }
      } else if (node.type === 'binary') {
        const binaryNode = node as BinaryOperatorNode

        if (frame.binaryPhase === 'left' && frame.leftValue !== undefined) {
          // Left evaluated, check for short-circuit
          if (binaryNode.operator === 'and' && !frame.leftValue) {
            frame.phase = 'complete'
            return continueEvaluation(state, context, false)
          }
          if (binaryNode.operator === 'or' && frame.leftValue) {
            frame.phase = 'complete'
            return continueEvaluation(state, context, true)
          }

          // Evaluate right operand
          frame.binaryPhase = 'right'
          state.stack.push({ node: binaryNode.right, phase: 'start' })
          return stepEvaluation(state, context)
        } else if (frame.binaryPhase === 'right' && frame.rightValue !== undefined) {
          // Both operands evaluated, compute result
          frame.phase = 'complete'
          const result = evaluateBinaryOperatorSync(
            binaryNode,
            frame.leftValue!,
            frame.rightValue,
            context
          )
          return continueEvaluation(state, context, result)
        }
      }
    }

    // Complete phase: pop frame and continue
    if (frame.phase === 'complete') {
      throw new Error('Frame marked complete but not handled')
    }

    throw new Error('Invalid evaluation state')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    state.done = true
    state.error = errorMsg
    state.errorNode = state.stack[state.stack.length - 1]?.node
    return { type: 'error', error: errorMsg, node: state.errorNode }
  }
}

/**
 * Continue evaluation after completing a node
 */
function continueEvaluation(
  state: EvaluationState,
  context: EvaluationContext,
  value: HarloweEngineVariable
): EvaluationStep {
  // Pop current frame
  state.stack.pop()

  if (state.stack.length === 0) {
    // Evaluation complete
    state.done = true
    state.result = value
    return { type: 'done', value }
  }

  // Update parent frame with the result
  const parentFrame = state.stack[state.stack.length - 1]

  if (parentFrame.binaryPhase === 'left') {
    parentFrame.leftValue = value
  } else if (parentFrame.binaryPhase === 'right') {
    parentFrame.rightValue = value
  } else if (parentFrame.unaryPhase === 'operand') {
    parentFrame.operandValue = value
  } else if (parentFrame.macroPhase === 'args') {
    parentFrame.argsValues = parentFrame.argsValues || []
    parentFrame.argsValues.push(value)
    const macroNode = parentFrame.node as MacroNode
    parentFrame.argIndex = (parentFrame.argIndex || 0) + 1
    if (parentFrame.argIndex >= macroNode.args.length) {
      parentFrame.macroPhase = 'call'
    }
  }

  // Continue with next step
  return stepEvaluation(state, context)
}

/**
 * Evaluate an expression node to a runtime value
 * This is a convenience wrapper that runs evaluation to completion
 * Note: This will throw if macro evaluation is needed
 * 
 * @param node Expression AST node to evaluate
 * @param context Evaluation context with dependencies
 * @returns Evaluation result
 */
export function evaluateExpression(
  node: ExpressionNode,
  context: EvaluationContext
): EvaluationResult {
  const state = createEvaluationState(node)

  while (!state.done) {
    const step = stepEvaluation(state, context)

    if (step.type === 'done') {
      return { success: true, value: step.value }
    } else if (step.type === 'error') {
      return { success: false, error: step.error, node: step.node }
    } else if (step.type === 'needMacro') {
      return {
        success: false,
        error: 'Macro evaluation required but not provided. Use stepEvaluation for async operations.',
        node: state.stack[state.stack.length - 1]?.node,
      }
    }
  }

  if (state.error) {
    return { success: false, error: state.error, node: state.errorNode }
  }

  return { success: true, value: state.result! }
}

/**
 * Evaluate literal node
 */
function evaluateLiteral(node: LiteralNode): HarloweEngineVariable {
  switch (node.dataType) {
    case 'number':
      return Number(node.value)
    case 'string':
      return String(node.value)
    case 'boolean':
      return node.value.toLowerCase() === 'true'
    case 'colour':
      return allPredefinedColors[node.value.toLowerCase() as any as PredefinedColorName]
    case 'datatype':
      return {
        [HarloweCustomDataType]: 'Datatype',
        datatype: node.value,
      }
    default:
      throw new Error(`Unknown literal data type: ${node.dataType}`)
  }
}

/**
 * Evaluate variable node
 */
function evaluateVariable(node: VariableNode, context: EvaluationContext): HarloweEngineVariable {
  const { name } = node
  const value = context.resolver.getVariable(name, context.scope)
  if (value === undefined) {
    throw new Error(`Undefined variable: ${name}`)
  }
  return value
}

/**
 * Evaluate raw variable (reserved words, properties)
 */
function evaluateRawVariable(
  node: RawVariableNode,
  context: EvaluationContext
): HarloweEngineVariable {
  const { name } = node

  // Check reserved values first
  if (context.reserved && name in context.reserved) {
    const value = context.reserved[name]
    if (value !== undefined) {
      return value
    }
  }

  return name
}

/**
 * Evaluate hook name node
 */
function evaluateHookName(node: HookNameNode, context: EvaluationContext): HookNameVariable {
  return context.hookNameEvaluator.evaluateHookName(node, context.scope)
}

/**
 * Evaluate unary operator (synchronous version)
 */
function evaluateUnaryOperatorSync(
  node: UnaryOperatorNode,
  operand: HarloweEngineVariable,
  context: EvaluationContext
): HarloweEngineVariable {
  const { operator } = node

  switch (operator) {
    case 'addition':
    case 'subtraction':
      return evaluateArithmetic(operator, operand)

    case 'not':
      return evaluateLogical(operator, operand)

    case 'spread':
      // Spread operator - return array/collection as-is for spreading
      if (Array.isArray(operand)) {
        return operand
      }
      throw new Error('Spread operator requires an array')

    case 'itsOperator': {
      // "its property" - property access on 'it'
      if (!context.reserved?.it) {
        throw new Error("'it' is not defined in this context")
      }
      // The operand should be a literal with property name
      const propertyName = (operand as any).name || String(operand)
      const propertyValue = accessProperty(context.reserved.it, propertyName)
      if (propertyValue === undefined) {
        throw new Error(`Property '${propertyName}' does not exist on 'it'`)
      }
      return propertyValue
    }

    default:
      throw new Error(`Unknown unary operator: ${operator}`)
  }
}

/**
 * Evaluate binary operator (synchronous version)
 */
function evaluateBinaryOperatorSync(
  node: BinaryOperatorNode,
  left: HarloweEngineVariable,
  right: HarloweEngineVariable,
  context: EvaluationContext
): HarloweEngineVariable {
  const { operator } = node

  switch (operator) {
    case 'addition':
    case 'subtraction':
    case 'multiplication':
    case 'division':
    case 'modulus':
      return evaluateArithmetic(operator, left, right)

    case 'is':
    case 'isNot':
    case 'gt':
    case 'lt':
    case 'ge':
    case 'le':
      return evaluateComparison(operator, left, right)

    case 'and':
    case 'or':
      return evaluateLogical(operator, left, right)

    case 'contains':
    case 'doesNotContain':
    case 'isIn':
    case 'isNotIn':
      return evaluateMembership(operator, left, right)

    case 'matches':
    case 'doesNotMatch':
      return evaluateMatching(operator, left, right)

    case 'isA':
    case 'isNotA':
      return evaluateTypeCheck(operator, left, right)

    case 'possessiveOperator':
    case 'belongingOperator': {
      // Property access: "x's property" or "property of x"
      const target = operator === 'possessiveOperator' ? left : right
      const propertyName = operator === 'possessiveOperator' ? right : left

      // Extract property name
      if (typeof propertyName !== 'string') {
        throw new Error('Property name must be a string or identifier')
      }
      const propertyValue = accessProperty(target, propertyName)
      if (propertyValue === undefined) {
        throw new Error(`Property '${propertyName}' does not exist on target`)
      }
      return propertyValue
    }

    case 'belongingItOperator': {
      // "property of it"
      if (!context.reserved?.it) {
        throw new Error("'it' is not defined in this context")
      }
      const propertyName = (left as any).name || String(left)
      const propertyValue = accessProperty(context.reserved.it, propertyName)
      if (propertyValue === undefined) {
        throw new Error(`Property '${propertyName}' does not exist on 'it'`)
      }
      return propertyValue
    }

    case 'comma':
      // Comma operator returns array of values
      return [left, right].flat()

    case 'to':
    case 'into':
      // Assignment operators - these should be handled by command execution
      throw new Error(`Assignment operator '${operator}' cannot be evaluated as expression`)

    case 'via':
    case 'where':
    case 'when':
    case 'making':
    case 'each':
    case 'bind':
      // These are special contextual operators handled by specific macros
      throw new Error(`Contextual operator '${operator}' requires macro context`)

    case 'typeSignature':
      // Type signature operator - creates typed variable
      // Should be handled at assignment level
      throw new Error('Type signature operator requires assignment context')

    default:
      throw new Error(`Unknown binary operator: ${operator}`)
  }
}

// #endregion
