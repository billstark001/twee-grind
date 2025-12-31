import type { ExpressionNode } from '../../markup/types'
import type { HarloweEngineVariable, LambdaVariable, HarloweEngineScope, EvaluationContext } from '../types'
import { HarloweCustomDataType, HarloweScope } from '../types'
import { evaluateExpression } from './eval'

/**
 * Create a lambda (anonymous function) variable
 * @param argNames Array of argument names
 * @param body Expression node representing the function body
 * @param scope Scope where the lambda was created (closure)
 * @param lambdaType Optional lambda type (where, when, via, making, each)
 */
export function createLambda(
  argNames: string[],
  body: ExpressionNode,
  scope: HarloweEngineScope,
  lambdaType?: 'where' | 'when' | 'via' | 'making' | 'each'
): LambdaVariable {
  return {
    [HarloweCustomDataType]: 'Lambda',
    [HarloweScope]: scope,
    lambdaType,
    argNames,
    body,
  }
}

/**
 * Invoke a lambda function with arguments
 * Handles different lambda types: where, when, via, making, each
 * @param lambda Lambda variable to invoke
 * @param args Arguments to pass to the lambda
 * @param context Evaluation context
 * @returns Result of lambda evaluation
 */
export function invokeLambda(
  lambda: LambdaVariable,
  args: HarloweEngineVariable[],
  context: EvaluationContext
): HarloweEngineVariable {
  // Validate argument count
  if (args.length !== lambda.argNames.length) {
    throw new Error(
      `Lambda expects ${lambda.argNames.length} arguments, got ${args.length}`
    )
  }

  // Handle lambdas without body (each without via)
  if (!lambda.body) {
    // For 'each' lambdas without a body, just return the argument
    if (lambda.lambdaType === 'each') {
      return args[0]
    }
    throw new Error('Lambda has no body expression')
  }

  // Create new scope for lambda execution
  const lambdaScope: HarloweEngineScope = {
    srcPassage: lambda[HarloweScope]?.srcPassage || null,
    srcPos: lambda[HarloweScope]?.srcPos || 0,
    vars: new Map(),
    parent: lambda[HarloweScope], // Closure: parent is creation scope
  }

  // Bind arguments to parameter names in lambda scope
  for (let i = 0; i < lambda.argNames.length; i++) {
    lambdaScope.vars.set(lambda.argNames[i], args[i])
  }
  
  // For making lambdas, also bind the making variable if specified
  if (lambda.lambdaType === 'making' && lambda.makingVarName) {
    // Making variable is initialized to appropriate empty value
    // This would typically be provided by the macro using the lambda
    lambdaScope.vars.set(lambda.makingVarName, 0) // Default to 0, or passed from context
  }

  // Evaluate lambda body in new scope
  // For where/when lambdas, also set 'it' to the argument
  const lambdaContext: EvaluationContext = {
    ...context,
    scope: lambdaScope,
    reserved: {
      ...context.reserved,
      it: args[0], // 'it' refers to the current item
    }
  }

  const result = evaluateExpression(lambda.body, lambdaContext)
  if (!result.success) {
    throw new Error(`Lambda evaluation failed: ${result.error}`)
  }

  return result.value
}

/**
 * Create a LambdaEvaluator implementation for use in EvaluationContext
 * This allows eval-macro and other components to invoke lambdas through the context
 */
export function createLambdaEvaluator() {
  return {
    invokeLambda: (lambda: HarloweEngineVariable, args: HarloweEngineVariable[], context: EvaluationContext) => {
      if (!isLambda(lambda)) {
        throw new Error('Value is not a lambda')
      }
      return invokeLambda(lambda, args, context)
    }
  }
}

/**
 * Check if a value is a lambda (re-exported from std/datatype for convenience)
 */
function isLambda(value: HarloweEngineVariable): value is LambdaVariable {
  return (
    typeof value === 'object' &&
    value !== null &&
    HarloweCustomDataType in value &&
    value[HarloweCustomDataType] === 'Lambda'
  )
}

