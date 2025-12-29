// Position information for AST nodes
export interface ASTPosition {
  start?: number
  end?: number
  place?: string
}

// Root AST node - represents top-level content structure
export type HarloweASTNode =
  TextFlowNode | LinkNode | ExpressionNode | PassageFlowNode | PassageTextFlowNode

export type HarloweASTNodeType = HarloweASTNode['type']

// Valid children inside code hooks (named hooks like [text]<name|)
export type PassageFlowNode =
  | BuiltinChangerNode
  | UnclosedBuiltinChangerNode
  | TextFlowNode
  | HtmlTagNode
  | CodeHookNode
  | LinkNode
  | MacroNode
  | VariableNode

export type PassageFlowNodeType = PassageFlowNode['type']

// Valid children in text flow (narrative content)
export type PassageTextFlowNode =
  | TextNode
  | TextElementNode

// Text flow - continuous narrative content
export interface TextFlowNode extends ASTPosition {
  type: 'textFlow'
  children: PassageTextFlowNode[]
}

// Plain text node
export interface TextNode extends ASTPosition {
  type: 'text'
  content: string
}

export interface HtmlTagNode extends ASTPosition {
  type: 'htmlTag'
  tag: string // only the tag name, e.g., "div", "span" for now
  content: string
}

// Formatted text with style (bold, italic, etc.)
export interface BuiltinChangerNode extends ASTPosition {
  type: 'builtinChanger'
  changer: string
  data?: any
  children: PassageFlowNode[]
}

export interface UnclosedBuiltinChangerNode extends ASTPosition {
  type: 'unclosedBuiltinChanger'
  changer: string
  data?: any
}

// Void text elements (line breaks, horizontal rules, etc.)
export interface TextElementNode extends ASTPosition {
  type: 'textElement'
  element: string
}

// Passage link [[text->passage]]
export interface LinkNode extends ASTPosition {
  type: 'link'
  text: string
  passage: string
}


// Expression nodes - represents executable code and values
export type ExpressionNode =
  OperatorNode | LiteralNode | VariableNode | RawVariableNode | HookNameNode | MacroNode | CodeHookNode

export type ExpressionNodeType = ExpressionNode['type']

// Operator nodes (unary/binary operations)
export type OperatorNode = UnaryOperatorNode | BinaryOperatorNode

// Unary operator (prefix/postfix)
export interface UnaryOperatorNode extends ASTPosition {
  type: 'prefix' | 'postfix'
  operator: string
  operand: ExpressionNode
}

// Binary operator (infix)
export interface BinaryOperatorNode extends ASTPosition {
  type: 'binary'
  operator: string
  left: ExpressionNode
  right: ExpressionNode
}

// Literal value (number, string, etc.)
export interface LiteralNode extends ASTPosition {
  type: 'literal'
  dataType: string
  value: any
}

// Story/temp variable reference
export interface VariableNode extends ASTPosition {
  type: 'variable'
  name: string
  isTemp?: boolean // _temp vs $story
}

// Raw identifier (reserved words, properties)
export interface RawVariableNode extends ASTPosition {
  type: 'rawVariable'
  name: string // reserved words (num, ...), property accessor (1stto4th, ...), etc.
}

export interface HookNameNode extends ASTPosition {
  type: 'hookName'
  name: string
}

// Macro metadata (name and arguments)
export interface MacroMetadata {
  name: string
  args: ExpressionNode[]
}

// Macro invocation with optional chaining and attached hook
export interface MacroNode extends MacroMetadata, ASTPosition {
  type: 'macro'
  chainedMacros?: MacroMetadata[] // (set:)(if:) chains
  attachedHook?: CodeHookNode // (if: $x)[text]
}

// Code hook - named or unnamed block with optional visibility control
export interface CodeHookNode extends ASTPosition {
  type: 'codeHook'
  storyletMetadata?: Record<string, any>
  name?: string
  initiallyHidden?: boolean // starts with | instead of [
  unclosed?: boolean
  children: PassageFlowNode[]
}
