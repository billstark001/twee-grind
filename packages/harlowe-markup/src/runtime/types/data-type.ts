import type { CodeHookNode, ExpressionNode, LinkNode } from "../../markup/types"
import { buildReverseMap, JsonSerializable } from "../../utils/common"
import { HarloweEngineScope } from "./engine"


export const HarloweCustomDataType = Symbol(`HarloweDataType`)
export const HarloweScope = Symbol(`HarloweScope`)

export type HarlowePrimitiveVariable = any[] | boolean | Record<string, any> | Map<string, any> | Set<any> | number | string

export type HarloweEngineVariable =
  | HarlowePrimitiveVariable

  | CustomMacroVariable
  | LambdaVariable
  | CommandVariable

  | ColorVariable
  | GradientVariable

  | ErrorVariable
  | BindVariable
  | DatatypeVariable
  | TypedVarVariable
  | VariableToValueVariable
  | HookNameVariable

  | ChangerVariable
  | CodeHookVariable
// #region Custom Data Types

export const allHarloweDataTypes = Object.freeze([
  // Special types
  'Any',
  'Const',
  'Error',

  // JavaScript primitive types
  'Array',
  'Boolean',
  'Datamap',
  'Dataset',
  'Number',
  'String',

  // Functional types
  'Command',
  'CustomMacro',
  'Lambda',
  'Metadata',

  // 'Instant', // removed

  // Harlowe-specific types
  'Colour',
  'Gradient',

  // Technical types
  'Bind',
  'Datatype',
  'TypedVar',
  'VariableToValue',
  'HookName',

  // Passage-related types
  'Changer',
  'CodeHook',
] as const)

export type HarloweDataType = typeof allHarloweDataTypes[number]

// #endregion

// #region Builtin Data Types


// Note that DataType and Datatype are different:
// - DataType is a JS primitive type, 
// - Datatype is a Harlowe custom type

export const allDatatypeKeywords = Object.freeze([
  "string", "number", "boolean", "num", "str", "bool",
  "array", "datamap", "dm", "dataset", "ds",
  "command", "changer",
  "lambda", "macro",
  "color", "colour", "gradient", "datatype",
  "codehook",
  "even", "odd", "integer", "int",
  "empty", "whitespace", "lowercase", "uppercase", "anycase",
  "alphanumeric", "alnum", "digit", "linebreak", "newline",
  "const", "any"
] as const);

export type DatatypeKeyword = typeof allDatatypeKeywords[number];

export const datatypeKeywordMap = Object.freeze({
  // Basic types
  'number': 'Number',
  'num': 'Number',
  'string': 'String',
  'str': 'String',
  'boolean': 'Boolean',
  'bool': 'Boolean',
  'array': 'Array',
  'datamap': 'Datamap',
  'dm': 'Datamap',
  'dataset': 'Dataset',
  'ds': 'Dataset',

  // Functional types
  'command': 'Command',
  'changer': 'Changer',
  'lambda': 'Lambda',
  'macro': 'CustomMacro',

  // Visual types
  'color': 'Colour',
  'colour': 'Colour',
  'gradient': 'Gradient',

  // Meta types
  'datatype': 'Datatype',
  'codehook': 'CodeHook',

  // Specialized number types
  'even': 'Number',
  'odd': 'Number',
  'integer': 'Number',
  'int': 'Number',

  // Specialized string types
  'empty': 'String', // Also matches empty collections
  'whitespace': 'String',
  'lowercase': 'String',
  'uppercase': 'String',
  'anycase': 'String',
  'alphanumeric': 'String',
  'alnum': 'String',
  'digit': 'String',
  'linebreak': 'String',
  'newline': 'String',

  // Special types
  'const': 'Const',
  'any': 'Any',
} as Readonly<Record<DatatypeKeyword, HarloweDataType>>);


/**
 * Reverse map: CustomDataType to array of keyword aliases
 */
export const datatypeReverseMap: Readonly<Record<HarloweDataType, readonly DatatypeKeyword[]>> =
  buildReverseMap(datatypeKeywordMap)

// Color variable type

export type ColorVariable = {
  [HarloweCustomDataType]: 'Colour',
  // 0-255, int
  r: number,
  g: number,
  b: number,
  // 0-1
  a: number,
  // 0-359, int
  h: number,
  // 0-1
  s: number,
  // 0-1
  l: number,
  // floats
  lch: Readonly<{
    l: number,
    c: number,
    h: number,
  }>,
}

export const allPredefinedColorNames = Object.freeze([
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'aqua',
  'cyan',
  'blue',
  'navy',
  'purple',
  'magenta',
  'fuchsia',
  'white',
  'black',
  'grey',
  'gray',
  'transparent',
] as const)

export type PredefinedColorName = typeof allPredefinedColorNames[number];

// region Gradient variable type

export type GradientStop = {
  percent: number,
  color: ColorVariable,
}

export type GradientVariable = {
  [HarloweCustomDataType]: 'Gradient',
  angle: number, // 0-359, int
  stops: ReadonlyArray<GradientStop>,
}

// #endregion

// #region Technical types

export type ErrorVariable = {
  [HarloweCustomDataType]: 'Error',
  message: string,
  [key: string]: any,
}

export type DatatypeVariable = {
  [HarloweCustomDataType]: 'Datatype',
  datatype: DatatypeKeyword,
  // Extended support for pattern matching
  patternType?: 'array' | 'datamap' | 'dataset' | 'regex'
  pattern?: any
  regex?: RegExp
}

type VariableMetadata = {
  name: string,
  isTemp: boolean
}

export type BindVariable = {
  [HarloweCustomDataType]: 'Bind',
  target: ExpressionNode,
}

export type TypedVarVariable = VariableMetadata & {
  [HarloweCustomDataType]: 'TypedVar',
  datatype: DatatypeKeyword
}

export type VariableToValueVariable = VariableMetadata & {
  [HarloweCustomDataType]: 'VariableToValue',
  datatype?: DatatypeKeyword,
  value: HarloweEngineVariable
}

export type HookNameMetadata = {
  chars: string,
  links: Omit<LinkNode, 'type'>[]
  lines: string[],
}

export type HookNameVariable = HookNameMetadata & {
  [HarloweCustomDataType]: 'HookName',
  hookName: string,
  [index: number]: HookNameVariable | undefined,
  slice(start: number, end?: number): HookNameVariable,
  visited: HookNameVariable,
}

// #endregion

// #region Passage-related types

export type ChangerVariable = {
  [HarloweCustomDataType]: 'Changer',
  macroName?: string,
  [attr: string]: JsonSerializable | undefined,
}

export type CodeHookVariable = {
  [HarloweCustomDataType]: 'CodeHook',
  value: CodeHookNode,
}

// #endregion

// #region Functional Types

export type FunctionalVariable = {
  [HarloweScope]: HarloweEngineScope
}

export type CustomMacroVariable = FunctionalVariable & {
  [HarloweCustomDataType]: 'CustomMacro',
  args: Record<string, HarloweDataType>,
  body: CodeHookNode,
}

export type LambdaVariable = FunctionalVariable & {
  [HarloweCustomDataType]: 'Lambda',
  // Lambda type: where/when = filter, via = transform, making = accumulator, each = iterator
  lambdaType?: 'where' | 'when' | 'via' | 'making' | 'each'
  argNames: string[],
  body: ExpressionNode,
  // For 'making' lambdas: the making variable name
  makingVarName?: string
}

export type CommandVariable = FunctionalVariable & {
  [HarloweCustomDataType]: 'Command',
  name: string, // pre-defined somewhere else
  data?: JsonSerializable,
}

// #endregion
// #endregion
