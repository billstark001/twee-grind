import type { HarloweEngineScope, HarloweEngineVariable } from '../types'

// #region Scope Management

/**
 * Create a new scope
 * @param srcPassage Source passage name (null for global scope)
 * @param srcPos Source position in the passage (0 for global scope)
 * @param parent Optional parent scope for scope chaining
 */
export function createScope(
  srcPassage: string | null,
  srcPos: number,
  parent?: HarloweEngineScope
): HarloweEngineScope {
  return {
    srcPassage,
    srcPos,
    vars: new Map(),
    parent,
  }
}

/**
 * Create a global scope (root scope)
 */
export function createGlobalScope(): HarloweEngineScope {
  return createScope(null, 0)
}

/**
 * Create a child scope
 * @param parent Parent scope
 * @param srcPassage Source passage name
 * @param srcPos Source position
 */
export function createChildScope(
  parent: HarloweEngineScope,
  srcPassage: string,
  srcPos: number
): HarloweEngineScope {
  return createScope(srcPassage, srcPos, parent)
}

// #endregion

// #region Variable Access

/**
 * Get a variable value from scope hierarchy
 * Searches current scope and parent scopes
 * @param scope Current scope
 * @param name Variable name (with $ or _ prefix)
 * @returns Variable value or undefined if not found
 */
export function getVariable(
  scope: HarloweEngineScope,
  name: string
): HarloweEngineVariable | undefined {
  // Check current scope
  if (scope.vars.has(name)) {
    return scope.vars.get(name)
  }

  // Check parent scopes recursively
  if (scope.parent) {
    return getVariable(scope.parent, name)
  }

  return undefined
}

/**
 * Check if a variable exists in scope hierarchy
 * @param scope Current scope
 * @param name Variable name
 */
export function hasVariable(scope: HarloweEngineScope, name: string): boolean {
  return getVariable(scope, name) !== undefined
}

// #endregion

// #region Variable Setting

/**
 * Set a variable in the appropriate scope
 * For story variables ($var): set in global scope (root)
 * For temporary variables (_var): set in current scope
 * @param scope Current scope
 * @param name Variable name (with $ or _ prefix)
 * @param value Variable value
 */
export function setVariable(
  scope: HarloweEngineScope,
  name: string,
  value: HarloweEngineVariable
): void {
  // Determine if it's a temporary or permanent variable
  const isTemp = name.startsWith('_')

  if (isTemp) {
    // Temporary variables: set in current scope
    scope.vars.set(name, value)
  } else {
    // Story variables: set in global scope (root of hierarchy)
    const globalScope = findGlobalScope(scope)
    globalScope.vars.set(name, value)
  }
}

/**
 * Update an existing variable in its current scope
 * If variable doesn't exist, behaves like setVariable
 * @param scope Current scope
 * @param name Variable name
 * @param value New value
 */
export function updateVariable(
  scope: HarloweEngineScope,
  name: string,
  value: HarloweEngineVariable
): void {
  // Find the scope where the variable is defined
  const targetScope = findVariableScope(scope, name)

  if (targetScope) {
    // Update in the scope where it was found
    targetScope.vars.set(name, value)
  } else {
    // Variable doesn't exist, create it using normal rules
    setVariable(scope, name, value)
  }
}

/**
 * Delete a variable from scope
 * @param scope Current scope
 * @param name Variable name
 * @returns true if variable was deleted, false if not found
 */
export function deleteVariable(scope: HarloweEngineScope, name: string): boolean {
  const targetScope = findVariableScope(scope, name)
  if (targetScope) {
    return targetScope.vars.delete(name)
  }
  return false
}

// #endregion

// #region Scope Traversal

/**
 * Find the global (root) scope
 * @param scope Any scope in the hierarchy
 * @returns The root scope
 */
export function findGlobalScope(scope: HarloweEngineScope): HarloweEngineScope {
  let current = scope
  while (current.parent) {
    current = current.parent
  }
  return current
}

/**
 * Find the scope where a variable is defined
 * @param scope Starting scope
 * @param name Variable name
 * @returns The scope containing the variable, or undefined if not found
 */
export function findVariableScope(
  scope: HarloweEngineScope,
  name: string
): HarloweEngineScope | undefined {
  if (scope.vars.has(name)) {
    return scope
  }
  if (scope.parent) {
    return findVariableScope(scope.parent, name)
  }
  return undefined
}

/**
 * Get all variables visible in current scope (including parents)
 * @param scope Current scope
 * @returns Map of all visible variables
 */
export function getAllVariables(scope: HarloweEngineScope): Map<string, HarloweEngineVariable> {
  const allVars = new Map<string, HarloweEngineVariable>()

  // Collect variables from root to current scope (so current scope overrides parents)
  const scopes: HarloweEngineScope[] = []
  let current: HarloweEngineScope | undefined = scope
  while (current) {
    scopes.unshift(current) // Add to front
    current = current.parent
  }

  // Merge variables from root to current
  for (const s of scopes) {
    for (const [name, value] of s.vars.entries()) {
      allVars.set(name, value)
    }
  }

  return allVars
}

/**
 * Get depth of scope in hierarchy (0 for root)
 * @param scope Scope to measure
 */
export function getScopeDepth(scope: HarloweEngineScope): number {
  let depth = 0
  let current = scope.parent
  while (current) {
    depth++
    current = current.parent
  }
  return depth
}

// #endregion

// #region Scope Information

/**
 * Check if scope is global (root) scope
 */
export function isGlobalScope(scope: HarloweEngineScope): boolean {
  return scope.parent === undefined && scope.srcPassage === null
}

/**
 * Get information about a scope
 */
export interface ScopeInfo {
  depth: number
  isGlobal: boolean
  srcPassage: string | null
  srcPos: number
  varCount: number
  totalVisibleVars: number
}

/**
 * Get information about a scope
 */
export function getScopeInfo(scope: HarloweEngineScope): ScopeInfo {
  return {
    depth: getScopeDepth(scope),
    isGlobal: isGlobalScope(scope),
    srcPassage: scope.srcPassage,
    srcPos: scope.srcPos,
    varCount: scope.vars.size,
    totalVisibleVars: getAllVariables(scope).size,
  }
}

// #endregion
