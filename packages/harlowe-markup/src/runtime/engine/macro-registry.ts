import type { HarloweEngineVariable, HarloweEngineScope } from '../types'
import { HarloweCustomDataType } from '../types'

// #region Macro Types

/**
 * Macro function signature
 * All parameters are HarloweEngineVariable
 * Can return:
 * - void (no output)
 * - HarloweEngineVariable (direct value)
 * - MacroAsyncResult (async/serializable/resumable - for save/prompt)
 */
export type MacroFunction = (
  args: HarloweEngineVariable[],
  scope: HarloweEngineScope
) => HarloweEngineVariable | MacroAsyncResult | void

/**
 * Async/serializable/resumable macro result
 * Used for macros that need to be interrupted (e.g., prompt for user input)
 * or need to support save/load functionality
 */
export interface MacroAsyncResult {
  [HarloweCustomDataType]: 'MacroAsyncResult'
  /**
   * Unique identifier for this async operation
   * Used to resume the operation after save/load
   */
  asyncId: string
  /**
   * Type of async operation
   */
  asyncType: 'prompt' | 'wait' | 'custom'
  /**
   * Serializable state for this operation
   * Must be JSON-serializable for save/load support
   */
  state: Record<string, any>
  /**
   * Optional continuation function to resume the operation
   * Should be re-attachable after deserialization
   */
  continuation?: (result: HarloweEngineVariable) => HarloweEngineVariable | void
}

/**
 * Macro definition
 */
export interface MacroDefinition {
  /**
   * Macro name (without parentheses or colon)
   */
  name: string
  /**
   * Macro implementation function
   */
  fn: MacroFunction
  /**
   * Optional description for documentation
   */
  description?: string
  /**
   * Optional parameter count validation
   */
  minArgs?: number
  maxArgs?: number
}

// #endregion

// #region Macro Registry

/**
 * Global macro registry
 * Stores all registered macros
 */
class MacroRegistry {
  private macros: Map<string, MacroDefinition> = new Map()

  /**
   * Register a macro
   */
  register(definition: MacroDefinition): void {
    const normalizedName = definition.name.toLowerCase()
    if (this.macros.has(normalizedName)) {
      throw new Error(`Macro '${definition.name}' is already registered`)
    }
    this.macros.set(normalizedName, definition)
  }

  /**
   * Unregister a macro
   */
  unregister(name: string): boolean {
    const normalizedName = name.toLowerCase()
    return this.macros.delete(normalizedName)
  }

  /**
   * Get a macro definition
   */
  get(name: string): MacroDefinition | undefined {
    const normalizedName = name.toLowerCase()
    return this.macros.get(normalizedName)
  }

  /**
   * Check if a macro is registered
   */
  has(name: string): boolean {
    const normalizedName = name.toLowerCase()
    return this.macros.has(normalizedName)
  }

  /**
   * Get all registered macro names
   */
  list(): string[] {
    return Array.from(this.macros.keys())
  }

  /**
   * Clear all registered macros
   */
  clear(): void {
    this.macros.clear()
  }

  /**
   * Get the total count of registered macros
   */
  count(): number {
    return this.macros.size
  }
}

/**
 * Singleton macro registry instance
 */
export const macroRegistry = new MacroRegistry()

// #endregion

// #region Macro Invocation

/**
 * Invoke a registered macro
 * @param name Macro name
 * @param args Arguments to pass to the macro
 * @param scope Current scope
 * @returns Macro result or undefined
 */
export function invokeMacro(
  name: string,
  args: HarloweEngineVariable[],
  scope: HarloweEngineScope
): HarloweEngineVariable | MacroAsyncResult | void {
  const macro = macroRegistry.get(name)
  if (!macro) {
    throw new Error(`Macro '${name}' is not registered`)
  }

  // Validate argument count if specified
  if (macro.minArgs !== undefined && args.length < macro.minArgs) {
    throw new Error(
      `Macro '${name}' requires at least ${macro.minArgs} arguments, got ${args.length}`
    )
  }
  if (macro.maxArgs !== undefined && args.length > macro.maxArgs) {
    throw new Error(
      `Macro '${name}' accepts at most ${macro.maxArgs} arguments, got ${args.length}`
    )
  }

  // Invoke the macro
  return macro.fn(args, scope)
}

// #endregion

// #region Helper Functions

/**
 * Check if a value is a MacroAsyncResult
 */
export function isMacroAsyncResult(value: any): value is MacroAsyncResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    HarloweCustomDataType in value &&
    value[HarloweCustomDataType] === 'MacroAsyncResult'
  )
}

/**
 * Create a macro async result for prompt operations
 */
export function createPromptAsyncResult(
  asyncId: string,
  promptMessage: string,
  continuation?: (result: HarloweEngineVariable) => HarloweEngineVariable | void
): MacroAsyncResult {
  return {
    [HarloweCustomDataType]: 'MacroAsyncResult',
    asyncId,
    asyncType: 'prompt',
    state: { promptMessage },
    continuation,
  }
}

/**
 * Create a macro async result for wait operations
 */
export function createWaitAsyncResult(
  asyncId: string,
  duration: number,
  continuation?: (result: HarloweEngineVariable) => HarloweEngineVariable | void
): MacroAsyncResult {
  return {
    [HarloweCustomDataType]: 'MacroAsyncResult',
    asyncId,
    asyncType: 'wait',
    state: { duration },
    continuation,
  }
}

/**
 * Create a custom macro async result
 */
export function createCustomAsyncResult(
  asyncId: string,
  state: Record<string, any>,
  continuation?: (result: HarloweEngineVariable) => HarloweEngineVariable | void
): MacroAsyncResult {
  return {
    [HarloweCustomDataType]: 'MacroAsyncResult',
    asyncId,
    asyncType: 'custom',
    state,
    continuation,
  }
}

// #endregion
