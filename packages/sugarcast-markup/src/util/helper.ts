/* eslint-disable no-param-reassign */

import { ParserContext } from '../parser';
import Patterns from '../patterns';


const lookaheadRe = new RegExp(Patterns.inlineCss, 'gm');
const idOrClassRe = new RegExp(`(${Patterns.cssIdOrClassSigil})(${Patterns.anyLetter}+)`, 'g');

export type TagPropertyRecord = {
  classes: string[];
  id: string;
  styles: Record<string, string>;
};

export function inlineCss(w: ParserContext) {
  const css: TagPropertyRecord = { classes: [], id: '', styles: {} as Record<string, string> };
  let matched;

  do {
    lookaheadRe.lastIndex = w.nextMatch;

    const match = lookaheadRe.exec(w.source);

    matched = match && match.index === w.nextMatch;

    if (matched) {
      if (match![1]) {
        css.styles[match![1]] = match![2].trim();
      }
      else if (match![3]) {
        css.styles[match![3]] = match![4].trim();
      }
      else if (match![5]) {
        let subMatch;

        idOrClassRe.lastIndex = 0; // NOTE: Guard against buggy implementations.

        while ((subMatch = idOrClassRe.exec(match![5])) !== null) {
          if (subMatch[1] === '.') {
            css.classes.push(subMatch[2]);
          }
          else {
            css.id = subMatch[2];
          }
        }
      }

      w.nextMatch = lookaheadRe.lastIndex; // eslint-disable-line no-param-reassign
    }
  } while (matched);

  return css;
}

export const createRegex = (inputString: string, flags?: string) => {
  const escapedString = inputString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapedString}$`, flags);
};

export const disableCapture = (regex: RegExp) => {
  const regexStr = regex.source.replace(/\((?!\?[:!=])/g, '(?:');
  return new RegExp(regexStr, regex.flags);
};

// parse multiple regex 
export const createRegexIndexMap = (regexList: RegExp[]): [RegExp[], (number | null)[]] => {
  const regexArray: RegExp[] = [];
  const indexArray: (number | null)[] = [];
  regexList.forEach((r) => {
    regexArray.push(new RegExp(
      r.source, 
      r.flags.includes('g') ? r.flags : (r.flags + 'g')
    ));
    indexArray.push(null);
  });
  return [regexArray, indexArray];
};

export const findAndUpdateMinValueRegex = (
  regexArray: RegExp[],
  indexArray: (number | null)[], // null: first match; NaN: no match
  execArray: (RegExpExecArray | null)[],
  inputString: string,
  index: number, 
  dangerIndex?: number,
) => {
  let minIndex: number = -1;
  let minValue = Number.POSITIVE_INFINITY;

  for (let i = 0; i < regexArray.length; ++i) {
    const regex = regexArray[i];
    const ri = indexArray[i];

    if (ri === null || // never matched
      ri < index || // last result is before the start index
      (dangerIndex != null && ri <= dangerIndex) // last result is not reliable
    ) {
      regex.lastIndex = index;
      const match = regex.exec(inputString);
      if (match) {
        execArray[i] = match;
        indexArray[i] = match.index;
      } else {
        indexArray[i] = NaN; // no match in the passage
      }
    }
    
    const riNew = indexArray[i];
    if (riNew == index) {
      return i;
    }
    if (riNew != null && riNew < minValue) {
      minValue = riNew;
      minIndex = i;
    }
  }

  return minIndex;
};


export type MultiRegexParser = {
  exec: (source: string, index: number) => [number, RegExpExecArray | null];
  lastMatch: number;
};

export const createMultiRegexParser = (regexArray: RegExp[]): MultiRegexParser => {
  const [regexArrayCreated, indexArray] = createRegexIndexMap(regexArray);
  const execArray: (RegExpExecArray | null)[] = Array(indexArray.length).fill(null);
  let lastMatch = 0;
  const exec = (source: string, index: number): [number, RegExpExecArray | null] => {
    const matchResult = findAndUpdateMinValueRegex(
      regexArrayCreated, indexArray, execArray, 
      source, index, lastMatch > index ? lastMatch : undefined,
    );
    lastMatch = index;
    return [matchResult, execArray[matchResult] ?? null];
  };
  return {
    exec,
    get lastMatch() { return lastMatch; },
    set lastMatch(v: number) { 
      lastMatch = v < 0 ? 0 : v;
      if (v < 0) {
        indexArray.fill(null);
        execArray.fill(null);
      } 
    },
  };
};