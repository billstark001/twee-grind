import { Parser, Options, Node, Position, TokenType, Identifier } from 'acorn';

// acorn

export class TokContext {
  constructor(
    token: string,
    isExpr: boolean,
    preserveSpace: boolean,
    override?: ((p: Parser) => Parser) | null,
    generator?: boolean
  );

  readonly token: string;
  readonly isExpr: boolean;
  readonly preserveSpace: boolean;
  readonly override: ((p: Parser) => Parser) | null;
  readonly generator: boolean;
}


/**
```
  b_stat: new TokContext("{", false),
  b_expr: new TokContext("{", true),
  b_tmpl: new TokContext("${", false),
  p_stat: new TokContext("(", false),
  p_expr: new TokContext("(", true),
  q_tmpl: new TokContext("`", true, true, p => p.tryReadTemplateToken()),
  f_stat: new TokContext("function", false),
  f_expr: new TokContext("function", true),
  f_expr_gen: new TokContext("function", true, false, null, true),
  f_gen: new TokContext("function", false, false, null, true)
```
 */
export const tokContexts: {
  b_stat: TokContext;
  b_expr: TokContext;
  b_tmpl: TokContext;
  p_stat: TokContext;
  p_expr: TokContext;
  q_tmpl: TokContext;
  f_stat: TokContext;
  f_expr: TokContext;
  f_expr_gen: TokContext;
  f_gen: TokContext;
};


export const keywordTypes: {
  'break': TokenType;
  'case': TokenType;
  'catch': TokenType;
  'continue': TokenType;
  'debugger': TokenType;
  'default': TokenType;
  'do': TokenType;
  'else': TokenType;
  'finally': TokenType;
  'for': TokenType;
  'function': TokenType;
  'if': TokenType;
  'return': TokenType;
  'switch': TokenType;
  'throw': TokenType;
  'try': TokenType;
  'var': TokenType;
  'const': TokenType;
  'while': TokenType;
  'with': TokenType;
  'new': TokenType;
  'this': TokenType;
  'super': TokenType;
  'class': TokenType;
  'extends': TokenType;
  'export': TokenType;
  'import': TokenType;
  'null': TokenType;
  'true': TokenType;
  'false': TokenType;
  'in': TokenType;
  'instanceof': TokenType;
  'typeof': TokenType;
  'void': TokenType;
  'delete': TokenType;
};

type NullablePosition = Position | null | undefined;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export class ExtensibleParser extends Parser {
  constructor(options: Options, input: string, startPos?: number);

  // state

  readonly keywords: RegExp;

  pos: number;
  start: number;
  end: number;
  type: TokenType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;

  startLoc: NullablePosition;
  endLoc: NullablePosition;

  lastTokStart: number;
  lastTokEnd: number;
  lastTokStartLoc: NullablePosition;
  lastTokEndLoc: NullablePosition;

  lineStart: number;
  curLine: number;


  eat(type: TokenType): boolean;
  semicolon(): boolean;

  startNode(): Node;
  startNodeAt(pos: number, loc?: Position): Node;

  curPosition(): NullablePosition;

  // node

  startNodeAt(pos: number, loc: NullablePosition): Node;
  startNode(): Node;
  finishNodeAt(node: Node, type: string, pos: number, loc: NullablePosition): Node;
  finishNode(node: Node, type: string): Node;


  // tokenize

  next(ignoreEscapeSequenceInKeyword?: boolean): void;
  nextToken(): void;
  readToken(code: number): void;
  getTokenFromCode(code: number): void;
  finishToken(type: TokenType, value?: string): void;

  skipSpace(): void;

  readWord1(): string;
  readWord(): void;

  fullCharCodeAtPos(): number;

  // statement

  parseTopLevel(node: Node): void;
  parseStatement(context: string | null, topLevel: boolean, exports: Record<string, string>): void;

  // expression
  parseExpression(): Node;
  parseIdent(liberal?: boolean): Node;
  parseIdentNode(): Identifier
  
  awaitIdentPos: number;
  checkUnreserved(p: { start: number, end: number, name: string }): void;

  // token context
  readonly context: Readonly<TokContext[]>;
  curContext(): TokContext;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseExprSubscripts(refDestructuringErrors: any, forInit: any): Node;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseExprAtom(refDestructuringErrors: any, forInit: any): Node;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseSubscripts(base: Node, startPos: number, startLoc: NullablePosition, noCalls: boolean, forInit: any): Node;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createKeywordTokenType(name: string, options?: any): TokenType;

// 
