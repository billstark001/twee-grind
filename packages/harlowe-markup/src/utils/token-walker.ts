import { Lexer } from "../markup/lexer";
import { AnyToken } from "../markup/types";


export type TokenWalkerEvent = {
  node: AnyToken;
  entering: boolean;
};

export class TokenWalker {

  readonly rootNode: AnyToken;
  /**
   * [0]: node
   * [1]: next children index
   */
  private readonly _nodes: [AnyToken, number][];
  private _firstStep: boolean;

  private get currentNodeInner(): [AnyToken | undefined, number] {
    if (this._nodes.length === 0)
      return [undefined, -1];
    return this._nodes[this._nodes.length - 1];
  }

  get currentNode() {
    return this.currentNodeInner[0];
  }

  get hasNext() {
    return this._nodes.length > 0;
  }


  constructor(rootNode: string | AnyToken) {
    this.rootNode = typeof rootNode === 'string' ? (Lexer.lex(rootNode) as AnyToken) : rootNode;
    this._nodes = [];
    this._firstStep = false;
    this.reset();
  }

  reset() {
    this._nodes.splice(0, this._nodes.length);
    if (this.rootNode != undefined) {
      this._firstStep = true;
      this._nodes.push([this.rootNode, 0]);
    } else {
      this._firstStep = false;
    }
  }

  /**
   * 
   * @returns `CodeWalkerEvent` if `this.hasNext` else `undefined`
   */
  step(): TokenWalkerEvent | undefined {
    if (this._firstStep) {
      this._firstStep = false;
      return { node: this.rootNode, entering: true };
    }

    const [cur, ind] = this.currentNodeInner;
    if (cur == undefined) {
      // we have already reached the end
      return undefined;
    }
    if (cur.children !== undefined && cur.children.length > 0) {
      // cur has children
      if (ind < cur.children.length) {
        // cur has looked for its partial children
        this.currentNodeInner[1] += 1;
        this._nodes.push([cur.children[ind], 0]);
        return { node: this.currentNode!, entering: true };
      }
    }
    // either cur has no children, or all of its children are visited
    // pop the current node
    this._nodes.pop();
    return { node: cur, entering: false };
  }

  /**
   * skip the node and its all trailing nodes.
   */
  skip(): TokenWalkerEvent | undefined {
    if (this._firstStep) {
      this._firstStep = false;
      return { node: this.rootNode, entering: true };
    }

    const [cur] = this.currentNodeInner;
    if (cur == undefined) {
      return undefined;
    }
    this._nodes.pop();
    return { node: cur, entering: false };
  }

  [Symbol.iterator]() {
    return {
      next: (): IteratorResult<TokenWalkerEvent> => {
        const event = this.step();
        if (event) {
          return { done: false, value: event };
        } else {
          return { done: true, value: undefined as any };
        }
      }
    };
  }

}