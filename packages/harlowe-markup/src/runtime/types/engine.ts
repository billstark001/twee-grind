import { MacroMetadata, HookNameNode } from "../../markup/types";
import type { HarloweEngineVariable, HookNameVariable } from "./data-type";

/**
 * Engine scope type
 */
export type HarloweEngineScope = {
  srcPassage: string | null, // null for global scope
  srcPos: number, // the index in the source passage where this scope was created, 0 for global scope
  vars: Map<string, HarloweEngineVariable>,
  parent?: HarloweEngineScope,
}

/**
 * External dependency for variable resolution
 */
export interface VariableResolver {
  /**
   * Get variable value by name
   * @param name Variable name (with $ or _ prefix)
   * @param scope Current scope
   * @returns Variable value or undefined if not found
   */
  getVariable(name: string, scope: HarloweEngineScope): HarloweEngineVariable | undefined
}

/**
 * External dependency for hook name evaluation
 */
export interface HookNameEvaluator {
  /**
   * Evaluate a hook name node
   * @param node Hook name AST node
   * @param scope Current scope
   * @returns Hook name variable
   */
  evaluateHookName(node: HookNameNode, scope: HarloweEngineScope): HookNameVariable
}

/**
 * Reserved value injections for expression evaluation
 */
export type ReservedValues = {
  /** The 'it' keyword value in lambda contexts */
  it?: HarloweEngineVariable
  /** The 'time' keyword value for temporal operations */
  time?: HarloweEngineVariable
  /** The 'pos' keyword value for position-based operations */
  pos?: HarloweEngineVariable
  /** Other reserved keywords */
  [key: string]: HarloweEngineVariable | undefined
}

/**
 * Context for expression evaluation
 */
export interface EvaluationContext {
  scope: HarloweEngineScope
  reserved: ReservedValues
  resolver: VariableResolver
  hookNameEvaluator: HookNameEvaluator
}


/**
 * External dependency for macro evaluation
 * Macros can be interruptible (e.g., require user input)
 */
export interface MacroEvaluator {
  /**
   * Evaluate a macro call
   * @param macro Macro metadata including name and arguments
   * @param scope Current scope
   * @returns Promise that resolves to macro result
   */
  evaluateMacro(macro: MacroMetadata, scope: HarloweEngineScope): Promise<HarloweEngineVariable>
}

export interface GetCursorOptions<TCursor> {
  type: 'hookName' | 'string'
  range: TCursor
}


/**
 * Renderer interface for passage flow
 * Used to build the final output from passage content
 * 
 * e.g. 
 * 
 * (enchant: ?bold, (text-style: "bold")) would call
 *   - pushCursor("bold", "hookName")
 *   - applyChanger("custom", { attrs: { style: "font-weight: bold;" } })
 *   - popCursor()
 * 
 * [[Next->PassageName]] would call
 *   - pushLink("Next", "PassageName")
 */
export interface PassageFlowRenderer<TChangerArgs = any, TCursor = any> {
  pushText(text: string): void
  pushTextElement(element: string): void // br, hr, etc.
  pushLink(text: string, passage: string): void

  enterHook(hookName: string): TCursor
  exitHook(): void

  enterTag(name: string, attrs: Record<string, string>, children?: string): void
  exitTag(name: string): void

  enterChanger(name: string, args?: TChangerArgs): void
  exitChanger(name: string): void

  applyChanger(name: string, args?: TChangerArgs): void

  pushCursor(value: string, options: GetCursorOptions<TCursor>): void
  popCursor(): void
  getCursor(value: string, options: GetCursorOptions<TCursor>): TCursor
}

export interface ExecutionContext extends EvaluationContext {
  macroEvaluator: MacroEvaluator
  passageRenderer: PassageFlowRenderer<any, any>
}



