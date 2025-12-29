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
