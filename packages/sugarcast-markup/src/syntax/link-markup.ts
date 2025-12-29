import { enumFromNames, enumFromNamesStr } from '../util/enum';
import { EOF, Lexer, LexerState } from '../util/lexer';

// Lex item types object.
const Item = enumFromNamesStr([
  'Error',     // error
  'DelimLTR',  // '|' or '->'
  'DelimRTL',  // '<-'
  'InnerMeta', // ']['
  'ImageMeta', // '[img[', '[<img[', or '[>img['
  'LinkMeta',  // '[['
  'Link',      // link destination
  'RightMeta', // ']]'
  'Setter',    // setter expression
  'Source',    // image source
  'Text'       // link text or image alt text
]);

// Delimiter state object.
const Delim = enumFromNames([
  'None', // no delimiter encountered
  'LTR',  // '|' or '->'
  'RTL'   // '<-'
]);

// Lexing functions.
function slurpQuote(lexer: Lexer, endQuote: string) {
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

export const lexLeftMeta: LexerState = (lexer: Lexer) => {
  if (!lexer.accept('[')) {
    return lexer.error(Item.Error, 'malformed square-bracketed markup');
  }

  // Is link markup.
  if (lexer.accept('[')) {
    lexer.data.isLink = true;
    lexer.emit(Item.LinkMeta);
  }

  // May be image markup.
  else {
    lexer.accept('<>'); // aligner syntax

    if (!lexer.accept('Ii') || !lexer.accept('Mm') || !lexer.accept('Gg') || !lexer.accept('[')) {
      return lexer.error(Item.Error, 'malformed square-bracketed markup');
    }

    lexer.data.isLink = false;
    lexer.emit(Item.ImageMeta);
  }

  lexer.depth = 2; // account for both initial left square brackets
  return lexCoreComponents;
};

function lexCoreComponents(lexer: Lexer) {
  const what = lexer.data.isLink ? 'link' : 'image';
  let delim = Delim.None;

  for (; ;) {
    switch (lexer.next()) {
    case EOF:
    case '\n':
      return lexer.error(Item.Error, `unterminated ${what} markup`);

    case '"':
      /*
            This is not entirely reliable within sections that allow raw strings, since
            it's possible, however unlikely, for a raw string to contain unpaired double
            quotes.  The likelihood is low enough, however, that I'm deeming the risk as
            acceptable—for now, at least.
          */
      if (slurpQuote(lexer, '"') === EOF) {
        return lexer.error(Item.Error, `unterminated double quoted string in ${what} markup`);
      }
      break;

    case '|': // possible pipe ('|') delimiter
      if (delim === Delim.None) {
        delim = Delim.LTR;
        lexer.backup();
        lexer.emit(Item.Text);
        lexer.forward();
        lexer.emit(Item.DelimLTR);
        // lexer.ignore();
      }
      break;

    case '-': // possible right arrow ('->') delimiter
      if (delim === Delim.None && lexer.peek() === '>') {
        delim = Delim.LTR;
        lexer.backup();
        lexer.emit(Item.Text);
        lexer.forward(2);
        lexer.emit(Item.DelimLTR);
        // lexer.ignore();
      }
      break;

    case '<': // possible left arrow ('<-') delimiter
      if (delim === Delim.None && lexer.peek() === '-') {
        delim = Delim.RTL;
        lexer.backup();
        lexer.emit(lexer.data.isLink ? Item.Link : Item.Source);
        lexer.forward(2);
        lexer.emit(Item.DelimRTL);
        // lexer.ignore();
      }
      break;

    case '[':
      ++lexer.depth;
      break;

    case ']': {
      --lexer.depth;

      if (lexer.depth === 1) {
        switch (lexer.peek()) {
        case '[':
          ++lexer.depth;
          lexer.backup();

          if (delim === Delim.RTL) {
            lexer.emit(Item.Text);
          }
          else {
            lexer.emit(lexer.data.isLink ? Item.Link : Item.Source);
          }

          lexer.forward(2);
          lexer.emit(Item.InnerMeta);
          // lexer.ignore();
          return lexer.data.isLink ? lexSetter : lexImageLink;

        case ']':
          --lexer.depth;
          lexer.backup();

          if (delim === Delim.RTL) {
            lexer.emit(Item.Text);
          }
          else {
            lexer.emit(lexer.data.isLink ? Item.Link : Item.Source);
          }

          lexer.forward(2);
          lexer.emit(Item.RightMeta);
          // lexer.ignore();
          return null;

        default:
          return lexer.error(Item.Error, `malformed ${what} markup`);
        }
      }

      break;
    }
    }
  }
}

function lexImageLink(lexer: Lexer) {
  const what = lexer.data.isLink ? 'link' : 'image';

  for (; ;) {
    switch (lexer.next()) {
    case EOF:
    case '\n':
      return lexer.error(Item.Error, `unterminated ${what} markup`);

    case '"':
      /*
            This is not entirely reliable within sections that allow raw strings, since
            it's possible, however unlikely, for a raw string to contain unpaired double
            quotes.  The likelihood is low enough, however, that I'm deeming the risk as
            acceptable—for now, at least.
          */
      if (slurpQuote(lexer, '"') === EOF) {
        return lexer.error(Item.Error, `unterminated double quoted string in ${what} markup link component`);
      }
      break;

    case '[':
      ++lexer.depth;
      break;

    case ']': {
      --lexer.depth;

      if (lexer.depth === 1) {
        switch (lexer.peek()) {
        case '[': {
          ++lexer.depth;
          lexer.backup();
          lexer.emit(Item.Link);
          lexer.forward(2);
          lexer.emit(Item.InnerMeta);
          // lexer.ignore();
          return lexSetter;
        }

        case ']': {
          --lexer.depth;
          lexer.backup();
          lexer.emit(Item.Link);
          lexer.forward(2);
          lexer.emit(Item.RightMeta);
          // lexer.ignore();
          return null;
        }

        default:
          return lexer.error(Item.Error, `malformed ${what} markup`);
        }
      }

      break;
    }
    }
  }
}

function lexSetter(lexer: Lexer) {
  const what = lexer.data.isLink ? 'link' : 'image';

  for (; ;) {
    switch (lexer.next()) {
    case EOF:
    case '\n':
      return lexer.error(Item.Error, `unterminated ${what} markup`);

    case '"':
      if (slurpQuote(lexer, '"') === EOF) {
        return lexer.error(Item.Error, `unterminated double quoted string in ${what} markup setter component`);
      }
      break;

    case '\'':
      if (slurpQuote(lexer, '\'') === EOF) {
        return lexer.error(Item.Error, `unterminated single quoted string in ${what} markup setter component`);
      }
      break;

    case '[':
      ++lexer.depth;
      break;

    case ']': {
      --lexer.depth;

      if (lexer.depth === 1) {
        if (lexer.peek() !== ']') {
          return lexer.error(Item.Error, `malformed ${what} markup`);
        }

        --lexer.depth;
        lexer.backup();
        lexer.emit(Item.Setter);
        lexer.forward(2);
        lexer.emit(Item.RightMeta);
        // lexer.ignore();
        return null;
      }

      break;
    }
    }
  }
}

export type LinkMarkup = { 
  error?: string; 
  isImage?: boolean; 
  isLink?: boolean; 
  forceInternal?: boolean; 
  align?: 'left' | 'right'; 
  link?: string; 
  setter?: string; 
  source?: string; 
  text?: string; 
  pos: number; 
};

type LesserParserContext = {
  readonly source: string;
  readonly matchStart: number;
}

// Parse function.
export function parseLinkMarkup(w: LesserParserContext) {
  // Initialize the lexer.
  const lexer = new Lexer(w.source, lexLeftMeta);

  // Set the initial positions within the source string.
  lexer.start = lexer.pos = w.matchStart;

  // Lex the raw argument string.
  const markup: LinkMarkup = { pos: -1 };
  const items = lexer.run();
  const last = items[items.length - 1];

  if (last && last.type === Item.Error) {
    markup.error = last.message;
  }
  else {
    items.forEach((item) => {
      const text = item.text.trim();

      switch (item.type) {
      case Item.ImageMeta:
        markup.isImage = true;

        if (text[1] === '<') {
          markup.align = 'left';
        }
        else if (text[1] === '>') {
          markup.align = 'right';
        }
        break;

      case Item.LinkMeta:
        markup.isLink = true;
        break;

      case Item.Link:
        if (text[0] === '~') {
          markup.forceInternal = true;
          markup.link = text.slice(1);
        }
        else {
          markup.link = text;
        }
        break;

      case Item.Setter:
        markup.setter = text;
        break;

      case Item.Source:
        markup.source = text;
        break;

      case Item.Text:
        markup.text = text;
        break;
      }
    });
  }

  markup.pos = lexer.pos;
  return markup;
}