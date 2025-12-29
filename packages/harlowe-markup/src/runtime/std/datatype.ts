import { HarloweDataType, HarloweEngineVariable, HarloweCustomDataType, DatatypeKeyword, LambdaVariable, CustomMacroVariable, DatatypeVariable, CodeHookVariable, GradientVariable, ColorVariable, ChangerVariable, CommandVariable } from "../types"


// #region Datatype Validation Functions

/**
 * Check if a value is a number
 */
export function isNumber(value: HarloweEngineVariable): value is number {
  return typeof value === 'number' && !isNaN(value)
}

/**
 * Check if a value is an even number
 */
export function isEven(value: HarloweEngineVariable): value is number {
  return isNumber(value) && value % 2 === 0
}

/**
 * Check if a value is an odd number
 */
export function isOdd(value: HarloweEngineVariable): value is number {
  return isNumber(value) && value % 2 !== 0
}

/**
 * Check if a value is an integer
 */
export function isInteger(value: HarloweEngineVariable): value is number {
  return isNumber(value) && Number.isInteger(value)
}

/**
 * Check if a value is a string
 */
export function isString(value: HarloweEngineVariable): value is string {
  return typeof value === 'string'
}

/**
 * Check if a value is empty (empty string, array, datamap, or dataset)
 */
export function isEmpty(value: HarloweEngineVariable): boolean {
  if (isString(value)) return value === ''
  if (isArray(value)) return value.length === 0
  if (isDatamap(value)) return value.size === 0
  if (isDataset(value)) return value.size === 0
  return false
}

/**
 * Check if a value is a single whitespace character
 */
export function isWhitespace(value: HarloweEngineVariable): value is string {
  return isString(value) && value.length === 1 && /\s/.test(value)
}

/**
 * Check if a value is a single lowercase character
 */
export function isLowercase(value: HarloweEngineVariable): value is string {
  return isString(value) && value.length === 1 && value.toLowerCase() !== value.toUpperCase() && value === value.toLowerCase()
}

/**
 * Check if a value is a single uppercase character
 */
export function isUppercase(value: HarloweEngineVariable): value is string {
  return isString(value) && value.length === 1 && value.toLowerCase() !== value.toUpperCase() && value === value.toUpperCase()
}

/**
 * Check if a value is a single case-sensitive character
 */
export function isAnycase(value: HarloweEngineVariable): value is string {
  return isString(value) && value.length === 1 && value.toLowerCase() !== value.toUpperCase()
}

/**
 * Check if a value is a single alphanumeric character
 */
export function isAlphanumeric(value: HarloweEngineVariable): value is string {
  return isString(value) && value.length === 1 && /[a-zA-Z0-9]/.test(value)
}

/**
 * Check if a value is a single digit character
 */
export function isDigit(value: HarloweEngineVariable): value is string {
  return isString(value) && value.length === 1 && /[0-9]/.test(value)
}

/**
 * Check if a value is a linebreak/newline character
 */
export function isLinebreak(value: HarloweEngineVariable): value is string {
  return isString(value) && (value === '\n' || value === '\r' || value === '\r\n')
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(value: HarloweEngineVariable): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Check if a value is an array
 */
export function isArray(value: HarloweEngineVariable): value is any[] {
  return Array.isArray(value)
}

/**
 * Check if a value is a datamap (Map)
 */
export function isDatamap(value: HarloweEngineVariable): value is Map<string, any> {
  return value instanceof Map
}

/**
 * Check if a value is a dataset (Set)
 */
export function isDataset(value: HarloweEngineVariable): value is Set<any> {
  return value instanceof Set
}

/**
 * Check if a value is a specific custom datatype
 */
export function isCustomDataType(value: HarloweEngineVariable, type: HarloweDataType): boolean {
  return typeof value === 'object' && value !== null && HarloweCustomDataType in value && value[HarloweCustomDataType] === type
}

/**
 * Check if a value is a Command
 */
export function isCommand(value: HarloweEngineVariable): value is CommandVariable {
  return isCustomDataType(value, 'Command')
}

/**
 * Check if a value is a Changer
 */
export function isChanger(value: HarloweEngineVariable): value is ChangerVariable {
  return isCustomDataType(value, 'Changer')
}

/**
 * Check if a value is a Colour
 */
export function isColour(value: HarloweEngineVariable): value is ColorVariable {
  return isCustomDataType(value, 'Colour')
}

/**
 * Check if a value is a Gradient
 */
export function isGradient(value: HarloweEngineVariable): value is GradientVariable {
  return isCustomDataType(value, 'Gradient')
}

/**
 * Check if a value is a Lambda
 */
export function isLambda(value: HarloweEngineVariable): value is LambdaVariable {
  return isCustomDataType(value, 'Lambda')
}

/**
 * Check if a value is a CustomMacro
 */
export function isCustomMacro(value: HarloweEngineVariable): value is CustomMacroVariable {
  return isCustomDataType(value, 'CustomMacro')
}

/**
 * Check if a value is a Datatype
 */
export function isDatatype(value: HarloweEngineVariable): value is DatatypeVariable {
  return isCustomDataType(value, 'Datatype')
}

/**
 * Check if a value is a CodeHook
 */
export function isCodeHook(value: HarloweEngineVariable): value is CodeHookVariable {
  return isCustomDataType(value, 'CodeHook')
}

/**
 * Check if a value matches a datatype keyword
 */
export function matchesDatatype(value: HarloweEngineVariable, keyword: DatatypeKeyword): boolean {
  switch (keyword) {
    // Number types
    case 'number':
    case 'num':
      return isNumber(value)
    case 'even':
      return isEven(value)
    case 'odd':
      return isOdd(value)
    case 'integer':
    case 'int':
      return isInteger(value)

    // String types
    case 'string':
    case 'str':
      return isString(value)
    case 'empty':
      return isEmpty(value)
    case 'whitespace':
      return isWhitespace(value)
    case 'lowercase':
      return isLowercase(value)
    case 'uppercase':
      return isUppercase(value)
    case 'anycase':
      return isAnycase(value)
    case 'alphanumeric':
    case 'alnum':
      return isAlphanumeric(value)
    case 'digit':
      return isDigit(value)
    case 'linebreak':
    case 'newline':
      return isLinebreak(value)

    // Boolean types
    case 'boolean':
    case 'bool':
      return isBoolean(value)

    // Collection types
    case 'array':
      return isArray(value)
    case 'datamap':
    case 'dm':
      return isDatamap(value)
    case 'dataset':
    case 'ds':
      return isDataset(value)

    // Functional types
    case 'command':
      return isCommand(value)
    case 'changer':
      return isChanger(value)
    case 'lambda':
      return isLambda(value)
    case 'macro':
      return isCustomMacro(value)

    // Visual types
    case 'color':
    case 'colour':
      return isColour(value)
    case 'gradient':
      return isGradient(value)

    // Meta types
    case 'datatype':
      return isDatatype(value)
    case 'codehook':
      return isCodeHook(value)

    // Special types
    case 'const':
      return false // const matches nothing
    case 'any':
      return true // any matches everything

    default:
      return false
  }
}

// #endregion