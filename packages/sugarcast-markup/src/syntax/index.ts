/***********************************************************************************************************************

  markup/parserlib.js

  Copyright © 2013–2023 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
  Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

import { SyntaxCollection, SyntaxNode } from '../parser';
import Patterns from '../patterns';
import { inlineCss } from '../util/helper';
import { parseLinkMarkup } from './link-markup';
import { MacroParserConfigCollection, generateMacroSyntax } from './macro';
import { generateInlineHtmlSyntax } from './html';

export {
  type MacroParserConfig,
  type MacroParserConfigCollection,
  type MacroArgument,
  type MacroArgumentParser
} from './macro';

export const defaultSyntax = (s?: SyntaxCollection, c?: MacroParserConfigCollection) => {
  s = s ?? new SyntaxCollection();

  s.add({
    name: 'quoteByBlock',
    profiles: ['block'],
    match: /^<<<\n/gm,
    terminator: '^<<<\\n',
    requiresBlockContext: true,
    preventsBlockContext: true,
    handler: 'terminator',
  });

  s.add({
    name: 'quoteByLine',
    profiles: ['block'],
    match: /^>+/gm,
    lookahead: /^>+/gm,
    terminator: '\\n',
    requiresBlockContext: true,
    preventsBlockContext: true,

    handler(w) {

      const destStack = [w.node];
      w.node.children = [];

      let curLevel = 0;
      let newLevel = w.matchLength;
      let lineStart = w.matchStart;
      let matched;
      let i;

      do {
        if (newLevel > curLevel) {
          for (i = curLevel; i < newLevel; ++i) {
            const node: SyntaxNode = {
              name: this.name,
              start: lineStart,
              end: lineStart,
              children: [],
            };
            destStack[destStack.length - 1].children!.push(node);
            destStack.push(node);
          }
        }
        else if (newLevel < curLevel) {
          for (i = curLevel; i > newLevel; --i) {
            const node = destStack.pop();
            node!.end = lineStart;
          }
        }

        curLevel = newLevel;
        w.parse(destStack[destStack.length - 1], this.terminator);

        destStack[destStack.length - 1].end = w.nextMatch;
        lineStart = w.nextMatch;
        this.lookahead!.lastIndex = w.nextMatch;

        const match = this.lookahead!.exec(w.source);
        matched = match && match.index === w.nextMatch;

        if (matched) {
          newLevel = match![0].length;
          w.nextMatch += match![0].length;
        }
      } while (matched);
      destStack.forEach(n => n.end = lineStart);
      return true;
    }
  });

  s.add(generateMacroSyntax(c));

  s.add({
    name: 'link',
    profiles: ['core'],
    match: /\[\[[^[]/gm,

    handler(w) {
      const markup = parseLinkMarkup(w);
      w.node.args = markup;
      w.node.end = w.nextMatch = markup.pos;
      return true;
    }
  });

  s.add({
    name: 'urlLink',
    profiles: ['core'],
    match: new RegExp(Patterns.url, 'gm'),
    handler: 'match',
  });

  s.add({
    name: 'image',
    profiles: ['core'],
    match: /\[[<>]?img\[/gim,

    handler(w) {
      const markup = parseLinkMarkup(w);
      w.node.args = markup;
      w.node.end = w.nextMatch = markup.pos;
      return true;
    }
  });

  s.add({
    name: 'monospacedByBlock',
    profiles: ['block'],
    match: /^\{\{\{\s*\n((?:^[^\n]*\n)+?)(^\}\}\}\s*$\n?)/gm,
    preventsBlockContext: true,

    handler(w) {
      const match = w.matchGroup;
      w.node.args = { text: match[1] ?? match[0] };
      return true;
    }
  });

  const formatDict = Object.freeze<Record<string, string>>({
    '\'\'': 'strong',
    '//': 'em',
    '__': 'u',
    '^^': 'sup',
    '~~': 'sub',
    '==': 's',
  });

  const formatRegexDict = Object.freeze<Record<string, string>>({
    '^^': '\\^\\^'
  });

  const fcLookahead = /\{\{\{((?:.|\n)*?)\}\}\}/gm;
  s.add({
    name: 'formatByChar',
    profiles: ['core'],
    match: /''|\/\/|__|\^\^|~~|==|\{\{\{/gm,

    handler(w) {
      if (w.matchText === '{{{') {
        fcLookahead.lastIndex = w.matchStart;
        const match = fcLookahead.exec(w.source);
        if (match && match.index === w.matchStart) {
          w.node.args = { type: 'code', text: match[1] };
          w.nextMatch = fcLookahead.lastIndex;
        } else {
          return false;
        }
      } else {
        const terminator = formatRegexDict[w.matchText] ?? w.matchText;
        const type = formatDict[w.matchText] ?? w.matchText;
        w.node.args = { type };
        w.parse(w.node, terminator);
      }
      return true;
    }
  });

  const csBlockRe = /\s*\n/gm;
  s.add({
    name: 'customStyle',
    profiles: ['core'],
    match: /@@/gm,
    terminator: '@@',

    handler(w) {
      w.node.args = inlineCss(w);

      csBlockRe.lastIndex = w.nextMatch; // must follow the call to `inlineCss()`

      const blockMatch = csBlockRe.exec(w.source);
      const blockLevel = blockMatch && blockMatch.index === w.nextMatch;

      if (blockLevel) {
        // Skip the leading and, if it exists, trailing newlines.
        w.nextMatch += blockMatch[0].length;
        w.parse(w.node, `\\n?${this.terminator}`);
      }
      else {
        w.parse(w.node, this.terminator);
      }
      return true;
    }
  });

  s.add({
    name: 'verbatimText',
    profiles: ['core'],
    match: /(?:"{3}((?:.|\n)*?)"{3})|(?:<nowiki>((?:.|\n)*?)<\/nowiki>)/gim,

    handler(w) {
      const match = w.matchGroup;
      w.node.args = { text: match[1] || match[2] };
      return true;
    }
  });

  s.add({
    name: 'horizontalRule',
    profiles: ['core'],
    match: /^----+\s*$/gm,
    handler: 'match',
  });

  s.add({
    name: 'emdash',
    profiles: ['core'],
    match: /--/gm,
    handler: 'match',
  });

  s.add({
    name: 'doubleDollarSign',
    profiles: ['core'],
    match: /\${2}/gm,
    handler: 'match',
  });

  s.add({
    /*
      Supported syntax:
        $variable
        $variable.property
        $variable[numericIndex]
        $variable["property"]
        $variable['property']
        $variable[$indexOrPropertyVariable]

      NOTE: I really do not like how the initial bit of the regexp matches.
    */
    name: 'nakedVariable',
    profiles: ['core'],
    match: new RegExp(
      `${Patterns.variable}(?:(?:\\.${Patterns.identifier})|(?:\\[\\d+\\])|(?:\\["(?:\\\\.|[^"\\\\])+"\\])|(?:\\['(?:\\\\.|[^'\\\\])+'\\])|(?:\\[${Patterns.variable}\\]))*`,
      'gm'
    ),
    handler: 'matchText',
  });

  s.add({
    name: 'template',
    profiles: ['core'],
    match: new RegExp(`\\?${Patterns.templateName}`, 'gm'),

    handler(w) {
      const name = w.matchText.slice(1);
      w.node.args = { name };
      return true;
    }
  });

  s.add({
    name: 'heading',
    profiles: ['block'],
    match: /^!{1,6}/gm,
    terminator: '\\n',
    requiresBlockContext: true,
    preventsBlockContext: true,

    handler(w) {
      w.node.args = { level: w.matchLength };
      w.parse(w.node, this.terminator!);
      return true;
    }
  });

  // TODO: re-design table syntax
  // parser.add(TableSyntax);

  s.add({
    name: 'list',
    profiles: ['block'],
    match: /^(?:(?:\*+)|(?:#+))/gm,
    lookahead: /^(?:(\*+)|(#+))/gm,
    terminator: '\\n',
    requiresBlockContext: true,
    preventsBlockContext: true,

    handler(w) {
      w.nextMatch = w.matchStart;

      const destStack = [w.node];
      w.node.children = [];
      let curType = null;
      let curLevel = 0;
      let lineStart = w.matchStart;
      let matched;
      let i: number;

      do {
        this.lookahead!.lastIndex = w.nextMatch;
        const match = this.lookahead!.exec(w.source);
        matched = match && match.index === w.nextMatch;

        if (matched) {
          const newType = match![2] ? 'ol' : 'ul';
          const newLevel = match![0].length;
          lineStart = w.nextMatch;

          if (newLevel > curLevel) {
            for (i = curLevel; i < newLevel; ++i) {
              const node: SyntaxNode = {
                name: this.name,
                start: lineStart,
                end: -1,
                children: [],
              };
              destStack[destStack.length - 1].children!.push(node);
              destStack.push(node);
            }
          }
          else if (newLevel < curLevel) {
            for (i = curLevel; i > newLevel; --i) {
              const node = destStack.pop();
              node!.end = lineStart;
            }
          }
          else if (newLevel === curLevel && newType !== curType) {
            const oldNode = destStack.pop();
            oldNode!.end = lineStart;
            const node: SyntaxNode = {
              name: this.name,
              start: lineStart,
              end: -1,
              children: [],
            };
            destStack[destStack.length - 1].children!.push(node);
            destStack.push(node);
          }

          curLevel = newLevel;
          curType = newType;

          w.nextMatch += match![0].length;
          w.parse(destStack[destStack.length - 1], this.terminator);
        }
      } while (matched);
      for (const d of destStack) {
        d.end = w.nextMatch;
      }
      return true;
    }
  });

  s.add({
    name: 'commentByBlock',
    profiles: ['core'],
    match: /(?:\/(%|\*)(?:(?:.|\n)*?)\1\/)|(?:<!--(?:(?:.|\n)*?)-->)/gm,
    handler: 'match',
  });

  s.add({
    name: 'lineContinuation',
    profiles: ['core'],

    // WARNING: The ordering here is important: end-of-line, start-of-line, end-of-string, start-of-string.
    match: new RegExp(
      `(?:\\\\${Patterns.spaceNoTerminator}*\\n|\\n${Patterns.spaceNoTerminator}*\\\\|\\n?\\\\${Patterns.spaceNoTerminator}*$|^${Patterns.spaceNoTerminator}*\\\\\\n?)`,
      'gm'
    ),

    handler: 'match',
  });

  s.add({
    name: 'lineBreak',
    profiles: ['core'],
    match: /(\r?\n)+/gm,

    handler(w) {
      w.node.args = { enabled: !w.options.noLineBreak, count: w.matchText.split(/\r?\n/g).length - 1 };
      w.node.end = w.nextMatch;
      return true;
    }
  });

  s.add({
    name: 'htmlCharacterReference',
    profiles: ['core'],
    match: /(?:(?:&#?[0-9A-Za-z]{2,8};|.)(?:&#?(?:x0*(?:3[0-6][0-9A-Fa-f]|1D[C-Fc-f][0-9A-Fa-f]|20[D-Fd-f][0-9A-Fa-f]|FE2[0-9A-Fa-f])|0*(?:76[89]|7[7-9][0-9]|8[0-7][0-9]|761[6-9]|76[2-7][0-9]|84[0-3][0-9]|844[0-7]|6505[6-9]|6506[0-9]|6507[0-1]));)+|&#?[0-9A-Za-z]{2,8};)/gm,
    handler: 'matchText',
  });

  s.add({
    name: 'xmlProlog',
    profiles: ['core'],
    match: /<\\?xml[^>]*\\?>/gim,
    handler: 'matchText',
  });

  s.add({
    name: 'verbatimHtml',
    profiles: ['core'],
    match: /<html>((?:.|\n)*?)<\/html>/gim,
    handler: 'matchGroup1'
  });

  s.add({
    name: 'verbatimScriptTag',
    profiles: ['core'],
    match: /<script([^>]*)>((?:.|\n)*?)<\/script>/gim,
    handler: 'matchGroups'
  });

  s.add({
    name: 'styleTag',
    profiles: ['core'],
    match: /<style([^>]*)>((?:.|\n)*?)<\/style>/gim,
    handler: 'matchGroups',
  });

  s.add({
    name: 'svgTag',
    profiles: ['core'],
    match: /<svg[^>]*>/gim,
    lookahead: /<(\/?)svg[^>]*>/gim,

    handler(w) {
      this.lookahead!.lastIndex = w.nextMatch;

      let depth = 1;
      let match;

      while (depth > 0 && (match = this.lookahead!.exec(w.source)) !== null) {
        depth += match[1] === '/' ? -1 : 1;
      }

      w.nextMatch = this.lookahead!.lastIndex;
      const svgTag = w.source.slice(w.matchStart, this.lookahead!.lastIndex) + Array(depth).fill('</svg>').join('');
      w.node.args = { text: svgTag };
      return true;
    },
  });

  s.add(generateInlineHtmlSyntax());

  return s;
};
