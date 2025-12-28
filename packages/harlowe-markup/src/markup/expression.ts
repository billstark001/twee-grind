

import { BinaryNode, LeafNode, PrattASTNode, PrattExprToken, PrattParser, PrattToken, type OperatorConfig } from '../utils/pratt-parser'
import { AnyToken, MacroToken } from './types'

// #region token & precedence definitions

export const allExpressionTokens = Object.freeze([
  'is',
  'isNot',
  'isA',
  'isNotA',
  'matches',
  'doesNotMatch',

  'and',
  'or',
  'not',

  'inequality',

  'isIn',
  'contains',
  'doesNotContain',
  'isNotIn',

  'addition', // a + b, +a
  'subtraction', // a - b, -a
  'multiplication', // a * b
  'division', // a / b, a % b

  'spread', // ...
  'comma', // ,
  'typeSignature', // a-type b

  'to', // (set: $a to 5)
  'into', // (put: 5 into $a)
  'via', // (link: "text" via "passage")
  'where', // _num where _num > 5 where it > 5
  'when', // when a > b
  'making', // _num making _total via _total + _num
  'each', // each _item
  'bind', // bind $item

  'possessiveOperator', // a 's b
  'belongingOperator', // b of a

  'itsOperator', // its b
  'belongingItOperator', // b of it
] as const)

const _allExpressionTokensSet = new Set<string>(allExpressionTokens)

export const extendedExpressionTokens = Object.freeze([
  'modulus', // a % b

  'ge',    // a >= b
  'le',    // a <= b
  'gt',     // a > b
  'lt',     // a < b
] as const)

export type ExpressionTokenType = typeof allExpressionTokens[number]

export type ExtendedExpressionTokenType = typeof extendedExpressionTokens[number]

export type AllExpressionTokenType = ExpressionTokenType | ExtendedExpressionTokenType

export const harloweOperatorConfigs: Record<AllExpressionTokenType, OperatorConfig> = {
  // Comma operator - lowest precedence
  'comma': {
    precedence: 1,
    associativity: 'left',
    infix: true,
  },

  // Assignment-like operators
  'to': {
    precedence: 2,
    associativity: 'right',
    infix: true,
  },
  'into': {
    precedence: 2,
    associativity: 'right',
    infix: true,
  },

  // Contextual keywords with lower precedence
  'via': {
    precedence: 4,
    associativity: 'left',
    infix: true,
  },
  'where': {
    precedence: 4,
    associativity: 'left',
    prefix: true,
    infix: true,
  },
  'when': {
    precedence: 4,
    prefix: true,
  },
  'making': {
    precedence: 4,
    associativity: 'left',
    infix: true,
  },
  'each': {
    precedence: 4,
    prefix: true,
  },
  'bind': {
    precedence: 4,
    prefix: true,
  },

  // Type restriction operator
  'typeSignature': {
    precedence: 6,
    associativity: 'left',
    infix: true,
  },


  // Logical OR
  'or': {
    precedence: 8,
    associativity: 'left',
    infix: true,
  },

  // Logical AND
  'and': {
    precedence: 9,
    associativity: 'left',
    infix: true,
  },

  // Logical NOT (prefix)
  'not': {
    precedence: 10,
    prefix: true,
  },

  // Comparison operators
  'is': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'isNot': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'isA': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'isNotA': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'matches': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'doesNotMatch': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },

  // Inequality operators
  'inequality': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'ge': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'le': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'gt': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'lt': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },

  // Membership operators
  'isIn': {
    precedence: 12,
    associativity: 'left',
    infix: true,
  },
  'isNotIn': {
    precedence: 12,
    associativity: 'left',
    infix: true,
  },
  'contains': {
    precedence: 12,
    associativity: 'left',
    infix: true,
  },
  'doesNotContain': {
    precedence: 12,
    associativity: 'left',
    infix: true,
  },

  // Addition and subtraction
  'addition': {
    precedence: 13,
    associativity: 'left',
    prefix: true,  // Unary plus
    infix: true,   // Binary addition
  },
  'subtraction': {
    precedence: 13,
    associativity: 'left',
    prefix: true,  // Unary minus
    infix: true,   // Binary subtraction
  },

  // Multiplication, division and modulus
  'multiplication': {
    precedence: 14,
    associativity: 'left',
    infix: true,
  },
  'division': {
    precedence: 14,
    associativity: 'left',
    infix: true,
  },
  'modulus': {
    precedence: 14,
    associativity: 'left',
    infix: true,
  },

  // Property access operators
  'possessiveOperator': {
    precedence: 16,
    associativity: 'left',
    infix: true,
  },
  'belongingOperator': {
    precedence: 16,
    associativity: 'right',
    infix: true,
  },
  'itsOperator': {
    precedence: 16,
    prefix: true,
  },
  'belongingItOperator': {
    precedence: 16,
    postfix: true,
  },

  // Special operators
  'spread': {
    precedence: 18,
    prefix: true,
  },
}

// #endregion

const _excludeSet = new Set<string>([
  'whitespace',
  'comment',
  'macroName',
  'br',
  'hr',
])

const _inequalityMap: Record<string, string> = {
  '<': 'lt',
  '>': 'gt',
  '<=': 'le',
  '>=': 'ge',
  '!=': 'isNot',
}

const _inequalityNegateMap: Record<string, string> = {
  '<': 'ge',
  '>': 'le',
  '<=': 'gt',
  '>=': 'lt',
  '!=': 'is',
}

// Helper: Extract comma-separated arguments from AST
function extractCommaArgs<T extends { type: string }>(ast: PrattASTNode<T> | undefined): PrattASTNode<T>[] {
  if (!ast) return []

  if (ast.type === 'binary' && (ast as BinaryNode<T>).operator === 'comma') {
    const args: PrattASTNode<T>[] = []
    let current: PrattASTNode<T> | undefined = ast

    while (current?.type === 'binary' && (current as BinaryNode<T>).operator === 'comma') {
      args.unshift((current as BinaryNode<T>).right)
      current = (current as BinaryNode<T>).left
    }

    if (current) {
      args.unshift(current)
    }

    return args
  }

  return [ast]
}

// Helper: Filter out metadata properties from token
function extractTokenValue(token: AnyToken, omitCommon = false): any {
  const {
    innerMode, place, start, end, children,
    matches, cannotCross, isFront, aka,
    ...value
  } = token
  if (omitCommon) {
    delete (value as any).type
    delete (value as any).text
    delete (value as any).innerText
  }
  return value
}

const _unwrapMapping: Record<string, [oprOnLeft: boolean, alternativeOpr: ExpressionTokenType]> = {
  'property': [true, 'possessiveOperator'],
  'itsProperty': [true, 'itsOperator'],
  'belongingProperty': [false, 'belongingOperator'],
  'belongingItProperty': [false, 'belongingItOperator'],
}

function unwrapOperator(token: AnyToken) {
  const { type, name, text, start, end, place } = token as any
  if (!(type in _unwrapMapping)) {
    return null
  }
  const rawNameStart = (text as string)?.indexOf(name) ?? -1
  const [nameStart, nameEnd] = rawNameStart >= 0
    ? [start! + rawNameStart, start! + rawNameStart + name.length]
    : [start, end]
  const [oprOnLeft, alternativeOpr] = _unwrapMapping[type]
  const oprToken: PrattToken = {
    type: 'opr',
    start: oprOnLeft ? start : nameEnd,
    end: oprOnLeft ? nameStart : end,
    place,
    value: alternativeOpr,
  }
  const propertyToken: PrattToken = {
    type: 'expr',
    start: nameStart,
    end: nameEnd,
    place,
    value: {
      type: 'text',
      start: nameStart,
      end: nameEnd,
      place,
      name,
      text: name,
      innerText: name,
    },
  }
  return oprOnLeft ? [oprToken, propertyToken] : [propertyToken, oprToken]
}

// Token handlers: each returns a PrattToken or null to skip
export type TokenHandler = (token: AnyToken) => PrattToken | PrattToken[] | null

const tokenHandlers: Partial<Record<string, TokenHandler>> = {
  'division': (t) => {
    const { start, end, place } = t
    return {
      type: 'opr', start, end, place,
      value: t.text === '%' ? 'modulus' : 'division',
    }
  },

  'inequality': (t) => {
    const { operator, negate, start, end, place } = t as any
    const mappedOperator = negate
      ? _inequalityNegateMap[operator]
      : _inequalityMap[operator]
    return {
      type: 'opr', start, end, place,
      value: mappedOperator,
    }
  },

  'property': unwrapOperator,
  'itsProperty': unwrapOperator,
  'belongingProperty': unwrapOperator,
  'belongingItProperty': unwrapOperator,
}

function getTokenHandler(tokenType: string): TokenHandler | undefined {
  return tokenHandlers[tokenType]
}

export const Expression = Object.freeze({
  parse: parseExpression,
  getTokenHandler,
  extractTokenValue,
  extractCommaArgs,
} as const)

export function parseExpression<T = LeafNode>(
  tokens: AnyToken[],
  leafNodeCreator?: (token: PrattExprToken) => T,
  extractValue?: boolean | Iterable<string>,
): PrattASTNode<T> | undefined {
  const filteredTokens: PrattToken[] = []

  const extractAll = extractValue === true
  const extractSet = extractValue && extractValue !== true
    ? new Set<string>(extractValue)
    : null

  for (const token of tokens) {
    const { type, start, end, place } = token

    // Skip excluded tokens
    if (_excludeSet.has(type)) {
      continue
    }

    // Try specialized handler first
    const handler = tokenHandlers[type]
    if (handler) {
      const result = handler(token)
      if (result) {
        if (Array.isArray(result)) {
          filteredTokens.push(...result)
        } else {
          filteredTokens.push(result)
        }
      }
      continue
    }

    // Handle generic expression tokens
    if (_allExpressionTokensSet.has(type)) {
      filteredTokens.push({
        type: 'opr', start, end, place,
        value: type,
      })
      continue
    }

    // Default: wrap as expression with filtered properties
    filteredTokens.push({
      type: 'expr', start, end, place,
      value: (extractAll || (extractSet && extractSet.has(type)))
        ? extractTokenValue(token)
        : token,
    })
  }

  const parser = new PrattParser({
    operators: harloweOperatorConfigs,
    leafNodeCreator,
  })

  return parser.parse(filteredTokens)
}