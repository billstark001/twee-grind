import { MacroMetadata } from "../../markup/types";
import { EvaluationContext, HarloweCustomDataType, HarloweEngineVariable } from "../types";
import * as e from "./eval";

export interface MacroEvaluationState {
  node: MacroMetadata;
  phase: 'parameter' | 'body' | 'end';
  evaluatedResult?: HarloweEngineVariable;
  evaluatedParameters: HarloweEngineVariable[];
  currentParameterIndex: number; // the first index that is not yet completely evaluated
  currentParameterEvaluationState?: e.EvaluationState; // state specific to evaluating the current parameter
}

export interface MacroStackOptions {
  stopParameterEvaluationOnError?: boolean;
  stopMacroEvaluationOnError?: boolean;
}

export function createMacroEvaluationState(node: MacroMetadata): MacroEvaluationState {
  return {
    node,
    phase: 'parameter',
    evaluatedParameters: [],
    currentParameterIndex: 0,
  };
}

export type EvaluateParameterResult =
  | { status: 'complete' }
  | { status: 'needMacro'; macroState: MacroEvaluationState }
  | { status: 'error'; error: HarloweEngineVariable };

/**
 * Evaluate a single parameter
 * @returns 'complete' if parameter evaluation is complete, 
 *          'needMacro' if a nested macro needs to be evaluated (with the macro state),
 *          'error' if an error occurred
 */
function evaluateParameter(
  state: MacroEvaluationState,
  param: any,
  context: EvaluationContext
): EvaluateParameterResult {
  // Initialize evaluation state if needed
  if (!state.currentParameterEvaluationState) {
    state.currentParameterEvaluationState = e.createEvaluationState(param);
  }

  // Continue evaluating the parameter expression
  const evalState = state.currentParameterEvaluationState;
  const result = e.stepEvaluation(evalState, context);

  if (result.type === 'error') {
    // Store error as parameter value
    const errorValue: HarloweEngineVariable = {
      [HarloweCustomDataType]: 'Error',
      message: result.error,
    };
    state.evaluatedParameters.push(errorValue);
    return { status: 'error', error: errorValue };
  }

  if (result.type === 'needMacro') {
    // Need to evaluate a nested macro first - return the new macro state to be pushed onto stack
    const nestedMacroState = createMacroEvaluationState(result.macro);
    return { status: 'needMacro', macroState: nestedMacroState };
  }

  // Parameter evaluation complete
  state.evaluatedParameters.push(result.value);
  return { status: 'complete' };
}

/**
 * Process all parameters for a macro at the top of the stack
 * This ensures that when we move to body phase, all parameters are evaluated
 * and the state at stack top is always phase=body or phase=end
 */
function processParameters(
  stack: MacroEvaluationState[],
  context: EvaluationContext,
  options: MacroStackOptions
): void {
  const state = stack[stack.length - 1];
  const { node } = state;

  // Evaluate parameters one by one
  while (state.currentParameterIndex < node.args.length) {
    const param = node.args[state.currentParameterIndex];
    const result = evaluateParameter(state, param, context);

    if (result.status === 'needMacro') {
      // Push nested macro onto stack for evaluation
      // The nested macro starts in 'parameter' phase, but we'll immediately
      // process it to ensure stack top reaches 'body' or 'end'
      stack.push(result.macroState);
      return; // Exit and let stepMacroStack handle the nested macro
    }

    if (result.status === 'error' && options.stopParameterEvaluationOnError) {
      // Skip remaining parameters
      state.currentParameterIndex = node.args.length;
    } else {
      // Move to next parameter
      state.currentParameterIndex++;
    }

    state.currentParameterEvaluationState = undefined;
  }

  // All parameters evaluated, move to body phase
  state.phase = 'body';
  state.currentParameterEvaluationState = undefined;
}

/**
 * Resume parameter evaluation after a nested macro completes
 */
export function resumeParameterEvaluation(
  state: MacroEvaluationState,
  macroResult: HarloweEngineVariable
): void {
  const evalState = state.currentParameterEvaluationState;
  if (evalState) {
    e.resumeEvaluation(evalState, macroResult);
  }
}

export type StepThroughMacroStackResult =
  | { status: 'complete' }
  | { status: 'needMacroCall' };

/**
 * Step through the macro evaluation stack
 * Ensures that the stack top is always in phase=body or phase=end
 */
export function stepThroughMacroStack(
  stack: MacroEvaluationState[],
  context: EvaluationContext,
  options: MacroStackOptions
): StepThroughMacroStackResult {
  if (stack.length === 0) {
    return { status: 'complete' };
  }

  // Process stack until top element is in body or end phase
  const outMostState = stack[0];

  stackLoop: while (stack.length > 0) {
    const state = stack[stack.length - 1];

    if (state.phase === 'parameter') {
      processParameters(stack, context, options);
      // If a nested macro was pushed, we need to continue processing
      // Otherwise, the current state has moved to 'body' phase
      if (stack[stack.length - 1] !== state) {
        // A nested macro was pushed, continue loop to process it
        continue stackLoop;
      }
      // Else, current state moved to 'body', continue to process body
    }

    else if (state.phase === 'body') {
      const mightBeError = state.evaluatedParameters.find(x => (x as any)?.[HarloweCustomDataType] === 'Error');
      if (mightBeError && options.stopMacroEvaluationOnError) {
        // If any parameter is an error and we should stop, set result to error
        state.evaluatedResult = mightBeError;
        state.phase = 'end';
      } else {
        // Call some external macro evaluator to get the result
        break stackLoop;
      }
    }

    else { // the phase must be 'end'
      const result = state.evaluatedResult;
      stack.pop();
      if (stack.length > 0) {
        // Resume parent macro's parameter evaluation
        const parentState = stack[stack.length - 1];
        resumeParameterEvaluation(parentState, result!);
        // Continue processing parent
        continue stackLoop;
      }
      // Else, stack is empty, evaluation complete
    }
  }

  // If top of stack is now in 'body' or 'end' phase, we can return
  // (the invariant is maintained)
  let topState: MacroEvaluationState;
  if (stack.length === 0) {
    topState = outMostState;
    stack.unshift(outMostState);
  } else {
    topState = stack[stack.length - 1];
  }
  return {
    status: topState.phase === 'body' ? 'needMacroCall' : 'complete',
  }
}

/**
 * Commit a macro result and move to end phase
 */
export function commitMacroResult(
  stack: MacroEvaluationState[],
  evaluationResult: HarloweEngineVariable
): void {
  if (stack.length === 0) {
    throw new Error('Macro evaluation stack is empty');
  }

  const topState = stack[stack.length - 1];
  if (topState.phase !== 'body') {
    throw new Error('Top of macro evaluation stack is not in body phase');
  }

  // Commit the result and move to end phase
  topState.evaluatedResult = evaluationResult;
  topState.phase = 'end';
}