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

export interface ExecutionContext extends EvaluationContext {
  macroEvaluator: MacroEvaluator
}
