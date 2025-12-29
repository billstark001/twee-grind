import { EOF, Lexer } from '../util/lexer';
import { ParserContext, SyntaxDefinition } from '../parser';
import { LinkMarkup, parseLinkMarkup } from './link-markup';
import Patterns from '../patterns';
import { enumFromNamesStr } from '../util/enum';

// Lex item types object.
const Item = enumFromNamesStr([
  'Error',        // error
  'Bareword',     // bare identifier
  'Expression',   // expression (back-quoted)
  'String',       // quoted string (single or double)
  'SquareBracket' // [[…]] or [img[…]]
]);
const spaceRe = new RegExp(Patterns.space);
const notSpaceRe = new RegExp(Patterns.notSpace);
const varTest = new RegExp(`^${Patterns.variable}`);

export type MacroArgType = keyof typeof Item;

// Lexing functions.
function slurpQuote(lexer: Lexer, endQuote: string | typeof EOF) {
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
        return EOF;

      case endQuote:
        break loop;
    }
    /* eslint-enable indent */
  }

  return lexer.pos;
}

function lexSpace(lexer: Lexer) {
  const offset = lexer.source.slice(lexer.pos).search(notSpaceRe);

  if (offset === EOF) {
    // no non-whitespace characters, so bail
    return null;
  }
  else if (offset !== 0) {
    lexer.pos += offset;
    lexer.ignore();
  }

  // determine what the next state is
  switch (lexer.next()) {
  case '`': return lexExpression;
  case '"': return lexDoubleQuote;
  case '\'': return lexSingleQuote;
  case '[': return lexSquareBracket;
  default: return lexBareword;
  }
}

function lexExpression(lexer: Lexer) {
  if (slurpQuote(lexer, '`') === EOF) {
    return lexer.error(Item.Error, 'unterminated backquote expression');
  }

  lexer.emit(Item.Expression);
  return lexSpace;
}

function lexDoubleQuote(lexer: Lexer) {
  if (slurpQuote(lexer, '"') === EOF) {
    return lexer.error(Item.Error, 'unterminated double quoted string');
  }

  lexer.emit(Item.String);
  return lexSpace;
}

function lexSingleQuote(lexer: Lexer) {
  if (slurpQuote(lexer, '\'') === EOF) {
    return lexer.error(Item.Error, 'unterminated single quoted string');
  }

  lexer.emit(Item.String);
  return lexSpace;
}

function lexSquareBracket(lexer: Lexer) {
  const imgMeta = '<>IiMmGg';
  let what;

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

  lexer.emit(Item.SquareBracket);
  return lexSpace;
}

function lexBareword(lexer: Lexer) {
  const offset = lexer.source.slice(lexer.pos).search(spaceRe);
  lexer.pos = offset === EOF ? lexer.source.length : lexer.pos + offset;
  lexer.emit(Item.Bareword);
  return offset === EOF ? null : lexSpace;
}

export type MacroArgument = {
  type: typeof Item.Error,
  value: string,
  message?: string,
} | {
  type: typeof Item.Bareword,
  value: string | number | null | undefined | boolean,
} | {
  type: typeof Item.Expression,
  value: string,
} | {
  type: typeof Item.SquareBracket,
  value: LinkMarkup,
};

// Parse function.
function parseMacroArgs(rawArgsString: string) {
  // Initialize the lexer.
  const lexer = new Lexer(rawArgsString, lexSpace);
  const args: MacroArgument[] = [];

  // Lex the raw argument string.
  for (const item of lexer.run()) {
    const argRaw = item.text;
    let arg: MacroArgument | undefined = undefined;

    switch (item.type) {
    case Item.Error:
      
      arg = { type: Item.Error, value: argRaw, message: item.message };
      break;

    case Item.Bareword: {
      // A variable, so substitute its value.
      if (varTest.test(argRaw)) {
        arg = { type: Item.Expression, value: argRaw };
      }

      // Property access on the settings or setup objects, so try to evaluate it.
      else if (/^(?:settings|setup)[.[]/.test(argRaw)) {
        arg = { type: Item.Expression, value: argRaw };
      }

      // Null literal, so convert it into null.
      else if (argRaw === 'null') {
        arg = { type: Item.Bareword, value: null };
      }

      // Undefined literal, so convert it into undefined.
      else if (argRaw === 'undefined') {
        arg = { type: Item.Bareword, value: undefined };
      }

      // Boolean true literal, so convert it into true.
      else if (argRaw === 'true') {
        arg = { type: Item.Bareword, value: true };
      }

      // Boolean false literal, so convert it into false.
      else if (argRaw === 'false') {
        arg = { type: Item.Bareword, value: false };
      }

      // NaN literal, so convert it into NaN.
      else if (argRaw === 'NaN') {
        arg = { type: Item.Bareword, value: NaN };
      }

      // Attempt to convert it into a number, in case it's a numeric literal.
      else {
        const argAsNum = Number(argRaw);

        if (!Number.isNaN(argAsNum)) {
          arg = { type: Item.Bareword, value: argAsNum };
        }
      }

      break;
    }

    case Item.Expression: {
      const expr = argRaw.slice(1, -1).trim(); // remove the backquotes and trim the expression

      // Empty backquotes.
      if (expr === '') {
        arg = { type: Item.Bareword, value: undefined };
      }

      // Evaluate the expression.
      else {
        /*
          The enclosing parenthesis here are necessary to force a code string
          consisting solely of an object literal to be evaluated as such, rather
          than as a code block.
        */
        arg = { type: Item.Expression, value: `(${expr})` };
      }

      break;
    }

    case Item.String: {
      // Evaluate the string to handle escaped characters.
      let argStr: string;
      try {
        argStr = eval(argRaw);
      } catch {
        argStr = argRaw;
      }
      arg = { type: Item.Bareword, value: argStr };
      break;
    }

    case Item.SquareBracket: {
      const markup = parseLinkMarkup({
        source: argRaw,
        matchStart: 0,
      } as ParserContext);
      arg = { type: Item.SquareBracket, value: markup };
      break;
    }
    }
    args.push(arg ?? { type: Item.Error, value: argRaw, message: 'No Match' });
  }

  return args;
}

export type RawMacroRecord = { 
  source: string, 
  name: string, 
  args: string, 
  index: number;
};

const macroSyntaxRe = new RegExp(`<<(/?${Patterns.macroName})(?:\\s*)((?:(?:/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/)|(?://.*\\n)|(?:\`(?:\\\\.|[^\`\\\\])*\`)|(?:"(?:\\\\.|[^"\\\\])*")|(?:'(?:\\\\.|[^'\\\\])*')|(?:\\[(?:[<>]?[Ii][Mm][Gg])?\\[[^\\r\\n]*?\\]\\]+)|[^>]|(?:>(?!>)))*)>>`, 'gm');
const macroNameCloseRe = /(\/|end)(.*)/g;

const parseMacroTag = (src: string, startIndex: number = 0) => {
  macroSyntaxRe.lastIndex = startIndex;
  const match = macroSyntaxRe.exec(src);

  if (match && match.index === startIndex && match[1]) {
    const nextMatch = macroSyntaxRe.lastIndex;
    const record: RawMacroRecord = {
      source: src.slice(match.index, nextMatch),
      name: match[1],
      args: match[2],
      index: match.index,
    };
    return record;
  }
  return undefined;
};

export const MacroSyntax: SyntaxDefinition = {
  name: 'macro',
  profiles: ['core'],
  match: /<</gm,

  handler(w) {
    
    const record = parseMacroTag(w.source, w.matchStart);
    if (!record) {
      return false;
    }
    macroNameCloseRe.lastIndex = 0;
    const closeTest = macroNameCloseRe.exec(record.name);
    const isClose = !!closeTest;
    const hardClose = isClose && closeTest[1].includes('/');
    const name = closeTest ? (
      hardClose ? 'end' : ''
    ) + closeTest[2] : record.name;

    // T/O/D/O: optimize close match

    const closeMacroPattern = `<<(?:\\/|end)${name}>>`;

    const closeMacroRe = new RegExp(closeMacroPattern, 'gm');
    w.nextMatch = closeMacroRe.lastIndex = record.index + record.source.length;

    const closeMatch = !hardClose && closeMacroRe.exec(w.source);
    if (closeMatch) {
      w.parse(w.node, closeMacroPattern);
    }
    
    w.node.end = w.nextMatch;
    w.node.args = {
      name,
      isClose,
      closed: !!closeMatch,
      args: parseMacroArgs(record.args),
    };

    return true;
  }
};