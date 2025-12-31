import { BuiltinChangerNode, CodeHookNode, LinkNode, MacroMetadata, PassageFlowNode, TextFlowNode, UnclosedBuiltinChangerNode } from "../../markup/types";
import { ChangerVariable, CodeHookVariable, CommandVariable, EvaluationContext, ExecutionContext, HarloweCustomDataType, HarloweDataType, HarloweEngineVariable } from "../types";
import { evaluateArithmetic } from "./eval-helpers";
import * as m from "./eval-macro";

interface PassageFlowContext {
  
}

interface PassageFlowExecutionTask {
  type: 'macroEvaluation';
  stack: m.MacroEvaluationState[]; // Stack of macro states, top should always be phase=body or phase=end
  chainedMacros?: MacroMetadata[]; // Macros to evaluate after the current one
  chainedResults?: HarloweEngineVariable[]; // Results of previously evaluated chained macros
  attachedHook?: CodeHookNode; // If the macro is attached to a hook, this is that hook
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

  private readonly context: ExecutionContext;
  private readonly options: Readonly<PassageFlowExecutorOptions>;

  private remainingTask?: PassageFlowExecutionTask;

  constructor(context: ExecutionContext, options?: PassageFlowExecutorOptions) {
    this.context = context;
    this.options = { ...DEFAULT_PASSAGE_FLOW_EXECUTOR_OPTIONS, ...options };
  }

  // #region Changers

  stepBuiltinChanger(node: BuiltinChangerNode | UnclosedBuiltinChangerNode): void {

  }

  stepChanger(val: ChangerVariable, attachedHook?: CodeHookNode): void {

  }

  // #endregion

  // #region Functional Variables

  stepCommand(val: CommandVariable): void {

  }

  // #endregion

  // #region Macro Execution

  private stepVariable(evaluationResult: HarloweEngineVariable, attachedHook?: CodeHookNode): void {
    const varType: HarloweDataType | undefined = (evaluationResult as any)?.[HarloweCustomDataType];
    switch (varType) {
      case 'Changer':
        this.stepChanger(evaluationResult as ChangerVariable, attachedHook);
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
          this.stepGeneralVariable(evaluationResult);
        }
    }
  }

  private handleMacroResult(): void {
    if (this.remainingTask?.type !== 'macroEvaluation') {
      throw new Error('No macro evaluation in progress to commit result for');
    }
    const { stack } = this.remainingTask;
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
        const { chainedMacros, chainedResults, attachedHook } = this.remainingTask;
        // All macros evaluated, commit final result
        if (chainedMacros != null && chainedMacros.length > 0) {
          // Start next chained macro
          const nextMacro = chainedMacros.shift()!;
          this.remainingTask.chainedResults = chainedResults ?? [];
          this.remainingTask.chainedResults.push(result!);
          stack.push(m.createMacroEvaluationState(nextMacro));
        } else {
          // No more macros, finish
          if (result == null) {
            // do nothing for null result
          } else if (!chainedResults || chainedResults.length === 0) {
            this.stepVariable(result, attachedHook);
          } else {
            const [firstResult, ...remainingResults] = chainedResults;
            remainingResults.push(result);
            let finalResult = firstResult;
            while (remainingResults.length > 0) {
              const chainedResult = remainingResults.pop()!;
              finalResult = evaluateArithmetic('addition', finalResult, chainedResult);
            }
            this.stepVariable(finalResult, attachedHook);
          }
          this.remainingTask = undefined;
        }

      }
      // If stack is not empty, parent macro will continue evaluation
    } else {
      // Top of stack is in body phase, need to evaluate macro
    }
  }

  commitMacroResult(evaluationResult: HarloweEngineVariable): void {
    if (this.remainingTask?.type !== 'macroEvaluation') {
      throw new Error('No macro evaluation in progress to commit result for');
    }

    m.commitMacroResult(this.remainingTask.stack, evaluationResult);
  }

  // #endregion

  stepGeneralVariable(val: HarloweEngineVariable): void {

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
        case 'macroEvaluation': {

          m.stepThroughMacroStack(
            this.remainingTask.stack,
            this.context,
            this.options
          );
          this.handleMacroResult();
          break;
        }
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
          stack: [m.createMacroEvaluationState(node)],
          chainedMacros: node.chainedMacros,
          attachedHook: node.attachedHook,
        };
        m.stepThroughMacroStack(
          this.remainingTask.stack,
          this.context,
          this.options
        );
        this.handleMacroResult();
        break;
    }
  }
}