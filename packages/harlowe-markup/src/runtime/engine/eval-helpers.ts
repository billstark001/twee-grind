import type { HarloweEngineVariable, DatatypeKeyword } from '../types'
import { isDatatype, matchesDatatype } from '../std/datatype'

// #region Property Access 

type PropertyIndexSpec =
  | { type: 'single'; index: number }
  | { type: 'range'; start: number; end: number }

/**
 * Property name patterns for array indexing
 */
const ORDINAL_PATTERN = /^(\d+)(?:st|nd|rd|th)(Last)?$/i
const ORDINAL_RANGE_PATTERN = /^(\d+)(?:st|nd|rd|th)(Last)?To(\d+)(?:st|nd|rd|th)(Last)?$/i
const LAST_PATTERN = /^last$/i
const LAST_TO_PATTERN = /^lastTo(\d+)(?:st|nd|rd|th)(Last)?$/i
const TO_LAST_PATTERN = /^(\d+)(?:st|nd|rd|th)(Last)?ToLast$/i

function parseIndex(indexStr: string, isLast: string | undefined): number {
  const index = parseInt(indexStr, 10)
  return isLast ? -index : index - 1 // Convert to 0-based
}

/**
 * Parse property name for special array index syntax
 * @returns Index number(s) or null if not a special syntax
 */
function parsePropertyIndex(
  propertyName: string
): PropertyIndexSpec | null {
  // Single ordinal: "1st", "2nd", "3rd", "4th"
  const ordinalMatch = propertyName.match(ORDINAL_PATTERN)
  if (ordinalMatch) {
    const [_, indexStr, isLast] = ordinalMatch
    return { type: 'single', index: parseIndex(indexStr, isLast) }
  }

  // Range: "1stTo4th"
  const rangeMatch = propertyName.match(ORDINAL_RANGE_PATTERN)
  if (rangeMatch) {
    const [_, startStr, startIsLast, endStr, endIsLast] = rangeMatch
    return {
      type: 'range',
      start: parseIndex(startStr, startIsLast),
      end: parseIndex(endStr, endIsLast)
    }
  }

  // Last index
  if (LAST_PATTERN.test(propertyName)) {
    return { type: 'single', index: -1 }
  }

  // "lastTo4th" - from end to specific position
  const lastToMatch = propertyName.match(LAST_TO_PATTERN)
  if (lastToMatch) {
    const [_, endStr, endIsLast] = lastToMatch
    return {
      type: 'range',
      start: -1,
      end: parseIndex(endStr, endIsLast),
    }
  }

  // "4thToLast" - from specific position to end
  const toLastMatch = propertyName.match(TO_LAST_PATTERN)
  if (toLastMatch) {
    const [_, startStr, startIsLast] = toLastMatch
    return {
      type: 'range',
      start: parseIndex(startStr, startIsLast),
      end: -1,
    }
  }

  return null
}

/**
 * Access property on a value
 * Handles special array index syntax and standard property access
 */
export function accessProperty(target: HarloweEngineVariable, property: string): HarloweEngineVariable | undefined {
  // Try special array index syntax first
  const indexSpec = parsePropertyIndex(property)

  if (indexSpec) {
    if (Array.isArray(target)) {
      const arr = target as any[]
      const resolveIndex = (idx: number) => (idx < 0 ? arr.length + idx : idx)

      if (indexSpec.type === 'single') {
        const idx = resolveIndex(indexSpec.index)
        return arr[idx]
      } else {
        const start = resolveIndex(indexSpec.start)
        const end = resolveIndex(indexSpec.end)
        return arr.slice(start, end + 1)
      }
    } else if (typeof target === 'string') {
      const str = target as string
      const resolveIndex = (idx: number) => (idx < 0 ? str.length + idx : idx)

      if (indexSpec.type === 'single') {
        const idx = resolveIndex(indexSpec.index)
        return str[idx] || ''
      } else {
        const start = resolveIndex(indexSpec.start)
        const end = resolveIndex(indexSpec.end)
        return str.slice(start, end + 1)
      }
    }
  }

  // Standard property access
  if (target && typeof target === 'object') {
    if (property in target) {
      return (target as any)[property]
    }
    // Check Map/Set
    if (target instanceof Map) {
      return target.get(property)
    }
  }

  return undefined
}

// #endregion

// #region Operator Evaluators

/**
 * Evaluate arithmetic operators
 */
export function evaluateArithmetic(
  operator: string,
  left: HarloweEngineVariable,
  right?: HarloweEngineVariable
): HarloweEngineVariable {
  const l = left as number
  const r = right as number

  switch (operator) {
    case 'addition':
      return right === undefined ? +l : l + r
    case 'subtraction':
      return right === undefined ? -l : l - r
    case 'multiplication':
      return l * r
    case 'division':
      return l / r
    case 'modulus':
      return l % r
    default:
      throw new Error(`Unknown arithmetic operator: ${operator}`)
  }
}

/**
 * Evaluate comparison operators
 */
export function evaluateComparison(
  operator: string,
  left: HarloweEngineVariable,
  right: HarloweEngineVariable
): boolean {
  switch (operator) {
    case 'is':
      return deepEqual(left, right)
    case 'isNot':
      return !deepEqual(left, right)
    case 'gt':
      return (left as number) > (right as number)
    case 'lt':
      return (left as number) < (right as number)
    case 'ge':
      return (left as number) >= (right as number)
    case 'le':
      return (left as number) <= (right as number)
    default:
      throw new Error(`Unknown comparison operator: ${operator}`)
  }
}

/**
 * Deep equality check for Harlowe values
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, idx) => deepEqual(item, b[idx]))
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false
    for (const item of a) {
      if (!b.has(item)) return false
    }
    return true
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false
    for (const [key, val] of a) {
      if (!b.has(key) || !deepEqual(val, b.get(key))) return false
    }
    return true
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) => deepEqual(a[key], b[key]))
  }

  return false
}

/**
 * Evaluate logical operators
 */
export function evaluateLogical(
  operator: string,
  left: HarloweEngineVariable,
  right?: HarloweEngineVariable
): boolean {
  switch (operator) {
    case 'and':
      return Boolean(left) && Boolean(right)
    case 'or':
      return Boolean(left) || Boolean(right)
    case 'not':
      return !Boolean(left)
    default:
      throw new Error(`Unknown logical operator: ${operator}`)
  }
}

/**
 * Evaluate membership operators (contains, isIn, etc.)
 */
export function evaluateMembership(
  operator: string,
  left: HarloweEngineVariable,
  right: HarloweEngineVariable
): boolean {
  switch (operator) {
    case 'contains':
      return contains(left, right)
    case 'doesNotContain':
      return !contains(left, right)
    case 'isIn':
      return contains(right, left)
    case 'isNotIn':
      return !contains(right, left)
    default:
      throw new Error(`Unknown membership operator: ${operator}`)
  }
}

/**
 * Check if container contains value
 */
export function contains(container: HarloweEngineVariable, value: HarloweEngineVariable): boolean {
  if (Array.isArray(container)) {
    return container.some((item) => deepEqual(item, value))
  }
  if (container instanceof Set) {
    return container.has(value)
  }
  if (container instanceof Map) {
    return container.has(value as any)
  }
  if (typeof container === 'string' && typeof value === 'string') {
    return container.includes(value)
  }
  if (typeof container === 'object' && container !== null) {
    return (value as any) in container
  }
  return false
}

/**
 * Evaluate pattern matching operators
 */
export function evaluateMatching(
  operator: string,
  left: HarloweEngineVariable,
  right: HarloweEngineVariable
): boolean {
  const result = matches(left, right)
  switch (operator) {
    case 'matches':
      return result
    case 'doesNotMatch':
      return !result
    default:
      throw new Error(`Unknown matching operator: ${operator}`)
  }
}

/**
 * Check if value matches pattern
 * Pattern can be a regex, datatype, or value
 */
export function matches(value: HarloweEngineVariable, pattern: HarloweEngineVariable): boolean {
  // Regex matching
  if (pattern instanceof RegExp) {
    return pattern.test(String(value))
  }

  // Datatype keyword matching
  if (typeof pattern === 'string') {
    const keyword = pattern.toLowerCase() as DatatypeKeyword
    return matchesDatatype(value, keyword)
  }

  // Equality fallback
  return deepEqual(value, pattern)
}

/**
 * Evaluate type checking operators
 */
export function evaluateTypeCheck(
  operator: string,
  left: HarloweEngineVariable,
  right: HarloweEngineVariable
): boolean {
  const result = isOfType(left, right)
  switch (operator) {
    case 'isA':
      return result
    case 'isNotA':
      return !result
    default:
      throw new Error(`Unknown type check operator: ${operator}`)
  }
}

/**
 * Check if value is of specified type
 */
export function isOfType(value: HarloweEngineVariable, typeSpec: HarloweEngineVariable): boolean {
  // Datatype keyword matching
  if (isDatatype(typeSpec)) {
    const keyword = typeSpec.datatype
    return matchesDatatype(value, keyword)
  }
  return false
}

// #endregion
