/***********************************************************************************************************************

  markup/lexer.js

  Copyright © 2013–2023 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
  Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

// End of File.
export const EOF = -1;


export type LexerState = (lexer: Lexer) => LexerState | null;
export type Token = {
  type: string,
  message?: string,
  text: string,
  start: number,
  pos: number,
}




/*******************************************************************************
  Lexer Class.
*******************************************************************************/

export class Lexer {

  readonly source: string;
  readonly initial: LexerState;
  state: LexerState | null;
  start: number = 0;
  pos: number = 0;
  depth: number = 0;
  items: Token[] = [];
  data: Record<string, boolean> = {};

  constructor(source: string, initialState: LexerState) {
    if (arguments.length < 2) {
      throw new Error('Lexer constructor called with too few parameters (source:string , initialState:function)');
    }

    /*
      this.source  → the string to be scanned
      this.initial → initial state
      this.state   → current state
      this.start   → start position of an item
      this.pos     → current position in the source string
      this.depth   → current brace/bracket/parenthesis nesting depth
      this.items   → scanned item queue
      this.data    → lexing data
    */
    this.source = source;
    this.initial = initialState;
    this.state = this.initial;
  }

  reset() {
    this.state = this.initial;
    this.start = 0;
    this.pos = 0;
    this.depth = 0;
    this.items = [];
    this.data = {};
  }

  run() {
    // scan the source string until no states remain
    while (this.state !== null) {
      this.state = this.state(this);
    }

    // return the array of items
    return this.items;
  }

  nextItem() {
    // scan the source string until we have an item or no states remain
    while (this.items.length === 0 && this.state !== null) {
      this.state = this.state(this);
    }

    // return the current item
    return this.items.shift();
  }

  next() {
    if (this.pos >= this.source.length) {
      return EOF;
    }

    return this.source[this.pos++];
  }

  peek() {
    if (this.pos >= this.source.length) {
      return EOF;
    }

    return this.source[this.pos];
  }

  backup(num: number = 1) {
    // if (num) {
    // 	this.pos -= num;
    // }
    // else {
    // 	--this.pos;
    // }
    this.pos -= num || 1;
  }

  forward(num: number = 1) {
    // if (num) {
    // 	this.pos += num;
    // }
    // else {
    // 	++this.pos;
    // }
    this.pos += num || 1;
  }

  ignore() {
    this.start = this.pos;
  }

  accept(valid: string | string[]) {
    const ch = this.next();

    if (ch === EOF) {
      return false;
    }

    if (valid.includes(ch)) {
      return true;
    }

    this.backup();
    return false;
  }

  acceptRe(validRe: RegExp) {
    const ch = this.next();

    if (ch === EOF) {
      return false;
    }

    if (validRe.test(ch)) {
      return true;
    }

    this.backup();
    return false;
  }

  acceptRun(valid: string | string[]) {
    for (; ;) {
      const ch = this.next();

      if (ch === EOF) {
        return;
      }

      if (!valid.includes(ch)) {
        break;
      }
    }

    this.backup();
  }

  acceptRunRe(validRe: RegExp) {
    for (; ;) {
      const ch = this.next();

      if (ch === EOF) {
        return;
      }

      if (!validRe.test(ch)) {
        break;
      }
    }

    this.backup();
  }

  emit(type: string) {
    this.items.push({
      type,
      text: this.source.slice(this.start, this.pos),
      start: this.start,
      pos: this.pos
    });
    this.start = this.pos;
  }

  error(type: string, message: string) {
    if (arguments.length < 2) {
      throw new Error('Lexer.prototype.error called with too few parameters (type:number , message:string)');
    }

    this.items.push({
      type,
      message,
      text: this.source.slice(this.start, this.pos),
      start: this.start,
      pos: this.pos
    });
    return null;
  }

}