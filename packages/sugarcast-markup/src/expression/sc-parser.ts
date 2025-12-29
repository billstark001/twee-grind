import { BinaryExpression, Expression, Identifier, MemberExpression, Node, Options, TokenType, UnaryExpression, tokTypes as tt } from 'acorn';
import { ExtensibleParser, NullablePosition, keywordTypes, createKeywordTokenType } from './e-parser';

const MACRO_TERM_CODE = '>'.charCodeAt(0);

const desugarTokenTable: Record<string, [TokenType, string]> = Object.freeze(Object.assign(Object.create(null), {
  // Assignment operator.
  to: [tt.eq, '='],
  // Equality operators.
  eq: [tt.equality, '=='],
  neq: [tt.equality, '!='],
  is: [tt.equality, '==='],
  isnot: [tt.equality, '!=='],
  // Relational operators.
  gt: [tt.relational, '>'],
  gte: [tt.relational, '>='],
  lt: [tt.relational, '<'],
  lte: [tt.relational, '<='],
  // Logical operators.
  and: [tt.logicalAND, '&&'],
  or: [tt.logicalOR, '||'],
  // Binary operators.
  band: [tt.bitwiseAND, '&'],
  bor: [tt.bitwiseOR, '|'],
  bxor: [tt.bitwiseXOR, '|'],
  // Unary operators.
  not: [tt.prefix, '!'],
  bnot: [tt.prefix, '~'],
  //
  lsh: [tt.bitShift, '<<'],
  rsh: [tt.bitShift, '>>'],
  ursh: [tt.bitShift, '>>>'],
}));


export const defCheckTokenType = createKeywordTokenType('def', { beforeExpr: true, prefix: true, startsExpr: true });

const handleStateVariableShortcut = (
  identifier: string,
  start = -1,
  end = -1,
  optional = false
): MemberExpression => {
  const isGlobal = identifier.startsWith('$');
  const realIdentifier = (identifier.startsWith('$') || identifier.startsWith('_')) ?
    identifier.substring(1) :
    identifier;

  const ret: MemberExpression = {
    start, end, optional,
    type: 'MemberExpression',
    object: {
      start, end, optional,
      type: 'MemberExpression',
      object: {
        start, end,
        type: 'Identifier',
        name: 'State'
      },
      property: {
        start, end,
        type: 'Identifier',
        name: isGlobal ? 'variables' : 'temporary',
      },
      computed: false
    },
    property: {
      start, end,
      type: 'Identifier',
      name: realIdentifier,
    },
    computed: false
  };

  return Object.assign(ret, { name: identifier });
};

const handleDefCheckShortcut = (
  target: Expression,
  isNdef: boolean,
  start = -1,
  end = -1,
): BinaryExpression => {
  return {
    start, end,
    type: 'BinaryExpression',
    operator: isNdef ? '===' : '!==',
    left: {
      start, end,
      type: 'UnaryExpression',
      operator: 'typeof',
      argument: target,
      prefix: true
    },
    right: {
      start, end,
      type: 'Identifier',
      name: 'undefined'
    }
  };

};

export class DesugarParser extends ExtensibleParser {

  constructor(options: Options, input: string, startPos?: number) {
    super(options, input, startPos);
    this.spaceLen = 0;
    this.lastSpaceLen = 0;
  }

  spaceLen: number;
  lastSpaceLen: number;

  // utils

  initParsing(pos?: number, input?: string) {
    if (input != undefined)
      this.input = input;
    if (pos != undefined)
      this.pos = pos;
    // TODO: reset context, labels, privateNameStack, scopeStack, undefinedExports
    this.lineStart = this.pos;
    this.curLine = 0;
    this.skipSpace();
    this.start = this.end = this.pos;
    this.lastTokStart = this.lastTokEnd = this.pos;
    if (this.options.locations) {
      this.lastTokEndLoc = this.lastTokStartLoc =
        this.startLoc = this.endLoc = this.curPosition();
    }
    this.spaceLen = 0;
    this.type = tt.eof;
    this.value = null;
    this.nextToken();
  }
  parseSingle(code: string, pos = 0) {
    this.initParsing(pos, code);
    return this.parseExpression();
  }

  parseAll(code: string, pos = 0) {
    this.initParsing(pos, code);
    const ans: Node[] = [];
    while (this.type !== tt.eof) {
      ans.push(this.parseExpression());
    }
    return ans;
  }

  // handlers

  topLevelContext() {
    return this.context.length <= 1;
  }

  skipSpace() {
    const beforePos = this.pos;
    super.skipSpace();
    const dPos = this.pos - beforePos;
    return dPos;
  }

  isSpecialEof(setSpaceLen?: boolean): string | undefined {
    const dPos = this.skipSpace();
    if (setSpaceLen)
      this.spaceLen = dPos;
    return undefined;
  }

  nextToken() {
    // this one is actually not always correct
    // it could be overridden in some cases but we don't care
    this.lastSpaceLen = this.spaceLen;
    let spaceLenSet = false;
    if (this.topLevelContext()) {

      const eofType = this.isSpecialEof(true);
      spaceLenSet = true;

      if (eofType != undefined) { // stop with EOF
        this.start = this.pos;
        if (this.options.locations) this.startLoc = this.curPosition();
        return this.finishToken(tt.eof, eofType);
      }
    }
    // default logic
    // record leading space with start
    const curContext = this.curContext();

    let newSpaceLen = 0;
    if (!curContext || !curContext.preserveSpace)
      newSpaceLen = this.skipSpace();
    if (!spaceLenSet)
      this.spaceLen = newSpaceLen;

    this.start = this.pos;
    if (this.options.locations) this.startLoc = this.curPosition();

    // finish with default eof
    if (this.pos >= this.input.length)
      return this.finishToken(tt.eof, 'eof');

    if (curContext?.override) return curContext.override(this);
    else this.readToken(this.fullCharCodeAtPos());
  }

  // handle desugar operators
  readWord() {
    const word = this.readWord1();
    let type = tt.name;
    if (this.keywords.test(word)) {
      type = keywordTypes[word as keyof typeof keywordTypes];
    }
    if (word in desugarTokenTable) {
      const [realType, realWord] = desugarTokenTable[word];
      return this.finishToken(realType, realWord);
    }
    if (word === 'def' || word === 'ndef') {
      return this.finishToken(defCheckTokenType, word);
    }
    return this.finishToken(type, word);
  }

  // handle def & ndef shortcut
  finishNodeAt(node: Node, type: string, pos: number, loc: NullablePosition): Node {
    if (type === 'UnaryExpression' && ['def', 'ndef'].includes((node as UnaryExpression).operator as string)) {
      return super.finishNodeAt(handleDefCheckShortcut(
        (node as UnaryExpression).argument,
        (node as UnaryExpression).operator as string === 'ndef',
        node.start,
        node.end,
      ), 'BinaryExpression', pos, loc);
    }
    if (type === 'MemberExpression' && 
      !(node as MemberExpression).computed && 
      (node as MemberExpression).property && 
      (node as MemberExpression).property?.type === 'MemberExpression') {
      (node as MemberExpression).property.type = 'Identifier';
    }
    return super.finishNodeAt(node, type, pos, loc);
  }

  // handle variable shortcut
  parseIdent(liberal?: boolean | undefined): Node {
    const node = this.parseIdentNode();
    this.next(!!liberal);
    if (node.name.startsWith('$') || node.name.startsWith('_')) {
      const ret = handleStateVariableShortcut(
        (node as Identifier).name,
        node.start,
        node.end,
      );
      this.finishNode(ret, 'MemberExpression');
      return ret;
    }
    this.finishNode(node, 'Identifier');
    if (!liberal) {
      this.checkUnreserved(node);
      if (node.name === 'await' && !this.awaitIdentPos)
        this.awaitIdentPos = node.start;
    }
    return node;
  }

  finishNode(node: Node, type: string): Node {
    return this.finishNodeAt(node, type, this.lastTokEnd, this.lastTokEndLoc);
  }

}

export class MacroParameterParser extends DesugarParser {

  constructor(options: Options, input: string, startPos?: number) {
    super(options, input, startPos);
  }

  isSpecialEof(setSpaceLen?: boolean) {
    const dPos = this.skipSpace();
    if (setSpaceLen)
      this.spaceLen = dPos;
    // `>>` with any number of leading spaces
    if (this.input.charCodeAt(this.pos) == MACRO_TERM_CODE &&
      this.input.charCodeAt(this.pos + 1) == MACRO_TERM_CODE)
      return 'macro';

    return undefined;
  }


  // top-level parens
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseExprSubscripts(refDestructuringErrors: any, forInit: any) {
    const startPos = this.start, startLoc = this.startLoc;

    const preventCallPre = this.topLevelContext() && this.type?.label === 'name';
    const expr = this.parseExprAtom(refDestructuringErrors, forInit);
    if (expr.type === 'ArrowFunctionExpression' && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ')')
      return expr;
    // prevent top-level function call with spaces
    const preventCall = preventCallPre && this.type?.label === '(' && this.spaceLen > 0;

    const result = this.parseSubscripts(expr, startPos, startLoc, preventCall, forInit);
    if (refDestructuringErrors && result.type === 'MemberExpression') {
      if (refDestructuringErrors.parenthesizedAssign >= result.start) refDestructuringErrors.parenthesizedAssign = -1;
      if (refDestructuringErrors.parenthesizedBind >= result.start) refDestructuringErrors.parenthesizedBind = -1;
      if (refDestructuringErrors.trailingComma >= result.start) refDestructuringErrors.trailingComma = -1;
    }
    return result;
  }

}

export class InlineExpressionParser extends DesugarParser {
  constructor(options: Options, input: string, startPos?: number) {
    super(options, input, startPos);
  }

  isSpecialEof(setSpaceLen?: boolean) {
    const dPos = this.skipSpace();
    if (setSpaceLen)
      this.spaceLen = dPos;
    // top-level spaces are not allowed
    if (this.topLevelContext() && dPos > 0)
      return 'inline-expr';

    return undefined;
  }
}



export class CustomFenceParser extends DesugarParser {

  readonly pattern: RegExp;
  readonly eofType: string;

  constructor(options: Options & { eofType?: string }, pattern: RegExp, input: string, startPos?: number) {
    super(options, input, startPos);
    this.pattern = pattern;
    this.eofType = options.eofType ?? 'pattern';
  }

  isSpecialEof(setSpaceLen?: boolean) {
    const dPos = this.skipSpace();
    if (setSpaceLen)
      this.spaceLen = dPos;
    // stop parsing if the close tag is encountered
    this.pattern.lastIndex = this.pos;
    if (this.pattern.test(this.input))
      return this.eofType;

    return undefined;
  }
}