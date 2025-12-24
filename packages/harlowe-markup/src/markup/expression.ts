

import { ASTNode, PrattParser, PrattToken, type OperatorConfig } from '../utils/pratt-parser';
import { AnyToken, MacroToken } from './types';

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
  'typeSignature', // a-type

  'to', // (set: $a to 5)
  'into', // (put: 5 into $a)
  'via', // (link: "text" via "passage")
  'where', // _num where _num > 5; where it > 5
  'when', // when a > b
  'making', // _num making _total via _total + _num
  'each', // each _item
  'bind', // bind $item

  'possessiveOperator', // a 's b
  'belongingOperator', // b of a

  'itsOperator', // its b
  'belongingItOperator', // b of it
] as const);

const _allExpressionTokensSet = new Set<string>(allExpressionTokens);

export const extendedExpressionTokens = Object.freeze([
  'modulus', // a % b

  'ge',    // a >= b
  'le',    // a <= b
  'gt',     // a > b
  'lt',     // a < b
] as const);

export type ExpressionTokenType = typeof allExpressionTokens[number];

export const harloweOperatorConfigs: Record<ExpressionTokenType, OperatorConfig> = {
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

  // Logical OR
  'or': {
    precedence: 3,
    associativity: 'left',
    infix: true,
  },

  // Logical AND
  'and': {
    precedence: 4,
    associativity: 'left',
    infix: true,
  },

  // Logical NOT (prefix)
  'not': {
    precedence: 5,
    prefix: true,
  },

  // Comparison operators
  'is': {
    precedence: 6,
    associativity: 'left',
    infix: true,
  },
  'isNot': {
    precedence: 6,
    associativity: 'left',
    infix: true,
  },
  'isA': {
    precedence: 6,
    associativity: 'left',
    infix: true,
  },
  'isNotA': {
    precedence: 6,
    associativity: 'left',
    infix: true,
  },
  'matches': {
    precedence: 6,
    associativity: 'left',
    infix: true,
  },
  'doesNotMatch': {
    precedence: 6,
    associativity: 'left',
    infix: true,
  },
  'inequality': {
    precedence: 6,
    associativity: 'left',
    infix: true,
  },

  // Membership operators
  'isIn': {
    precedence: 7,
    associativity: 'left',
    infix: true,
  },
  'isNotIn': {
    precedence: 7,
    associativity: 'left',
    infix: true,
  },
  'contains': {
    precedence: 7,
    associativity: 'left',
    infix: true,
  },
  'doesNotContain': {
    precedence: 7,
    associativity: 'left',
    infix: true,
  },

  // Addition and subtraction
  'addition': {
    precedence: 8,
    associativity: 'left',
    prefix: true,  // Unary plus
    infix: true,   // Binary addition
  },
  'subtraction': {
    precedence: 8,
    associativity: 'left',
    prefix: true,  // Unary minus
    infix: true,   // Binary subtraction
  },

  // Multiplication and division
  'multiplication': {
    precedence: 9,
    associativity: 'left',
    infix: true,
  },
  'division': {
    precedence: 9,
    associativity: 'left',
    infix: true,
  },

  // Property access operators
  'possessiveOperator': {
    precedence: 11,
    associativity: 'left',
    infix: true,
  },
  'belongingOperator': {
    precedence: 11,
    associativity: 'right',
    infix: true,
  },
  'itsOperator': {
    precedence: 11,
    prefix: true,
  },
  'belongingItOperator': {
    precedence: 11,
    postfix: true,
  },

  // Type signature
  'typeSignature': {
    precedence: 10,
    associativity: 'left',
    postfix: true,
  },

  // Special operators
  'spread': {
    precedence: 12,
    prefix: true,
  },

  // Contextual keywords with lower precedence
  'via': {
    precedence: 2,
    associativity: 'left',
    infix: true,
  },
  'where': {
    precedence: 2,
    associativity: 'left',
    infix: true,
  },
  'when': {
    precedence: 2,
    prefix: true,
  },
  'making': {
    precedence: 2,
    associativity: 'left',
    infix: true,
  },
  'each': {
    precedence: 2,
    prefix: true,
  },
  'bind': {
    precedence: 2,
    prefix: true,
  },
};

export const parser = new PrattParser(harloweOperatorConfigs);

const _excludeSet = new Set<string>([
  'whitespace',
  'comment',
  'macroName',
  'br',
  'hr',
]);

const _inequalityMap: Record<string, string> = {
  '<': 'lt',
  '>': 'gt',
  '<=': 'le',
  '>=': 'ge',
  '!=': 'isNot',
};

const _inequalityNegateMap: Record<string, string> = {
  '<': 'ge',
  '>': 'le',
  '<=': 'gt',
  '>=': 'lt',
  '!=': 'is',
};

export function parse(tokens: AnyToken[]): ASTNode | undefined {
  const filteredTokens: PrattToken[] = [];
  for (const t of tokens) {
    const { type, start, end } = t;
    if (_excludeSet.has(type)) {
      continue;
    }
    if (_allExpressionTokensSet.has(type)) {
      if (type === 'division' && t.text === '%') {
        filteredTokens.push({
          type: 'opr', start, end,
          value: 'modulus',
        });
        continue;
      }
      if (type === 'inequality') {
        const { operator, negate } = t as any;
        const mappedOperator = negate ? _inequalityNegateMap[operator] : _inequalityMap[operator];
        filteredTokens.push({
          type: 'opr', start, end,
          value: mappedOperator,
        });
        continue;
      }
      filteredTokens.push({
        type: 'opr', start, end,
        value: type,
      });
      continue;
    }
    if (type === 'grouping') {
      filteredTokens.push({
        type: 'expr', start, end,
        value: parse(t.children),
      });
      continue;
    }
    if (type === 'macro') {
      const rawArgs = parse(t.children);
      const args: ASTNode[] = [];
      if (!rawArgs) {
        // do nothing
      } else if (rawArgs.type === 'binary' && rawArgs.operator === 'comma') {
        let current: ASTNode | undefined = rawArgs;
        while (current && current.type === 'binary' && current.operator === 'comma') {
          args.unshift(current.right);
          current = current.left;
        }
        if (current) {
          args.unshift(current);
        }
      } else {
        args.push(rawArgs);
      }
      filteredTokens.push({
        type: 'expr', start, end,
        value: {
          type: 'macro',
          name: (t as MacroToken).name,
          args,
        },
      });
      continue;
    }
    const {
      innerMode, place,
      start: _, end: __, children,
      matches, cannotCross, isFront, aka,
      ...value
    } = t;
    filteredTokens.push({
      type: 'expr', start, end,
      value,
    });
  }
  return parser.parse(filteredTokens);
}