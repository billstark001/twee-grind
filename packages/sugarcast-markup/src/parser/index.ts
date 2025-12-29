import { MultiRegexParser, createMultiRegexParser } from '../util/helper';


// Parser profiles object.

type HandlerOption =
  'match' | 'matchText' | 'matchGroups' | 'matchGroup1' |
  'lookahead' | 'lookahead0' | 'lookahead1' |
  'terminator';


export type SyntaxDefinition = {
  name: string;
  profiles: string[];

  match: RegExp;
  lookahead?: RegExp;
  terminator?: string | RegExp;

  requiresBlockContext?: boolean;
  preventsBlockContext?: boolean;
  preventsLineBreak?: boolean;

  handler:
  HandlerOption |
  ((this: SyntaxDefinition, w: ParserContext) => boolean);
};

export type SyntaxNode = {
  name: string;
  start: number;
  end: number;
  args?: Record<string, unknown>;
  literal?: string;
  children?: SyntaxNode[];
};

export const ROOT_NODE = '__root__';
export const TEXT_NODE = '__text__';
export const FRAGMENT_NODE = '__fragment__';
export const ERROR_NODE = '__error__';

const rootNode: SyntaxNode = {
  name: ROOT_NODE,
  start: 0,
  end: 0,
};


// eslint-disable-next-line @typescript-eslint/ban-types
const checkAndThrow = <T>(obj: T, key: keyof T, ...types: (string | Function)[]) => {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    throw new Error('Missing required "name" property');
  }
  if (!types || types.length == 0) {
    return;
  }
  for (const type of types) {
    if (
      typeof type === 'string' ?
        typeof obj[key] === type :
        (obj[key] instanceof type)
    ) {
      return;
    }
  }
  throw new Error(`${JSON.stringify(key)} property must be of type: ${types}`);
};

export class SyntaxCollection {

  // Parser definition array.  Ordering matters, so this must be an ordered list.
  private _parsers: SyntaxDefinition[] = [];
  readonly profiles: ProfileCollection;
  readonly allowNameConflict: boolean;

  constructor(allowNameConflict = false) {
    this.profiles = new ProfileCollection(this);
    this.allowNameConflict = allowNameConflict;
  }

  get parsers() {
    return this._parsers;
  }

  add(parser: SyntaxDefinition, index?: number) {
    // Parser object sanity checks.
    if (typeof parser !== 'object') {
      throw new Error('Wikifier.Parser.add parser parameter must be an object');
    }

    checkAndThrow(parser, 'name', 'string');
    checkAndThrow(parser, 'match', RegExp);
    checkAndThrow(parser, 'profiles', Array);
    checkAndThrow(parser, 'handler', 'string', 'function');

    // Check for an existing parser with the same name.
    if (!this.allowNameConflict && this.has(parser.name)) {
      throw new Error(`cannot clobber existing parser "${parser.name}"`);
    }

    // Add the parser to the end of the array.
    if (index != undefined) {
      this._parsers.splice(index, 0, parser);
    } else {
      this._parsers.push(parser);
    }
  }

  delete(nameOrIndex: string | number) {
    const parserIndex = typeof nameOrIndex === 'number' ?
      nameOrIndex :
      this._parsers.findIndex((parser) => parser.name === nameOrIndex);

    if (parserIndex !== -1) {
      this._parsers.splice(parserIndex, 1);
    }
  }

  isEmpty() {
    return this._parsers.length === 0;
  }

  has(name: string) {
    return !!this._parsers.find((parser) => parser.name === name);
  }

  get(name: string) {
    return this._parsers.find((parser) => parser.name === name) || null;
  }
}

export type ProfileDefinition = {
  parsers: SyntaxDefinition[],
  parserRegExp: MultiRegexParser,
}

export class ProfileCollection {

  private _profiles: Record<string, ProfileDefinition> | undefined;
  private _parsers: SyntaxCollection;

  constructor(parsers: SyntaxCollection) {
    this._parsers = parsers;
    this._profiles = undefined;
  }

  get profiles() {
    return this._profiles;
  }

  compile() {

    const all = this._parsers.parsers;
    const core = all.filter((parser) => !Array.isArray(parser.profiles) || parser.profiles.includes('core'));
    const block = all.filter((parser) => !Array.isArray(parser.profiles) || parser.profiles.includes('block'));

    this._profiles = Object.freeze({
      all: {
        parsers: all,
        parserRegExp: createMultiRegexParser(all.map((parser) => parser.match)),
      },
      core: {
        parsers: core,
        parserRegExp: createMultiRegexParser(core.map((parser) => parser.match)),
      },
      block: {
        parsers: block,
        parserRegExp: createMultiRegexParser(block.map((parser) => parser.match)),
      },
    });

    return this._profiles;
  }

  refresh() {
    if (this._profiles) {
      for (const [, v] of Object.entries(this._profiles)) {
        v.parserRegExp.lastMatch = -1;
      }
    }
  }

  isEmpty() {
    return typeof this._profiles !== 'object' || Object.keys(this._profiles).length === 0;
  }

  get(profile: string) {
    if (typeof this._profiles !== 'object' || !Object.prototype.hasOwnProperty.call(this._profiles, profile)) {
      throw new Error(`nonexistent parser profile "${profile}"`);
    }

    return this._profiles[profile];
  }

  has(profile: string) {
    return typeof this._profiles === 'object' && Object.prototype.hasOwnProperty.call(this._profiles, profile);
  }
}

export type ParserOptions = {
  profile: string;
  retainLiteral: boolean;
  ignoreTerminatorCase: boolean;
  createNewTerminatorRegex: boolean;
  noLineBreak: boolean;
  noBlockContext: boolean;
  cleanup: boolean;
};

export type ParserContext = {

  readonly source: string;
  readonly options: Readonly<ParserOptions>;
  readonly parse: (
    output: SyntaxNode | undefined,
    terminator?: RegExp | string | undefined,
    options?: Partial<ParserOptions>
  ) => boolean;
  readonly pushOptions: (options: Partial<ParserOptions>) => void;
  readonly popOptions: () => void;

  readonly node: SyntaxNode;
  readonly parentChildren: SyntaxNode[];

  readonly matchStart: number;
  readonly matchLength: number;
  readonly matchText: string;
  readonly matchGroup: RegExpExecArray;

  nextMatch: number;
};


export class ParserOptionsStack {
  private _optionsStack: Partial<ParserOptions>[] = [];

  constructor() {
    // Options array (stack).
  }

  /*
    GlobalOption Functions.
  */
  public get length(): number {
    return this._optionsStack.length;
  }

  public get options() {
    return [...this._optionsStack];
  }

  public clear() {
    this._optionsStack = [];
  }

  public get(index: number) {
    return this._optionsStack[index];
  }

  public pop() {
    return this._optionsStack.pop();
  }

  public push(options: Partial<ParserOptions>): number {
    if (typeof options !== 'object' || options === null) {
      throw new TypeError(`Wikifier.Option.push options parameter must be an object (received: ${typeof options})`);
    }

    return this._optionsStack.push(options);
  }
}

export class Parser {

  matchStart = 0;
  matchLength = 0;
  nextMatch = 0;

  readonly syntax: SyntaxCollection;
  readonly initOptions: ParserOptionsStack;
  readonly selfOptions: ParserOptions;

  private _source = '';
  private _node: SyntaxNode = { ...rootNode };
  get source() {
    return this._source;
  }
  get node() {
    return this._node;
  }

  constructor(syntax: SyntaxCollection, options?: Partial<ParserOptions>) {
    this.syntax = syntax;

    this.selfOptions = {
      profile: 'all',
      retainLiteral: false,
      ignoreTerminatorCase: false,
      createNewTerminatorRegex: false,
      noLineBreak: false,
      noBlockContext: false,
      cleanup: false,
      ...options
    };

    this.initOptions = new ParserOptionsStack();
  }


  init(source: string) {
    this._source = typeof source === 'string' ? source : String(source);
    this._node = {
      ...rootNode,
      end: this._source.length,
      literal: this.selfOptions.retainLiteral ? this._source : undefined,
      children: [],
    };
    this.matchLength = 0;
    this.matchStart = 0;
    this.nextMatch = 0;

    if (this.syntax.profiles.isEmpty()) {
      this.syntax.profiles.compile();
    }
    this.syntax.profiles.refresh();
  }

  createTextNode(start: number, end: number, retainLiteral: boolean): SyntaxNode {
    const text = this.source.substring(start, end);
    return {
      name: TEXT_NODE,
      start,
      end,
      args: { text },
      literal: retainLiteral ? text : undefined,
    };
  }

  parseTo(output: SyntaxNode | undefined, terminator?: RegExp | string | undefined, options?: Partial<ParserOptions>): boolean {
    // Cache and temporarily replace the current output buffer.
    const outputNode: SyntaxNode = output ?? this._node;

    const currentOptions: ParserOptions = { ...this.selfOptions };

    // Parser option overrides.
    if (this.initOptions.length > 0) {
      Object.assign(currentOptions, this.initOptions.options);
    }
    // Local parameter option overrides.
    if (options !== null && typeof options === 'object') {
      Object.assign(currentOptions, options);
    }

    const parsersProfile = this.syntax.profiles.get(currentOptions.profile);
    const terminatorRegExp = terminator instanceof RegExp
      ? (currentOptions.createNewTerminatorRegex 
        ? new RegExp(terminator.source, terminator.flags) 
        : terminator)
      : (terminator
        ? new RegExp(terminator, currentOptions.ignoreTerminatorCase ? 'gim' : 'gm')
        : null);

    let terminatorMatch: RegExpExecArray | null;
    let parserMatch: RegExpExecArray | null;
    let matchingParser: number;

    do {
      // Prepare the RegExp match positions.
      parsersProfile.parserRegExp.lastMatch = this.nextMatch;

      if (terminatorRegExp) {
        terminatorRegExp.lastIndex = this.nextMatch;
      }

      // Get the first matches.
      [matchingParser, parserMatch] = parsersProfile.parserRegExp.exec(this.source, this.nextMatch);
      terminatorMatch = terminatorRegExp ? terminatorRegExp.exec(this.source) : null;

      // Try for a terminator match, unless there's a closer parser match.
      if (terminatorMatch && (!parserMatch || terminatorMatch.index <= parserMatch.index)) {
        // Output any text before the match.
        if (terminatorMatch.index > this.nextMatch) {
          outputNode.children = outputNode.children ?? [];
          outputNode.children.push(this.createTextNode(this.nextMatch, terminatorMatch.index, currentOptions.retainLiteral));
        }

        // Set the match parameters.
        this.matchStart = terminatorMatch.index;
        this.matchLength = terminatorMatch[0].length;
        this.nextMatch = terminatorRegExp!.lastIndex;

        // Exit.
        return true;
      }

      // Try for a parser match.
      else if (parserMatch) {
        // Output any text before the match.
        if (parserMatch.index > this.nextMatch) {
          outputNode.children = outputNode.children ?? [];
          outputNode.children.push(this.createTextNode(this.nextMatch, parserMatch.index, currentOptions.retainLiteral));
        }

        // Set the match parameters.
        this.matchStart = parserMatch.index;
        this.matchLength = parserMatch[0].length;
        this.nextMatch = parserMatch.index + parserMatch[0].length;

        // Call the parser.

        const syntax = parsersProfile.parsers[matchingParser];
        if (!syntax || (syntax.requiresBlockContext && currentOptions.noBlockContext)) {
          // there is no block context, but the syntax requires it
          // output as text
          outputNode.children = outputNode.children ?? [];
          outputNode.children.push(this.createTextNode(this.matchStart, this.nextMatch, currentOptions.retainLiteral));
          continue;
        }

        const node: SyntaxNode = {
          name: syntax.name,
          start: this.matchStart,
          end: -1,
        };
        (outputNode.children = outputNode.children ?? []).push(node);


        const matchText = parserMatch[0];
        const matchGroup = parserMatch;

        if (typeof syntax.handler === 'function') {
          const context: ParserContext = {
            source: this.source,
            node,
            parentChildren: outputNode.children,

            matchStart: this.matchStart,
            matchLength: this.matchLength,
            matchText,
            matchGroup,

            nextMatch: this.nextMatch,
            options: currentOptions,
            pushOptions: this.initOptions.push.bind(this.initOptions),
            popOptions: this.initOptions.pop.bind(this.initOptions),
            parse: (output, terminator, options) => {
              if (syntax.preventsBlockContext) {
                options = { ...options, noBlockContext: true };
              }
              if (syntax.preventsLineBreak) {
                options = { ...options, noLineBreak: true };
              }
              this.nextMatch = context.nextMatch;
              const ret = this.parseTo(output, terminator, options);
              context.nextMatch = this.nextMatch;
              return ret;
            },
          };
          if (syntax.handler(context)) {
            this.nextMatch = context.nextMatch;
            node.end = this.nextMatch;
          } else {
            node.name = TEXT_NODE;
            node.end = this.matchStart + this.matchLength;
          }

        } else if (syntax.handler === 'terminator') {
          if (syntax.terminator == null) {
            throw new Error('null terminator');
          }
          this.parseTo(node, syntax.terminator);
          node.end = this.nextMatch;

        } else if (syntax.handler === 'match') {
          node.end = this.nextMatch;

        } else if (syntax.handler === 'matchText') {
          node.args = { text: matchText };
          node.end = this.nextMatch;

        } else if (syntax.handler === 'matchGroups') {
          const content = [...matchGroup];
          content.splice(0, 1);
          node.args = { content };
          node.end = this.nextMatch;

        } else if (syntax.handler.startsWith('matchGroup')) {
          const index = Number(syntax.handler.substring('matchGroup'.length).trim());
          node.args = { text: matchGroup[isNaN(index) ? 1 : index] };
          node.end = this.nextMatch;

        } else if (syntax.handler.startsWith('lookahead')) {
          if (syntax.lookahead == null) {
            throw new Error('null lookahead');
          }

          syntax.lookahead.lastIndex = this.matchStart;
          const match = syntax.lookahead.exec(this.source);

          if (match && match.index === this.matchStart) {
            node.end = syntax.lookahead.lastIndex;
            this.nextMatch = syntax.lookahead.lastIndex;

            if (syntax.handler.endsWith('0')) {
              node.args = { text: match[0] };
            } else if (syntax.handler.endsWith('1')) {
              const a = [...match];
              a.splice(0, 1);
              node.args = { content: a };
            }
          }
        }

        if (currentOptions.retainLiteral) {
          node.literal = this.source.substring(node.start, node.end);
        }

      }
    } while (terminatorMatch || parserMatch);

    if (this.nextMatch < this.source.length) {
      outputNode.children = outputNode.children ?? [];
      outputNode.children.push(this.createTextNode(this.nextMatch, this.source.length, currentOptions.retainLiteral));
    }

    return false;

  }


  parse(source: string): SyntaxNode {
    this.init(source);
    this.parseTo(this._node);
    return this._node;
  }

}