/**
 * Harlowe markup lexer and parser entry point
 */

export const version = '0.1.0';

// Placeholder for lexer implementation
export interface Token {
  type: string;
  value: string;
  position: number;
}

// Placeholder for parser implementation
export interface ASTNode {
  type: string;
  children?: ASTNode[];
}
