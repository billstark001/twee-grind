import { ERROR_NODE, ParserContext, SyntaxDefinition } from '../parser';
import Patterns from '../patterns';

const attrsRe = new RegExp(Patterns.htmlAttributeCapture, 'gm');


const nobrTags = new Set(['audio', 'colgroup', 'datalist', 'dl', 'figure', 'meter', 'ol', 'optgroup', 'picture', 'progress', 'ruby', 'select', 'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul', 'video']);
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr']);

const parseAttributes = (raw: string) => {
  const ret: Record<string, string | boolean> = {};
  attrsRe.lastIndex = 0;
  let match: RegExpExecArray | null;
  let li = 0;
  while ((match = attrsRe.exec(raw))) {
    if (li == attrsRe.lastIndex){
      ++attrsRe.lastIndex;
    }
    ret[match[1]] = match[2] ?? true;
    li = attrsRe.lastIndex;
  }
  return ret;
};

const handler = (w: ParserContext) => {

  const tagMatch = w.matchGroup;
  const tag = tagMatch[1];
  const tagName = tag && tag.toLowerCase();
  if (!tagName) {
    return false;
  }

  const attrs = parseAttributes(tagMatch[2] ?? '');
  const isVoid = voidTags.has(tagName) || !!tagMatch[3];
  const isNobr = nobrTags.has(tagName);
  w.node.args = {
    name: tagName,
    attrs,
    isVoid,
    isNobr,
  };

  let terminator;
  let terminatorMatch;

  if (!isVoid) {
    terminator = `<\\/${tagName}\\s*>`;

    const terminatorRe = new RegExp(terminator, 'gim'); // ignore case during match

    terminatorRe.lastIndex = w.matchStart;
    terminatorMatch = terminatorRe.exec(w.source);
  }

  if (isVoid || terminatorMatch) {

    if (terminatorMatch) {
      /*
        NOTE: There's no catch clause here because this try/finally exists
        solely to ensure that the options stack is properly restored in
        the event that an uncaught exception is thrown during the call to
        `subWikify()`.
      */
      try {
        w.pushOptions({ noLineBreak: isNobr });
        w.parse(w.node, terminator, { ignoreTerminatorCase: true });
      }
      finally {
        w.popOptions();
      }
    }
  }
  else {
    (w.node.children = w.node.children ?? []).push({
      name: ERROR_NODE,
      start: -1,
      end: -1,
      args: { message: `cannot find a closing tag for HTML <${tag}>`, text: `${w.matchText}\u2026` }
    });
  }

  return true;
  
};

export const generateInlineHtmlSyntax = (): SyntaxDefinition => ({
  /*
    NOTE: This parser MUST come after any parser which handles HTML tag-
    like constructs—e.g. 'verbatimText', 'horizontalRule', 'lineBreak',
    'xmlProlog', 'verbatimHtml', 'verbatimSvgTag', 'verbatimScriptTag',
    and 'styleTag'.
  */
  name: 'htmlTag',
  profiles: ['core'],
  match: new RegExp(`<(${Patterns.htmlTagName})((?:${Patterns.htmlAttribute})*)\\s*(\\/?)>`),

  handler

});