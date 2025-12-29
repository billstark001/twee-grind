/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { Parser, TokenType } from 'acorn';


export { TokContext, tokContexts, keywordTypes } from 'acorn';


export class ExtensibleParser extends Parser {
  /**
   * 
   * @param {import('acorn').Options} options 
   * @param {string} input 
   * @param {number} [startPos]
   */
  constructor(options, input, startPos) {
    super(options, input, startPos);
  }
}

/**
 * 
 * @param {string} name 
 * @param {any} options 
 * @returns 
 */
export function createKeywordTokenType(name, options = {}) {
  options.keyword = name;
  return new TokenType(name, options);
}