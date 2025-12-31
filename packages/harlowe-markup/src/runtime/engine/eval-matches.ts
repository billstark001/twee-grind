import type {
  HarloweEngineVariable,
  DatatypeVariable,
  DatatypeKeyword,
} from '../types'
import { HarloweCustomDataType } from '../types'
import { matchesDatatype } from '../std/datatype'
import { deepEqual } from './eval-helpers'

// #region Pattern Type Definitions

/**
 * Pattern variable type for advanced pattern matching
 * Represents patterns like (p: ...) or (pattern: ...)
 */
export interface PatternVariable {
  [HarloweCustomDataType]: 'Pattern'
  patternType: 'array' | 'datamap' | 'dataset' | 'regex' | 'datatype'
  pattern: any // The actual pattern definition
}

/**
 * Regex pattern variable type
 * Wraps RegExp as a Harlowe datatype
 */
export interface RegexDatatypeVariable {
  [HarloweCustomDataType]: 'RegexDatatype'
  regex: RegExp
}

// #endregion

// #region Pattern Matching Core

/**
 * Advanced pattern matching for Harlowe values
 * Supports:
 * - Array pattern matching: (a:2,3) matches (a: num, num)
 * - Nested patterns: (a: array) matches (a:(a: ))
 * - Datamap patterns: (dm:"Love",2) matches (dm: "Love", num)
 * - Dataset patterns: (ds:2,3) matches (ds: 3, num)
 * - Datatype matching
 * - Regex patterns
 */
export function advancedMatches(
  value: HarloweEngineVariable,
  pattern: HarloweEngineVariable
): boolean {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return pattern === null || pattern === undefined
  }

  // 1. Regex pattern matching
  if (pattern instanceof RegExp) {
    return pattern.test(String(value))
  }

  // 2. RegexDatatype matching
  if (isRegexDatatype(pattern)) {
    return pattern.regex.test(String(value))
  }

  // 3. Pattern variable matching
  if (isPattern(pattern)) {
    return matchPattern(value, pattern)
  }

  // 4. Datatype keyword matching
  if (isDatatype(pattern)) {
    return matchesDatatype(value, pattern.datatype)
  }

  // 5. Array pattern matching: [1, 2, 3] matches [num, num, num]
  if (Array.isArray(pattern) && Array.isArray(value)) {
    return matchArrayPattern(value, pattern)
  }

  // 6. Map pattern matching
  if (pattern instanceof Map && value instanceof Map) {
    return matchMapPattern(value, pattern)
  }

  // 7. Set pattern matching
  if (pattern instanceof Set && value instanceof Set) {
    return matchSetPattern(value, pattern)
  }

  // 8. String datatype keyword matching (only if value is not a string, or if pattern is a known keyword)
  if (typeof pattern === 'string') {
    // Check if pattern is a datatype keyword
    const keyword = pattern.toLowerCase() as DatatypeKeyword
    // Only treat as keyword if it's a known datatype keyword and value is not matching string
    if (typeof value === 'string' && value === pattern) {
      // Exact string match takes precedence
      return true
    }
    // Otherwise try datatype matching
    return matchesDatatype(value, keyword)
  }

  // 9. Exact equality fallback
  return deepEqual(value, pattern)
}

/**
 * Match an array against an array pattern
 * Example: [2, 3] matches [num, num]
 * Example: [[1, 2]] matches [[num, num]]
 */
function matchArrayPattern(value: any[], pattern: any[]): boolean {
  // Check length - pattern must match value length exactly
  if (value.length !== pattern.length) {
    return false
  }

  // Match each element
  for (let i = 0; i < pattern.length; i++) {
    if (!advancedMatches(value[i], pattern[i])) {
      return false
    }
  }

  return true
}

/**
 * Match a Map (datamap) against a Map pattern
 * Example: Map([["Love", 2], ["Fear", 4]]) matches Map([["Love", num], ["Fear", num]])
 */
function matchMapPattern(value: Map<any, any>, pattern: Map<any, any>): boolean {
  // Pattern must have same or fewer keys
  if (pattern.size > value.size) {
    return false
  }

  // Each pattern key must exist in value with matching value
  for (const [patternKey, patternValue] of pattern.entries()) {
    if (!value.has(patternKey)) {
      return false
    }
    const actualValue = value.get(patternKey)
    if (!advancedMatches(actualValue, patternValue)) {
      return false
    }
  }

  return true
}

/**
 * Match a Set (dataset) against a Set pattern
 * Example: Set([2, 3]) matches Set([3, num])
 * Note: Order doesn't matter in sets, but we need to find a matching element for each pattern
 */
function matchSetPattern(value: Set<any>, pattern: Set<any>): boolean {
  // Pattern must have same or fewer elements
  if (pattern.size > value.size) {
    return false
  }

  // For each pattern element, find at least one matching value element
  for (const patternElement of pattern) {
    let found = false
    for (const valueElement of value) {
      if (advancedMatches(valueElement, patternElement)) {
        found = true
        break
      }
    }
    if (!found) {
      return false
    }
  }

  return true
}

/**
 * Match value against a Pattern variable
 */
function matchPattern(value: HarloweEngineVariable, pattern: PatternVariable): boolean {
  switch (pattern.patternType) {
    case 'array':
      return Array.isArray(value) && matchArrayPattern(value, pattern.pattern)
    case 'datamap':
      return value instanceof Map && matchMapPattern(value, pattern.pattern)
    case 'dataset':
      return value instanceof Set && matchSetPattern(value, pattern.pattern)
    case 'regex':
      return pattern.pattern.test(String(value))
    case 'datatype':
      return matchesDatatype(value, pattern.pattern)
    default:
      return false
  }
}

// #endregion

// #region Type Guards

/**
 * Check if value is a Pattern variable
 */
export function isPattern(value: HarloweEngineVariable): value is PatternVariable {
  return (
    typeof value === 'object' &&
    value !== null &&
    HarloweCustomDataType in value &&
    value[HarloweCustomDataType] === 'Pattern'
  )
}

/**
 * Check if value is a RegexDatatype variable
 */
export function isRegexDatatype(value: HarloweEngineVariable): value is RegexDatatypeVariable {
  return (
    typeof value === 'object' &&
    value !== null &&
    HarloweCustomDataType in value &&
    value[HarloweCustomDataType] === 'RegexDatatype'
  )
}

/**
 * Check if value is a Datatype variable
 */
export function isDatatype(value: HarloweEngineVariable): value is DatatypeVariable {
  return (
    typeof value === 'object' &&
    value !== null &&
    HarloweCustomDataType in value &&
    value[HarloweCustomDataType] === 'Datatype'
  )
}

// #endregion

// #region Pattern Creation Helpers

/**
 * Create an array pattern
 */
export function createArrayPattern(elements: any[]): PatternVariable {
  return {
    [HarloweCustomDataType]: 'Pattern',
    patternType: 'array',
    pattern: elements,
  }
}

/**
 * Create a datamap pattern
 */
export function createDatamapPattern(map: Map<any, any>): PatternVariable {
  return {
    [HarloweCustomDataType]: 'Pattern',
    patternType: 'datamap',
    pattern: map,
  }
}

/**
 * Create a dataset pattern
 */
export function createDatasetPattern(set: Set<any>): PatternVariable {
  return {
    [HarloweCustomDataType]: 'Pattern',
    patternType: 'dataset',
    pattern: set,
  }
}

/**
 * Create a regex pattern
 */
export function createRegexPattern(regex: RegExp): PatternVariable {
  return {
    [HarloweCustomDataType]: 'Pattern',
    patternType: 'regex',
    pattern: regex,
  }
}

/**
 * Create a datatype pattern
 */
export function createDatatypePattern(datatype: DatatypeKeyword): PatternVariable {
  return {
    [HarloweCustomDataType]: 'Pattern',
    patternType: 'datatype',
    pattern: datatype,
  }
}

/**
 * Create a RegexDatatype variable
 */
export function createRegexDatatype(regex: RegExp): RegexDatatypeVariable {
  return {
    [HarloweCustomDataType]: 'RegexDatatype',
    regex,
  }
}

// #endregion
