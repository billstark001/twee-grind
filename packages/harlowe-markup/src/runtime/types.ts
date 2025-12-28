import { CodeHookNode, ExpressionNode, LinkNode } from "../markup/types"

function buildReverseMap<T extends string, U extends string>(
  map: Readonly<Record<T, U>>
): Readonly<Record<U, readonly T[]>> {
  const reverseMap: Record<U, T[]> = {} as Record<U, T[]>
  for (const [key, value] of Object.entries(map) as [T, U][]) {
    if (!reverseMap[value]) {
      reverseMap[value] = []
    }
    reverseMap[value].push(key)
  }
  for (const key of Object.keys(reverseMap) as U[]) {
    Object.freeze(reverseMap[key])
  }
  Object.freeze(reverseMap)
  return reverseMap as Readonly<Record<U, readonly T[]>>
}


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

  | BindVariable
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
  'Datatype',
  'Gradient',

  // Technical types
  'Bind',
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

// Gradient variable type

export type GradientStop = {
  percent: number,
  color: ColorVariable,
}

export type GradientVariable = {
  [HarloweCustomDataType]: 'Gradient',
  angle: number, // 0-359, int
  stops: ReadonlyArray<GradientStop>,
}


// Technical types

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

// Passage-related types

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

export type CustomMacroVariable = FunctionalVariable & {
  [HarloweCustomDataType]: 'CustomMacro',
  args: Record<string, HarloweDataType>,
  body: CodeHookNode,
}

export type LambdaVariable = FunctionalVariable & {
  [HarloweCustomDataType]: 'Lambda',
  argNames: string[],
  body: ExpressionNode,
}

export type CommandVariable = FunctionalVariable & {
  [HarloweCustomDataType]: 'Command',
  name: string, // pre-defined somewhere else
  data?: JsonSerializable,
}


// #region Runtime Data Types

type JsonSerializable =
  | null
  | boolean
  | number
  | string
  | JsonSerializable[]
  | { [key: string]: JsonSerializable }

export type FunctionalVariable = {
  [HarloweScope]: HarloweEngineScope
}

export type HarloweEngineScope = {
  srcPassage: string | null, // null for global scope
  srcPos: number, // the index in the source passage where this scope was created, 0 for global scope
  vars: Map<string, HarloweEngineVariable>,
  parent?: HarloweEngineScope,
}


// #region Runtime Manager Types 
// TODO

export const BuiltinChangers = Object.freeze({
  Naive: Symbol('Naive'), // bold, italic, underline, etc.
  HtmlTag: Symbol('HtmlTag'),
  Collapsed: Symbol('Collapsed'),
  Align: Symbol('Align'),
  Column: Symbol('Column'),
  Bulleted: Symbol('Bulleted'),
  Numbered: Symbol('Numbered'),
} as const);


type StyleAttributes = Record<string, any> // TODO
type RenderNode = undefined // TODO

export interface StateManager {
  getGlobal(name: string): any
  setGlobal(name: string, value: any): void
  getTemp(name: string): any
  setTemp(name: string, value: any): void
  randInt(min: number, max: number): number
  randFloat(): number // 0-1
}

export interface ChangerStack {
  getChangers(): StyleAttributes
  appendChanger(changer: StyleAttributes): void
  clear(): void
}

export interface HooksManager {
  register(name: string, renderNode: RenderNode): void
  get(name: string): RenderNode | undefined
}

export interface NavigationManager {
  goto(passageName: string): Promise<void>
  renderPassage(passageName: string): Promise<void> // render in current passage
  sleep(ms: number): Promise<void>

  getHistory(): string[]
}

export interface MacroRegistry {
  call(macroName: string, args: any[]): any
  has(macroName: string): boolean
}

// #endregion
