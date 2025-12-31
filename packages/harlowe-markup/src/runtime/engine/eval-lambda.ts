import type { ExpressionNode } from '../../markup/types'
import type { HarloweEngineVariable, LambdaVariable, HarloweEngineScope, EvaluationContext } from '../types'
import { HarloweCustomDataType, HarloweScope } from '../types'
import { evaluateExpression } from './eval'

/**
 * Create a lambda (anonymous function) variable
 * @param argNames Array of argument names
 * @param body Expression node representing the function body
 * @param scope Scope where the lambda was created (closure)
 */
export function createLambda(
  argNames: string[],
  body: ExpressionNode,
  scope: HarloweEngineScope
): LambdaVariable {
  return {
    [HarloweCustomDataType]: 'Lambda',
    [HarloweScope]: scope,
    argNames,
    body,
  }
}

/**
 * Invoke a lambda function with arguments
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

  // Create new scope for lambda execution
  const lambdaScope: HarloweEngineScope = {
    srcPassage: lambda[HarloweScope].srcPassage,
    srcPos: lambda[HarloweScope].srcPos,
    vars: new Map(),
    parent: lambda[HarloweScope], // Closure: parent is creation scope
  }

  // Bind arguments to parameter names in lambda scope
  for (let i = 0; i < lambda.argNames.length; i++) {
    lambdaScope.vars.set(lambda.argNames[i], args[i])
  }

  // Evaluate lambda body in new scope
  const lambdaContext: EvaluationContext = {
    ...context,
    scope: lambdaScope,
  }

  const result = evaluateExpression(lambda.body, lambdaContext)
  if (!result.success) {
    throw new Error(`Lambda evaluation failed: ${result.error}`)
  }

  return result.value
}

// Note: isLambda is available from '../std/datatype' and should be imported from there if needed
