export type PrattToken = PrattOperatorToken | PrattExprToken;

export interface PrattOperatorToken {
  type: 'opr';
  start?: number;
  end?: number;
  value: string;
}

export interface PrattExprToken {
  type: 'expr';
  start?: number;
  end?: number;
  value: any;
}

export type ASTNode = LeafNode | PrefixNode | PostfixNode | BinaryNode;

export interface LeafNode {
  type: 'leaf';
  value: any;
}

export interface PrefixNode {
  type: 'prefix';
  operator: string;
  operand: ASTNode;
}

export interface PostfixNode {
  type: 'postfix';
  operator: string;
  operand: ASTNode;
}

export interface BinaryNode {
  type: 'binary';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export type Associativity = 'left' | 'right';

export interface OperatorConfig {
  precedence: number;
  associativity?: Associativity;
  prefix?: boolean;
  postfix?: boolean;
  infix?: boolean;
}

export class PrattParser {
  private readonly operators: ReadonlyMap<string, OperatorConfig>;
  private tokens: PrattToken[];
  private position: number;

  constructor(operatorConfigs: Record<string, OperatorConfig>) {
    this.operators = new Map(Object.entries(operatorConfigs));
    this.tokens = [];
    this.position = 0;
  }

  parse(tokens: PrattToken[]): ASTNode | undefined {
    if (tokens.length === 0) {
      return undefined;
    }
    this.tokens = tokens;
    this.position = 0;
    return this.parseExpression(0);
  }

  private parseExpression(minPrecedence: number): ASTNode {
    let left = this.parsePrefix();

    while (this.hasNext()) {
      const token = this.peek()!;

      if (token.type !== 'opr') break;

      const config = this.operators.get(token.value);
      if (!config) break;

      // Check for postfix operator
      if (config.postfix && config.precedence >= minPrecedence) {
        this.advance();
        left = {
          type: 'postfix',
          operator: token.value,
          operand: left
        };
        continue;
      }

      // Check for infix operator
      if (config.infix && config.precedence >= minPrecedence) {
        const precedence = config.precedence;
        const associativity = config.associativity || 'left';

        this.advance();

        const nextMinPrecedence = associativity === 'right'
          ? precedence
          : precedence + 1;

        const right = this.parseExpression(nextMinPrecedence);

        left = {
          type: 'binary',
          operator: token.value,
          left,
          right
        };
        continue;
      }

      break;
    }

    return left;
  }

  private parsePrefix(): ASTNode {
    const token = this.advance();

    if (!token) {
      throw new Error('Unexpected end of input');
    }

    if (token.type === 'expr') {
      return {
        type: 'leaf',
        value: token.value
      };
    }

    // Must be prefix operator
    const config = this.operators.get(token.value);
    if (!config || !config.prefix) {
      throw new Error(`Unexpected operator '${token.value}' at prefix position`);
    }

    const operand = this.parseExpression(config.precedence);

    return {
      type: 'prefix',
      operator: token.value,
      operand
    };
  }

  private peek(): PrattToken | undefined {
    return this.tokens[this.position];
  }

  private advance(): PrattToken | undefined {
    return this.tokens[this.position++];
  }

  private hasNext(): boolean {
    return this.position < this.tokens.length;
  }
}