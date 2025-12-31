/**
 * AST type definitions for SugarCube markup
 * Inspired by harlowe-markup structure but adapted for SugarCube syntax
 */

import { Expression } from 'acorn';
import { MacroArgument } from '../syntax/macro';

// Position information for AST nodes
export interface ASTPosition {
  start?: number;
  end?: number;
  place?: string;
}

// ============================================================================
// Root and Flow Nodes
// ============================================================================

// Root AST node - represents passage content
export type SugarCubeASTNode =
  | PassageFlowNode
  | TextFlowNode
  | MacroNode
  | MacroContainerNode;

export type SugarCubeASTNodeType = SugarCubeASTNode['type'];

// Valid children in passage flow (main content)
export type PassageFlowNode =
  | TextFlowNode
  | MacroNode
  | MacroContainerNode
  | LinkNode
  | ImageNode
  | HtmlTagNode
  | VariableNode;

export type PassageFlowNodeType = PassageFlowNode['type'];

// Valid children in text flow (narrative content)
export type PassageTextFlowNode =
  | TextNode
  | TextElementNode
  | FormattedTextNode;

// Text flow - continuous narrative content
export interface TextFlowNode extends ASTPosition {
  type: 'textFlow';
  children: PassageTextFlowNode[];
}

// ============================================================================
// Text Nodes
// ============================================================================

// Plain text node
export interface TextNode extends ASTPosition {
  type: 'text';
  content: string;
}

// Text elements (line breaks, horizontal rules, etc.)
export interface TextElementNode extends ASTPosition {
  type: 'textElement';
  element: 'lineBreak' | 'horizontalRule' | 'emdash' | 'lineContinuation';
  count?: number; // for lineBreak
}

// Formatted text (bold, italic, etc.)
export interface FormattedTextNode extends ASTPosition {
  type: 'formattedText';
  format: 'strong' | 'em' | 'u' | 'sup' | 'sub' | 's' | 'code';
  children: PassageTextFlowNode[];
}

// ============================================================================
// Link and Image Nodes
// ============================================================================

// Link node [[text->passage]] or [[passage]]
export interface LinkNode extends ASTPosition {
  type: 'link';
  text?: string;
  passage: string;
  setter?: string; // JavaScript code to execute on click
}

// Image node [img[source]]
export interface ImageNode extends ASTPosition {
  type: 'image';
  source: string;
  text?: string; // alt text
  link?: string; // passage to link to
  setter?: string;
  align?: 'left' | 'right';
}

// ============================================================================
// HTML Nodes
// ============================================================================

// HTML tag node
export interface HtmlTagNode extends ASTPosition {
  type: 'htmlTag';
  tagName: string;
  attributes?: Record<string, string | boolean>;
  isVoid?: boolean;
  children?: PassageFlowNode[];
}

// ============================================================================
// Variable Nodes
// ============================================================================

// Variable reference ($variable or _tempVariable)
export interface VariableNode extends ASTPosition {
  type: 'variable';
  name: string;
  isTemp?: boolean; // true for _temp, false for $story
  raw?: string; // original text including $ or _
}

// ============================================================================
// Macro Nodes
// ============================================================================

// Note: MacroArgument is imported from syntax/macro.ts

// Simple macro node (self-closing or with content parsed as children)
export interface MacroNode extends ASTPosition {
  type: 'macro';
  name: string;
  args: MacroArgument[];
  isClose?: boolean;
  closed?: boolean;
  children?: PassageFlowNode[];
  error?: string;
}

// ============================================================================
// Container Macro Nodes (for paired structures)
// ============================================================================

// Container macro that wraps paired tags
export interface MacroContainerNode extends ASTPosition {
  type: 'macroContainer';
  containerType: 'if' | 'switch' | 'for' | 'while' | 'widget' | 'generic';
  branches: MacroBranch[];
}

// A branch in a conditional or switch structure
export interface MacroBranch extends ASTPosition {
  type: 'macroBranch';
  branchType:
    | 'if'
    | 'elseif'
    | 'else'
    | 'case'
    | 'default'
    | 'main'; // main is for non-conditional containers
  condition?: MacroArgument[]; // arguments for if/elseif/case
  children: PassageFlowNode[];
}

// ============================================================================
// Special Structures
// ============================================================================

// List node (ordered or unordered)
export interface ListNode extends ASTPosition {
  type: 'list';
  listType: 'ul' | 'ol';
  level: number;
  children: ListNode[];
  content?: PassageFlowNode[];
}

// Quote node (blockquote)
export interface QuoteNode extends ASTPosition {
  type: 'quote';
  level: number;
  children: QuoteNode[];
  content?: PassageFlowNode[];
}

// Heading node
export interface HeadingNode extends ASTPosition {
  type: 'heading';
  level: number; // 1-6
  children: PassageFlowNode[];
}

// Custom style node (@@style@@)
export interface CustomStyleNode extends ASTPosition {
  type: 'customStyle';
  style: string; // CSS style string
  children: PassageFlowNode[];
}

// Verbatim text node (no parsing)
export interface VerbatimTextNode extends ASTPosition {
  type: 'verbatimText';
  content: string;
}

// Monospaced block node ({{{...}}})
export interface MonospacedBlockNode extends ASTPosition {
  type: 'monospacedBlock';
  content: string;
}

// Comment node
export interface CommentNode extends ASTPosition {
  type: 'comment';
  content: string;
}

// ============================================================================
// Root Document Node
// ============================================================================

// Root document containing all passage content
export interface DocumentNode extends ASTPosition {
  type: 'document';
  children: PassageFlowNode[];
}
