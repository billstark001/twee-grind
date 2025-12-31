import type {
  HarloweASTNode,
  ExpressionNode,
  CodeHookNode,
  TextFlowNode,
  BuiltinChangerNode,
  MacroNode,
  OperatorNode,
} from '../markup/types'

export interface ASTWalkEvent {
  node: HarloweASTNode
  entering: boolean
  parent?: HarloweASTNode
  index?: number
}

export type ASTVisitor = (event: ASTWalkEvent) => void | boolean

/**
 * Serialized state of an AST walker
 */
export interface WalkerState {
  stack: Array<{
    node: HarloweASTNode
    parent?: HarloweASTNode
    index?: number
    phase: 'enter' | 'children' | 'exit'
    childIndex: number
  }>
}

/**
 * Walk through a Harlowe AST tree in depth-first order with step-by-step execution
 */
export class ASTWalker {
  private visitor: ASTVisitor
  private stack: Array<{
    node: HarloweASTNode
    parent?: HarloweASTNode
    index?: number
    phase: 'enter' | 'children' | 'exit'
    childIndex: number
  }> = []
  private completed = false
  private skipNodeTypes: Set<string>

  constructor(
    visitor: ASTVisitor,
    options?: {
      initialState?: WalkerState
      skipNodeTypes?: string[]
    }
  ) {
    this.visitor = visitor
    this.skipNodeTypes = new Set(options?.skipNodeTypes ?? [])
    if (options?.initialState) {
      this.stack = options.initialState.stack
    }
  }

  /**
   * Initialize the walker with a root node
   */
  start(node: HarloweASTNode, parent?: HarloweASTNode, index?: number): void {
    if (this.stack.length === 0) {
      this.stack.push({
        node,
        parent,
        index,
        phase: 'enter',
        childIndex: 0,
      })
    }
  }

  /**
   * Execute one step of the walk
   * Returns true if there are more steps, false if completed
   */
  step(): boolean {
    if (this.completed || this.stack.length === 0) {
      this.completed = true
      return false
    }

    const frame = this.stack[this.stack.length - 1]

    switch (frame.phase) {
      case 'enter': {
        const continueEnter = this.visitor({
          node: frame.node,
          entering: true,
          parent: frame.parent,
          index: frame.index,
        })

        if (continueEnter === false) {
          // Skip this subtree entirely
          this.stack.pop()
          return this.stack.length > 0
        }

        // Check if this node type should be skipped
        if (this.skipNodeTypes.has(frame.node.type)) {
          // Skip to exit phase without visiting children
          frame.phase = 'exit'
          return true
        }

        frame.phase = 'children'
        return true
      }

      case 'children': {
        const children = this.getChildren(frame.node)

        if (frame.childIndex < children.length) {
          const child = children[frame.childIndex]
          frame.childIndex++

          this.stack.push({
            node: child.node,
            parent: frame.node,
            index: child.index,
            phase: 'enter',
            childIndex: 0,
          })
          return true
        }

        frame.phase = 'exit'
        return true
      }

      case 'exit': {
        const continueExit = this.visitor({
          node: frame.node,
          entering: false,
          parent: frame.parent,
          index: frame.index,
        })

        this.stack.pop()

        if (continueExit === false) {
          // Stop entire traversal
          this.stack = []
          this.completed = true
          return false
        }

        return this.stack.length > 0
      }
    }
  }

  /**
   * Walk the entire tree to completion
   */
  walk(node: HarloweASTNode, parent?: HarloweASTNode, index?: number): boolean {
    this.start(node, parent, index)

    while (this.step()) {
      // Continue until completion
    }

    return !this.completed || this.stack.length === 0
  }

  /**
   * Check if the walk is completed
   */
  isCompleted(): boolean {
    return this.completed || this.stack.length === 0
  }

  /**
   * Serialize the current walker state
   */
  serialize(): WalkerState {
    return {
      stack: this.stack.map(frame => ({ ...frame })),
    }
  }

  /**
   * Get children of a node
   */
  private getChildren(node: HarloweASTNode): Array<{ node: HarloweASTNode; index?: number }> {
    const children: Array<{ node: HarloweASTNode; index?: number }> = []

    switch (node.type) {
      case 'codeHook':
      case 'builtinChanger':
        (node as CodeHookNode | BuiltinChangerNode).children.forEach((child, i) => {
          children.push({ node: child, index: i })
        })
        break

      case 'textFlow':
        (node as TextFlowNode).children.forEach((child, i) => {
          children.push({ node: child as HarloweASTNode, index: i })
        })
        break

      case 'macro':
        const macro = node as MacroNode
        macro.args.forEach((arg, i) => {
          children.push({ node: arg, index: i })
        })
        if (macro.chainedMacros) {
          macro.chainedMacros.forEach((chained, i) => {
            chained.args.forEach((arg, j) => {
              children.push({ node: arg, index: j })
            })
          })
        }
        if (macro.attachedHook) {
          children.push({ node: macro.attachedHook })
        }
        break

      case 'binary':
        const binary = node as OperatorNode & { type: 'binary' }
        children.push({ node: binary.left })
        children.push({ node: binary.right })
        break

      case 'prefix':
      case 'postfix':
        const unary = node as OperatorNode & { type: 'prefix' | 'postfix' }
        children.push({ node: unary.operand })
        break

      case 'text':
      case 'textElement':
      case 'link':
      case 'variable':
      case 'rawVariable':
      case 'literal':
        // Leaf nodes
        break

      default:
        // Unknown node type - attempt to get children if they exist
        if ('children' in node && Array.isArray((node as any).children)) {
          (node as any).children.forEach((child: HarloweASTNode, i: number) => {
            children.push({ node: child, index: i })
          })
        }
    }

    return children
  }
}

/**
 * Walk through AST with visitor pattern
 */
export function walkAST(
  node: HarloweASTNode,
  visitor: ASTVisitor,
  options?: { skipNodeTypes?: string[] }
): void {
  const walker = new ASTWalker(visitor, options)
  walker.walk(node)
}

/**
 * Generator-based AST walker for convenient iteration
 */
export function* traverseAST(
  node: HarloweASTNode,
  parent?: HarloweASTNode,
  index?: number,
  options?: { skipNodeTypes?: string[] }
): Generator<ASTWalkEvent, void, unknown> {
  const events: ASTWalkEvent[] = []

  const walker = new ASTWalker((event) => {
    events.push(event)
  }, options)

  walker.start(node, parent, index)

  while (!walker.isCompleted()) {
    walker.step()

    // Yield all collected events
    while (events.length > 0) {
      yield events.shift()!
    }
  }
}

/**
 * Collect all nodes matching a predicate
 */
export function collectNodes(
  root: HarloweASTNode,
  predicate: (node: HarloweASTNode) => boolean,
  options?: { skipNodeTypes?: string[] }
): HarloweASTNode[] {
  const collected: HarloweASTNode[] = []
  walkAST(root, ({ node, entering }) => {
    if (entering && predicate(node)) {
      collected.push(node)
    }
  }, options)
  return collected
}

/**
 * Find first node matching a predicate
 */
export function findNode(
  root: HarloweASTNode,
  predicate: (node: HarloweASTNode) => boolean,
  options?: { skipNodeTypes?: string[] }
): HarloweASTNode | undefined {
  let found: HarloweASTNode | undefined
  walkAST(root, ({ node, entering }) => {
    if (entering && predicate(node)) {
      found = node
      return false // Stop traversal
    }
  }, options)
  return found
}

/**
 * Collect all expression nodes from an AST
 */
export function collectExpressions(root: HarloweASTNode): ExpressionNode[] {
  return collectNodes(root, (node): node is ExpressionNode => {
    const type = node.type
    return type === 'macro' || type === 'codeHook' ||
      type === 'variable' || type === 'rawVariable' ||
      type === 'literal' || type === 'binary' ||
      type === 'prefix' || type === 'postfix'
  }) as ExpressionNode[]
}