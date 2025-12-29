import {
  HarloweEngineScope,
  HarloweEngineVariable,
  HarloweCustomDataType,
  HarloweScope,
} from '../types'

// Serialized scope structure
export type SerializedScope = {
  id: number
  srcPassage: string | null
  srcPos: number
  vars: Record<string, any>
  parentId: number | null
}

export type SerializedScopeGraph = {
  scopes: SerializedScope[]
  rootId: number
}

// Symbol string representations
const SYMBOL_CUSTOM_DATA_TYPE = '__HarloweCustomDataType__'
const SYMBOL_SCOPE = '__HarloweScope__'
const SYMBOL_TYPE = '__type__'

/**
 * Serialize a HarloweEngineScope and all its parent scopes into a JSON-serializable structure
 */
export function serializeScope(scope: HarloweEngineScope): SerializedScopeGraph {
  // Step 1: Collect all scopes and assign IDs
  const scopeToId = new Map<HarloweEngineScope, number>()
  const scopes: HarloweEngineScope[] = []

  let currentScope: HarloweEngineScope | undefined = scope
  let currentId = 0

  while (currentScope) {
    if (!scopeToId.has(currentScope)) {
      scopeToId.set(currentScope, currentId++)
      scopes.push(currentScope)
    }
    currentScope = currentScope.parent
  }

  // Step 2: Serialize each scope
  const serializedScopes: SerializedScope[] = scopes.map(s => {
    const id = scopeToId.get(s)!
    const parentId = s.parent ? scopeToId.get(s.parent) ?? null : null

    // Serialize variables in this scope
    const vars: Record<string, any> = {}
    for (const [key, value] of s.vars.entries()) {
      vars[key] = serializeVariable(value, scopeToId)
    }

    return {
      id,
      srcPassage: s.srcPassage,
      srcPos: s.srcPos,
      vars,
      parentId,
    }
  })

  return {
    scopes: serializedScopes,
    rootId: scopeToId.get(scope)!,
  }
}

/**
 * Serialize a single HarloweEngineVariable
 */
function serializeVariable(
  value: HarloweEngineVariable,
  scopeToId: Map<HarloweEngineScope, number>
): any {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value
  }

  // Handle primitives
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(v => serializeVariable(v, scopeToId))
  }

  // Handle Map
  if (value instanceof Map) {
    const entries: Array<[any, any]> = []
    for (const [k, v] of value.entries()) {
      entries.push([
        serializeVariable(k, scopeToId),
        serializeVariable(v, scopeToId),
      ])
    }
    return {
      __type__: 'Map',
      entries,
    }
  }

  // Handle Set
  if (value instanceof Set) {
    const values: any[] = []
    for (const v of value.values()) {
      values.push(serializeVariable(v, scopeToId))
    }
    return {
      __type__: 'Set',
      values,
    }
  }

  // Handle objects with custom data types
  if (typeof value === 'object' && value !== null) {
    const customType = (value as any)[HarloweCustomDataType]
    const scopeRef = (value as any)[HarloweScope]

    const serialized: Record<string, any> = {}

    // Store custom data type if present
    if (customType !== undefined) {
      serialized[SYMBOL_CUSTOM_DATA_TYPE] = customType
    } else {
      serialized[SYMBOL_TYPE] = 'Object'
    }

    // Store scope reference as ID if present
    if (scopeRef !== undefined && scopeRef !== null) {
      const scopeId = scopeToId.get(scopeRef)
      if (scopeId !== undefined) {
        serialized[SYMBOL_SCOPE] = scopeId
      } else {
        // If scope not found in map, we need to handle this case
        // For now, serialize the scope inline (should not happen in practice)
        serialized[SYMBOL_SCOPE] = null
      }
    }

    // Serialize all own properties
    for (const key of Object.keys(value)) {
      const prop = (value as any)[key]
      serialized[key] = serializeVariable(prop, scopeToId)
    }

    return serialized
  }

  // Fallback: return as-is (might not be serializable)
  return value
}

/**
 * Deserialize a SerializedScopeGraph back into a HarloweEngineScope
 */
export function deserializeScope(graph: SerializedScopeGraph): HarloweEngineScope {
  // Step 1: Create all scope objects without parent links
  const idToScope = new Map<number, HarloweEngineScope>()

  for (const serialized of graph.scopes) {
    const scope: HarloweEngineScope = {
      srcPassage: serialized.srcPassage,
      srcPos: serialized.srcPos,
      vars: new Map(),
      parent: undefined, // Will be linked later
    }
    idToScope.set(serialized.id, scope)
  }

  // Step 2: Link parents and deserialize variables
  for (const serialized of graph.scopes) {
    const scope = idToScope.get(serialized.id)!

    // Link parent
    if (serialized.parentId !== null) {
      scope.parent = idToScope.get(serialized.parentId)
    }

    // Deserialize variables
    for (const [key, value] of Object.entries(serialized.vars)) {
      scope.vars.set(key, deserializeVariable(value, idToScope))
    }
  }

  // Step 3: Return the root scope
  return idToScope.get(graph.rootId)!
}

/**
 * Deserialize a single variable
 */
function deserializeVariable(
  value: any,
  idToScope: Map<number, HarloweEngineScope>
): HarloweEngineVariable {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value
  }

  // Handle primitives
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(v => deserializeVariable(v, idToScope))
  }

  // Handle objects
  if (typeof value === 'object') {
    // Handle Map
    if (value.__type__ === 'Map') {
      const map = new Map()
      for (const [k, v] of value.entries) {
        map.set(
          deserializeVariable(k, idToScope),
          deserializeVariable(v, idToScope)
        )
      }
      return map
    }

    // Handle Set
    if (value.__type__ === 'Set') {
      const set = new Set()
      for (const v of value.values) {
        set.add(deserializeVariable(v, idToScope))
      }
      return set
    }

    if (value.__type__ === 'Object') {
      const obj: Record<string, any> = {}
      for (const key of Object.keys(value)) {
        if (key !== SYMBOL_TYPE) {
          obj[key] = deserializeVariable(value[key], idToScope)
        }
      }
      return obj
    }

    // Handle objects with custom types
    const result: Record<string | symbol, any> = {}

    // Restore symbol properties
    if (value[SYMBOL_CUSTOM_DATA_TYPE] !== undefined) {
      result[HarloweCustomDataType] = value[SYMBOL_CUSTOM_DATA_TYPE]
    }

    if (value[SYMBOL_SCOPE] !== undefined && value[SYMBOL_SCOPE] !== null) {
      const scope = idToScope.get(value[SYMBOL_SCOPE])
      if (scope) {
        result[HarloweScope] = scope
      }
    }

    // Restore all other properties
    for (const key of Object.keys(value)) {
      if (key !== SYMBOL_CUSTOM_DATA_TYPE && key !== SYMBOL_SCOPE && key !== SYMBOL_TYPE) {
        result[key] = deserializeVariable(value[key], idToScope)
      }
    }

    return result as HarloweEngineVariable
  }

  // Fallback
  return value
}
