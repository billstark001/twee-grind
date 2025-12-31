import { BuiltinChangerNode, CodeHookNode, LinkNode, MacroMetadata, MacroNode, PassageFlowNode, TextFlowNode, UnclosedBuiltinChangerNode } from "../../markup/types";
import { ChangerVariable, CodeHookVariable, CommandVariable, EvaluationContext, HarloweCustomDataType, HarloweDataType, HarloweEngineVariable } from "../types";
import * as e from "./eval";

interface ChangerHandler {
  // Applies the changer to the given content and returns the modified content
  apply(content: string, data?: any): string
}


interface MacroEvaluationState {
  node: MacroMetadata,
  phase: 'parameter' | 'body' | 'end';
  evaluatedResult?: HarloweEngineVariable;
  evaluatedParameters: HarloweEngineVariable[];
  currentParameterIndex: number; // the first index that is not yet completely evaluated
  currentParameterEvaluationState?: e.EvaluationState; // state specific to evaluating the current parameter
}

function createMacroEvaluationState(node: MacroMetadata): MacroEvaluationState {
  return {
    node,
    phase: 'parameter',
    evaluatedParameters: [],
    currentParameterIndex: 0,
  };
}

interface PassageFlowExecutionTask {
  type: 'macroEvaluation';
  stack: MacroEvaluationState[]; // Stack of macro states, top should always be phase=body or phase=end
}


export interface PassageFlowExecutorOptions {
  // Potential options for executor behavior can be added here
  stopParameterEvaluationOnError?: boolean; // Whether to stop evaluating further parameters on first error
  stopMacroEvaluationOnError?: boolean; // Whether to stop macro evaluation entirely on first error
}

const DEFAULT_PASSAGE_FLOW_EXECUTOR_OPTIONS: PassageFlowExecutorOptions = {
  stopParameterEvaluationOnError: false,
  stopMacroEvaluationOnError: false,
};

export class PassageFlowExecutor {

  private readonly options: Readonly<PassageFlowExecutorOptions>;

  private remainingTask?: PassageFlowExecutionTask;

  constructor(options?: PassageFlowExecutorOptions) {
    this.options = { ...DEFAULT_PASSAGE_FLOW_EXECUTOR_OPTIONS, ...options };
  }


  // #region Changers

  stepBuiltinChanger(node: BuiltinChangerNode | UnclosedBuiltinChangerNode): void {

  }

  stepChanger(val: ChangerVariable): void {

  }

  // #endregion

  // #region Functional Variables

  stepCommand(val: CommandVariable): void {

  }

  // #endregion

  // #region Macro Execution

  getEvaluationContext(): EvaluationContext {
    // TODO: implement context retrieval
    return null!;
  }

  /**
   * Evaluate a single parameter
   * @returns 'complete' if parameter evaluation is complete, 
   *          'needMacro' if a nested macro needs to be evaluated (with the macro state),
   *          'error' if an error occurred
   */
  private evaluateParameter(
    state: MacroEvaluationState,
    param: any,
    context: EvaluationContext
  ): { status: 'complete' } | { status: 'needMacro'; macroState: MacroEvaluationState } | { status: 'error'; error: HarloweEngineVariable } {
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
  private processParameters(stack: MacroEvaluationState[], context: EvaluationContext): void {
    const state = stack[stack.length - 1];
    const { node, currentParameterIndex } = state;

    // Evaluate parameters one by one
    while (currentParameterIndex < node.args.length) {
      const param = node.args[currentParameterIndex];
      const result = this.evaluateParameter(state, param, context);

      if (result.status === 'needMacro') {
        // Push nested macro onto stack for evaluation
        // The nested macro starts in 'parameter' phase, but we'll immediately
        // process it to ensure stack top reaches 'body' or 'end'
        stack.push(result.macroState);
        return; // Exit and let stepMacroStack handle the nested macro
      }

      if (result.status === 'error' && this.options.stopParameterEvaluationOnError) {
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
  private resumeParameterEvaluation(state: MacroEvaluationState, macroResult: HarloweEngineVariable): void {
    const evalState = state.currentParameterEvaluationState;
    if (evalState) {
      e.resumeEvaluation(evalState, macroResult);
    }
  }

  /**
   * Step through the macro evaluation stack
   * Ensures that the stack top is always in phase=body or phase=end
   */
  private stepMacroStack(stack: MacroEvaluationState[]): void {
    if (stack.length === 0) {
      return;
    }

    const context = this.getEvaluationContext();

    // Process stack until top element is in body or end phase
    while (stack.length > 0) {
      const state = stack[stack.length - 1];

      switch (state.phase) {
        case 'parameter': {
          this.processParameters(stack, context);

          // If a nested macro was pushed, we need to continue processing
          // Otherwise, the current state has moved to 'body' phase
          if (stack[stack.length - 1] !== state) {
            // A nested macro was pushed, continue loop to process it
            continue;
          }

          // Current state moved to 'body', continue to process body
          break;
        }

        case 'body': {
          const mightBeError = state.evaluatedParameters.find(x => (x as any)?.[HarloweCustomDataType] === 'Error');
          if (mightBeError && this.options.stopMacroEvaluationOnError) {
            // If any parameter is an error and we should stop, set result to error
            state.evaluatedResult = mightBeError;
            state.phase = 'end';
            break;
          } else {
            // TODO call some external macro evaluator to get the result
          }
          // Now in 'end' phase, check if we need to pop and resume parent
          break;
        }

        case 'end': {
          // Macro evaluation complete
          const result = state.evaluatedResult;
          stack.pop();

          if (stack.length > 0) {
            // Resume parent macro's parameter evaluation
            const parentState = stack[stack.length - 1];
            this.resumeParameterEvaluation(parentState, result!);
            // Continue processing parent
            continue;
          }

          // Stack is empty, evaluation complete
          return;
        }
      }

      // If top of stack is now in 'body' or 'end' phase, we can return
      // (the invariant is maintained)
      const topState = stack[stack.length - 1];
      if (topState && (topState.phase === 'body' || topState.phase === 'end')) {
        return;
      }
    }
  }

  private stepMacroResult(evaluationResult: HarloweEngineVariable | null | undefined): void {
    const varType: HarloweDataType | undefined = (evaluationResult as any)?.[HarloweCustomDataType];
    switch (varType) {
      case 'Changer':
        this.stepChanger(evaluationResult as ChangerVariable);
        break;
      case 'Command':
        this.stepCommand(evaluationResult as CommandVariable);
        break;
      case 'CodeHook':
        this.stepHook((evaluationResult as CodeHookVariable).value);
        break;
      default:
        if (evaluationResult != null) {
          // null means the macro has no result
          this.stepVariable(evaluationResult);
        }
    }
  }

  private handleMacroResult(): void {
    if (this.remainingTask?.type === 'macroEvaluation') {
      const stack = this.remainingTask.stack;
      if (stack.length === 0) {
        // Stack is empty, macro evaluation complete
        this.remainingTask = undefined;
        return;
      }

      const topState = stack[stack.length - 1];
      if (topState.phase === 'end') {
        const result = topState.evaluatedResult;
        stack.pop();

        if (stack.length === 0) {
          // All macros evaluated, commit final result
          this.remainingTask = undefined;
          this.stepMacroResult(result);
        }
        // If stack is not empty, parent macro will continue evaluation
      }
    }
  }

  commitMacroResult(evaluationResult: HarloweEngineVariable): void {
    if (this.remainingTask?.type !== 'macroEvaluation') {
      throw new Error('No macro evaluation in progress to commit result for');
    }
    if (this.remainingTask.stack.length === 0) {
      throw new Error('Macro evaluation stack is empty');
    }

    const topState = this.remainingTask.stack[this.remainingTask.stack.length - 1];
    if (topState.phase !== 'body') {
      throw new Error('Top of macro evaluation stack is not in body phase');
    }

    // Commit the result and move to end phase
    topState.evaluatedResult = evaluationResult;
    topState.phase = 'end';
  }

  // #endregion

  stepVariable(val: HarloweEngineVariable): void {

  }

  stepLink(node: LinkNode): void {

  }

  stepText(node: TextFlowNode): void {

  }

  stepHook(node: CodeHookNode): void {

  }


  step(node: PassageFlowNode): void {
    if (this.remainingTask != null) {
      switch (this.remainingTask.type) {
        case 'macroEvaluation':
          this.stepMacroStack(this.remainingTask.stack);
          this.handleMacroResult();
          break;
      }
      return;
    }
    switch (node.type) {
      case 'builtinChanger':
      case 'unclosedBuiltinChanger':
        this.stepBuiltinChanger(node);
        break;
      case 'link':
        this.stepLink(node);
        break;
      case 'textFlow':
        this.stepText(node);
        break;
      case 'codeHook':
        this.stepHook(node);
        break;
      case 'macro':
        this.remainingTask = {
          type: 'macroEvaluation',
          stack: [createMacroEvaluationState(node)],
        }
        this.stepMacroStack(this.remainingTask.stack);
        this.handleMacroResult();
        break;
    }
  }
}