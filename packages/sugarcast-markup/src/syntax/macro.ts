import { EOF, Lexer } from '../util/lexer';
import { ParserContext, SyntaxDefinition, TEXT_NODE } from '../parser';
import { LinkMarkup, parseLinkMarkup } from './link-markup';
import Patterns from '../patterns';
import { enumFromNamesStr } from '../util/enum';
import { CustomFenceParser, MacroParameterParser } from '../expression/sc-parser';
import { Expression, Literal, tokTypes, Identifier, BinaryExpression } from 'acorn';
import { Node } from 'acorn';

// Lex item types object.
const Item = enumFromNamesStr([
  'Error',
  'Link',
  'Literal',
  'Identifier',
  'Expression',
]);

const squareBracketRe = /\[(?:[<>]?img)?\[/gim;

const lexSquareBracket = (lexer: Lexer) => {
  const imgMeta = '<>IiMmGg';
  let what = '';

  if (lexer.accept(imgMeta)) {
    what = 'image';
    lexer.acceptRun(imgMeta);
  }
  else {
    what = 'link';
  }

  if (!lexer.accept('[')) {
    return lexer.error(Item.Error, `malformed ${what} markup`);
  }

  lexer.depth = 2; // account for both initial left square brackets

  loop: for (; ;) {
    /* eslint-disable indent */
    switch (lexer.next()) {
      case '\\':
        {
          const ch = lexer.next();

          if (ch !== EOF && ch !== '\n') {
            break;
          }
        }
      /* falls through */
      case EOF:
      case '\n':
        return lexer.error(Item.Error, `unterminated ${what} markup`);

      case '[':
        ++lexer.depth;
        break;

      case ']':
        --lexer.depth;

        if (lexer.depth < 0) {
          return lexer.error(Item.Error, 'unexpected right square bracket \']\'');
        }

        if (lexer.depth === 1) {
          if (lexer.next() === ']') {
            --lexer.depth;
            break loop;
          }
          lexer.backup();
        }
        break;
    }
    /* eslint-enable indent */
  }

  lexer.emit(Item.Link);
  return null;
};

const tryParseLink = (str: string, pos: number) => {
  squareBracketRe.lastIndex = pos;
  if (!squareBracketRe.exec(str))
    return undefined;

  const lexer = new Lexer(str, lexSquareBracket);
  lexer.start = lexer.pos = pos;
  const tokens = lexer.run();
  if (!tokens.length || tokens[0]?.type !== Item.Link)
    return undefined;

  const t = tokens[0];
  const markup = parseLinkMarkup({
    source: t.text,
    matchStart: 0,
  } as ParserContext);
  markup.pos = t.pos;

  return markup;
};

export type MacroArgument = {
  type: typeof Item.Error,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
} | {
  type: typeof Item.Literal,
  value: string | number | null | undefined | boolean | bigint | RegExp,
  raw?: string,
} | {
  type: typeof Item.Identifier,
  value: string,
} | {
  type: typeof Item.Expression,
  value: Expression,
  raw?: string,
} | {
  type: typeof Item.Link,
  value: LinkMarkup,
};

const GRAVE_CHAR_CODE = '`'.charCodeAt(0);

export type MacroArgumentParser = (str: string, pos?: number) => [MacroArgument[], number, boolean];

// Parse function.
export const generalParser: MacroArgumentParser = (str, pos = 0) => {
  // Initialize the parser.
  const args: MacroArgument[] = [];
  let errored = false;

  const parser = new MacroParameterParser({ ecmaVersion: 11 }, str, pos);
  parser.initParsing(pos);

  // Lex the raw argument string.
  while (parser.type != tokTypes.eof) {
    let expr: Node;

    // try parse link
    const mightBeLink = tryParseLink(str, parser.start);
    if (mightBeLink && !mightBeLink.error) {
      args.push({ type: Item.Link, value: mightBeLink });
      parser.initParsing(mightBeLink.pos);
      continue;
    }

    // try parse grave-annotated parameter
    if (str.charCodeAt(parser.start) === GRAVE_CHAR_CODE) {
      const graveParser = new CustomFenceParser({ ecmaVersion: 11, eofType: 'grave' }, /`/g, str, parser.start + 1);
      graveParser.initParsing(parser.start + 1);
      try {
        expr = graveParser.parseExpression();
        if (graveParser.type !== tokTypes.eof || graveParser.value !== 'grave')
          throw 'grave parser failed';

        // since the same result can be achieved safer with a pair of parentheses, 
        // warn the user the deprecation as well
        console.warn('Grave-fenced expression is deprecated. Use `()` instead.');
        args.push({ type: Item.Expression, value: expr as Expression });
        parser.initParsing(graveParser.pos + 1);
        continue;
      } catch (e) {
        // do nothing
        // try parse as normal format string
      }
    }

    // if failed, try parse js expression
    try {
      expr = parser.parseExpression();
    } catch (e) {
      args.push({ type: Item.Error, value: e });
      errored = true;
      break;
    }

    // if it results in a literal, just save it
    if (expr.type === 'Literal') {
      args.push({
        type: Item.Literal,
        value: (expr as Literal).value,
        raw: (expr as Literal).raw
      });
      continue;
    }

    if (expr.type === 'Identifier') {
      args.push({
        type: Item.Identifier,
        value: (expr as Identifier).name,
      });
    }

    // else save the AST
    args.push({
      type: Item.Expression,
      value: expr as Expression,
      raw: expr.end >= expr.start ? str.substring(expr.start, expr.end) : '',
    });
  }

  let retPos = parser.start;
  if (parser.type === tokTypes.eof && parser.value === 'macro')
    retPos += 2;

  return [args, retPos, errored];
};

export const forParser: MacroArgumentParser = (str, pos = 0) => {
  let type: 'loop' | 'in' | 'of' = 'loop';
  let declaration: 'none' | 'var' | 'let' | 'const' = 'none';
  const args: MacroArgument[] = [];
  const parser = new MacroParameterParser({ ecmaVersion: 11 }, str, pos);
  parser.initParsing(pos);

  if (parser.type === tokTypes._var) {
    declaration = 'var';
    parser.nextToken();
  } else if (parser.type === tokTypes.name && parser.value === 'let') {
    declaration = 'let';
    parser.nextToken();
  } else if (parser.type == tokTypes._const) {
    declaration = 'const';
    parser.nextToken();
  }

  const _p = () => args.push(
    { type: 'Identifier', value: type },
    { type: 'Identifier', value: declaration },
  );

  const expr = parser.parseExpression() as Expression;
  if (expr.type === 'BinaryExpression' && (expr as BinaryExpression).operator === 'in') {
    type = 'in';
    _p();
    args.push(
      { type: 'Expression', value: (expr as BinaryExpression).left as Expression },
      { type: 'Expression', value: (expr as BinaryExpression).right },
    );
  } else {
    if (parser.type === tokTypes.name && parser.value === 'of')
      type = 'of';
    _p();
    args.push({ type: 'Expression', value: expr }); // first parameter
    parser.nextToken(); // jump `of` or semicolon
    args.push({ type: 'Expression', value: parser.parseExpression() as Expression }); // second parameter
    if (type === 'loop') {
      parser.nextToken(); // jump semicolon
      args.push({ type: 'Expression', value: parser.parseExpression() as Expression }); // third parameter
    }
  }

  let retPos = parser.start;
  let errored = false;
  if (parser.type === tokTypes.eof && parser.value === 'macro')
    retPos += 2;
  else
    errored = true;
  return [args, retPos, errored];
};


export type RawMacroRecord = {
  source: string,
  name: string,
  args: string,
  index: number;
};

export type MacroParserConfig = {
  requiresChildren: null | boolean | ((args: MacroArgument[]) => null | boolean),
  closePattern?: string | RegExp,
  contentParser: 'markup' | 'code' | 'text',
  argsParser?: MacroArgumentParser,
  contentTags?: string | string[] | RegExp,
};

export type MacroParserConfigCollection = [
  string | string[],
  Partial<MacroParserConfig>
][];

const defaultConfig: MacroParserConfig = {
  requiresChildren: null,
  contentParser: 'markup',
};

const defaultCollection = (): MacroParserConfigCollection => [
  ['script', { requiresChildren: true, contentParser: 'code' }],
  [['if', 'while', 'switch'], { requiresChildren: true }],
  ['for', { requiresChildren: true , argsParser: forParser }],
  [['elseif', 'elif', 'else'], { requiresChildren: false }],
  [['continue', 'break'], { requiresChildren: false }],
  ['case', { requiresChildren: false }]
];


const macroNameCloseRe = /(\/|end)(.*)/g;

export const generateMacroSyntax = (config?: MacroParserConfigCollection): SyntaxDefinition => {

  const specialConfigs: Record<string, MacroParserConfig> = {};
  for (const [nameMatch, c] of config ?? defaultCollection()) {
    const fullConfig = { ...defaultConfig, ...c };
    if (Array.isArray(nameMatch))
      nameMatch.forEach(n => specialConfigs[n] = fullConfig);
    else
      specialConfigs[nameMatch] = fullConfig;
  }

  const syntax: SyntaxDefinition & { configs: Record<string, MacroParserConfig> } = {
    name: 'macro',
    profiles: ['core'],
    match: new RegExp(`<<(/?${Patterns.macroName})\\s*`, 'gm'),
    configs: specialConfigs,

    handler(w) {

      // parse name

      const matchedName = w.matchGroup[1];

      macroNameCloseRe.lastIndex = 0;
      const closeTest = macroNameCloseRe.exec(matchedName);
      const isClose = !!closeTest;
      const hardClose = isClose && closeTest[1].includes('/');

      const name = closeTest ? (
        hardClose ? 'end' : ''
      ) + closeTest[2] : matchedName;

      // config

      const config = specialConfigs[matchedName] ?? defaultConfig;

      // parse arguments

      const argIndex = w.matchGroup.index + w.matchGroup.length;
      let macroOpenerEnd = -1;
      const nodeArgs: Record<string, unknown> = { name, isClose };
      try {
        const [args, _macroOpenerEnd, errored] = (config.argsParser ?? generalParser)(w.source, argIndex);
        if (errored)
          throw 'arg-parse';
        nodeArgs.args = args;
        macroOpenerEnd = _macroOpenerEnd;
      } catch (e) {
        return false;
      }

      w.node.args = nodeArgs;
      w.node.end = w.nextMatch = macroOpenerEnd;

      // parse children

      const reqChildren = typeof config.requiresChildren === 'function' ? config.requiresChildren(nodeArgs.args as MacroArgument[] ?? []) : config.requiresChildren;
      if (reqChildren === false) {
        return true;
      }

      // else reqChildren is true or null

      const f = w.options.ignoreTerminatorCase ? 'gim' : 'gm';
      const closeMacroRe = config.closePattern
        ? (typeof config.closePattern === 'string' ? new RegExp(config.closePattern, f) : config.closePattern)
        : new RegExp(`<<(?:\\/|end)${name}>>`, f);
      closeMacroRe.lastIndex = macroOpenerEnd;

      const closeMatch = !hardClose && closeMacroRe.exec(w.source);
      nodeArgs.closed = !!closeMatch;

      if (!closeMatch) {
        if (reqChildren === true)
          nodeArgs.error = 'REQ_CHILDREN_NOT_CLOSED';
        return true;
      }

      // else find the terminator

      if (config.contentParser === 'text') {
        // parse text till the close part
        const text = w.source.substring(macroOpenerEnd, closeMatch.index);
        w.node.children = w.node.children ?? [];
        w.node.children.push({
          name: TEXT_NODE, start: macroOpenerEnd, end: closeMatch.index,
          args: { text }, literal: w.options.retainLiteral ? text : undefined,
        });
        w.node.end = w.nextMatch = closeMatch.index + closeMatch.length;

      } else if (config.contentParser === 'code') {
        // parse as js code
        const codeParser = new CustomFenceParser(
          { ecmaVersion: 11, eofType: 'macro-' + matchedName },
          closeMacroRe,
          w.source,
          macroOpenerEnd
        );
        codeParser.initParsing(macroOpenerEnd);

        // check if the parser halts at the right position
        try {
          nodeArgs.content = codeParser.parse();
          if (codeParser.type !== tokTypes.eof || codeParser.value !== 'macro-' + matchedName) {
            throw 'CODE_PARSER_NO_EOF';
          }
          closeMacroRe.lastIndex = codeParser.pos;
          const closeMatch2 = closeMacroRe.exec(w.source);
          if (closeMatch2?.index !== codeParser.pos)
            throw 'CODE_PARSER_TAG_CLOSE_MISMATCH';
          w.node.end = w.nextMatch = closeMatch2.index + closeMatch2.length;

        } catch (e) {
          nodeArgs.error = e;
          const text = w.source.substring(macroOpenerEnd, closeMatch.index);
          nodeArgs.text = text;
          w.node.end = w.nextMatch = closeMatch.index + closeMatch.length;
        }

      } else {
        // parse as markup
        const terminatorHit = w.parse(w.node, closeMacroRe);
        w.node.end = w.nextMatch;
        if (!terminatorHit) {
          nodeArgs.error = 'TERMINATOR_FOUND_NOT_CLOSED';
          nodeArgs.closed = false;
          w.parentChildren.push(...w.node.children ?? []);
          w.node.children = [];
        }

      }

      return true;
    }
  };
  return syntax;
};