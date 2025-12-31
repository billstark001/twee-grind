import { BuiltinChangerNode, CodeHookNode, LinkNode, MacroMetadata, PassageFlowNode, TextFlowNode, UnclosedBuiltinChangerNode, VariableNode } from "../../markup/types";
import { ASTVisitor, ASTWalker, ASTWalkerOptions } from "../../utils/ast-walker";
import { ChangerVariable, CodeHookVariable, CommandVariable, EvaluationContext, ExecutionContext, HarloweCustomDataType, HarloweDataType, HarloweEngineVariable } from "../types";
import { evaluateArithmetic } from "./eval-helpers";
import * as m from "./eval-macro";

interface PassageFlowContext {
  withChanger?: string;
  changers: string[];
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
  allowHtmlScriptNode?: boolean; // Whether to allow <script> HTML tags in passage flow
  stopParameterEvaluationOnError?: boolean; // Whether to stop evaluating further parameters on first error
  stopMacroEvaluationOnError?: boolean; // Whether to stop macro evaluation entirely on first error
}

const DEFAULT_PASSAGE_FLOW_EXECUTOR_OPTIONS: PassageFlowExecutorOptions = {
  allowHtmlScriptNode: false,
  stopParameterEvaluationOnError: false,
  stopMacroEvaluationOnError: false,
};

const DEFAULT_AST_WALKER_OPTIONS: ASTWalkerOptions = {
  skipNodeTypes: new Set(['macro', 'codeHook']), // to prevent repeated set creation
}

export class PassageFlowExecutor {

  private readonly context: ExecutionContext;
  private readonly options: Readonly<PassageFlowExecutorOptions>;

  private readonly walkerStacks: {
    hook: CodeHookNode;
    walker: ASTWalker;
    context: PassageFlowContext;
  }[];
  private readonly visitorFunction: ASTVisitor;
  private remainingTask?: PassageFlowExecutionTask;

  private get lastWalkerState() {
    return this.walkerStacks[this.walkerStacks.length - 1];
  }

  constructor(context: ExecutionContext, options?: PassageFlowExecutorOptions) {
    this.context = context;
    this.options = { ...DEFAULT_PASSAGE_FLOW_EXECUTOR_OPTIONS, ...options };
    this.walkerStacks = [];
    this.visitorFunction = ({ node, entering, parent, index }) => {
      const isRoot = parent == null;
      this.stepNewNode(node as PassageFlowNode, entering, isRoot);
    }
  }

  // #region Changers

  startChanger(name: string, args?: any): void {
    this.context.passageRenderer.enterChanger(name, args);
    this.lastWalkerState.context.changers.push(name);
  }

  endChanger(name: string): void {
    const lastChanger = this.lastWalkerState.context.changers.pop();
    if (lastChanger !== name) {
      throw new Error(`Mismatched changer end: expected ${lastChanger}, got ${name}`);
    }
    this.context.passageRenderer.exitChanger(name);
  }

  stepBuiltinChanger(node: BuiltinChangerNode | UnclosedBuiltinChangerNode): void {
    const { changer: name, data: args } = node;
    this.startChanger(name, args);
  }

  stepChanger(val: ChangerVariable, attachedHook?: CodeHookNode): void {
    const { macroName, ...args } = val;
    this.startChanger('custom', { macroName, args });
    if (attachedHook) {
      this.createHookWalker(attachedHook, 'custom');
    }
  }

  // #endregion

  // #region Functional Variables

  stepCommand(val: CommandVariable): void {
    // TODO
  }

  // #endregion

  // #region Variables

  private stepVariableNode(node: VariableNode): void {

  }

  private stepVariable(val: HarloweEngineVariable, attachedHook?: CodeHookNode): void {
    const varType: HarloweDataType | undefined = (val as any)?.[HarloweCustomDataType];
    switch (varType) {
      case 'Changer':
        this.stepChanger(val as ChangerVariable, attachedHook);
        break;
      case 'Command':
        this.stepCommand(val as CommandVariable);
        break;
      case 'CodeHook':
        this.createHookWalker((val as CodeHookVariable).value);
        break;
      default:
        if (val != null) {
          // null means the macro has no result
          this.stepGeneralVariable(val);
        }
    }
  }

  // #endregion

  // #region Macro Execution

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
    if (topState.phase !== 'end') {
      return; // Macro still in body phase, need to evaluate
    }

    // Macro is in end phase, commit result
    const result = topState.evaluatedResult;
    stack.pop();

    if (stack.length > 0) {
      return; // Parent macro will continue evaluation
    }

    const { chainedMacros, chainedResults, attachedHook } = this.remainingTask;
    // All macros evaluated, commit final result
    if (chainedMacros != null && chainedMacros.length > 0) {
      // Start next chained macro
      const nextMacro = chainedMacros.shift()!;
      this.remainingTask.chainedResults = chainedResults ?? [];
      this.remainingTask.chainedResults.push(result!);
      stack.push(m.createMacroEvaluationState(nextMacro));
      return;
    }

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

    // If stack is not empty, parent macro will continue evaluation
  }

  commitMacroResult(evaluationResult: HarloweEngineVariable): void {
    if (this.remainingTask?.type !== 'macroEvaluation') {
      throw new Error('No macro evaluation in progress to commit result for');
    }

    m.commitMacroResult(this.remainingTask.stack, evaluationResult);
  }

  // #endregion

  stepGeneralVariable(val: HarloweEngineVariable): void {
    // TODO
  }

  stepLink(node: LinkNode): void {
    this.context.passageRenderer.pushLink(node.text, node.passage);
  }

  stepText(node: TextFlowNode): void {
    for (const child of node.children) {
      if (child.type === 'text') {
        this.context.passageRenderer.pushText(child.content);
      } else if (child.type === 'textElement') {
        this.context.passageRenderer.pushTextElement(child.element);
      }
    }
  }

  createHookWalker(node: CodeHookNode, withChanger?: string): void {
    // Start a new AST walker for this hook
    const walker = new ASTWalker(this.visitorFunction, DEFAULT_AST_WALKER_OPTIONS);
    walker.start(node);
    this.walkerStacks.push({
      hook: node,
      walker,
      context: {
        withChanger,
        changers: [],
      },
    });
  }

  destroyHookWalker(): void {
    const walker = this.walkerStacks.pop();
    if (!walker) {
      throw new Error('No hook walker to destroy');
    }
    const { changers, withChanger } = walker.context;
    while (changers.length > 0) {
      const changerName = changers.pop()!;
      this.context.passageRenderer.exitChanger(changerName);
    }
    if (withChanger) {
      this.context.passageRenderer.exitChanger(withChanger);
    }
  }

  startHook(node: CodeHookNode): void {
    this.context.passageRenderer.enterHook(node.name);
  }

  endHook(node: CodeHookNode): void {
    this.context.passageRenderer.exitHook();
  }

  stepNewNode(node: PassageFlowNode, entering: boolean, isRoot: boolean): void {
    switch (node.type) {
      case 'builtinChanger':
      case 'unclosedBuiltinChanger':
        if (entering) {
          this.stepBuiltinChanger(node);
        } else {
          this.endChanger(node.changer);
        }
        break;
      case 'link':
        if (entering) {
          this.stepLink(node);
        }
        break;
      case 'textFlow':
        if (entering) {
          this.stepText(node);
        }
        break;
      case 'codeHook':
        if (isRoot) {
          // the first & last event of a hook walker
          entering ? this.startHook(node) : this.endHook(node);
        } else {
          // the event that creates/destroys a hook walker
          entering ? this.createHookWalker(node) : this.destroyHookWalker();
        }
        break;
      case 'macro':
        if (entering) {
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
        }
        break;
      case 'htmlTag':
        if (entering) {
          if (
            !this.options.allowHtmlScriptNode
            && node.tag.toLowerCase().trim() === 'script'
          ) {
            console.warn('HTML <script> tags are not allowed in this context.');
          } else {
            this.context.passageRenderer.pushHtmlTag(node.tag, node.content);
          }
        }
        break;
      case 'variable':
        if (entering) {
          this.stepVariableNode(node);
        }
        break;
      default:
        throw new Error(`Unknown PassageFlowNode type: ${(node as any).type}`);
    }
  }

  step(): void {
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
    this.lastWalkerState.walker.step();
  }
}