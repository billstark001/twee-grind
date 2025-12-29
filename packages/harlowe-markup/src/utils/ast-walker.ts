import type {
  HarloweASTNode,
  ExpressionNode,
  CodeHookNode,
  TextFlowNode,
  PassageTextFlowNode,
  BuiltinChangerNode,
  MacroNode,
  OperatorNode,
  MacroMetadata,
} from '../markup/types'

export interface ASTWalkEvent {
  node: HarloweASTNode
  entering: boolean
  parent?: HarloweASTNode
  index?: number
}

export type ASTVisitor = (event: ASTWalkEvent) => void | boolean

/**
 * Walk through a Harlowe AST tree in depth-first order
 */
export class ASTWalker {
  private visitor: ASTVisitor

  constructor(visitor: ASTVisitor) {
    this.visitor = visitor
  }

  /**
   * Walk a single node and its descendants
   */
  walk(node: HarloweASTNode, parent?: HarloweASTNode, index?: number): boolean {
    // Enter node
    const continueEnter = this.visitor({ node, entering: true, parent, index })
    if (continueEnter === false) {
      return false
    }

    // Visit children
    this.visitChildren(node)

    // Exit node
    const continueExit = this.visitor({ node, entering: false, parent, index })
    return continueExit !== false
  }

  private visitChildren(node: HarloweASTNode): void {
    switch (node.type) {
      case 'codeHook':
      case 'builtinChanger':
        this.walkArray((node as CodeHookNode | BuiltinChangerNode).children, node)
        break

      case 'textFlow':
        this.walkTextFlowChildren((node as TextFlowNode).children, node)
        break

      case 'macro':
        const macro = node as MacroNode
        this.walkArray(macro.args, node)
        if (macro.chainedMacros) {
          for (const chained of macro.chainedMacros) {
            this.walkArray(chained.args, node)
          }
        }
        if (macro.attachedHook) {
          this.walk(macro.attachedHook, node)
        }
        break

      case 'binary':
        const binary = node as OperatorNode & { type: 'binary' }
        this.walk(binary.left, node)
        this.walk(binary.right, node)
        break

      case 'prefix':
      case 'postfix':
        const unary = node as OperatorNode & { type: 'prefix' | 'postfix' }
        this.walk(unary.operand, node)
        break

      // Leaf nodes with no children
      case 'text':
      case 'textElement':
      case 'link':
      case 'variable':
      case 'rawVariable':
      case 'literal':
        break

      default:
        // Unknown node type - attempt to walk children if they exist
        if ('children' in node && Array.isArray((node as any).children)) {
          this.walkArray((node as any).children, node)
        }
    }
  }

  private walkArray(nodes: HarloweASTNode[], parent: HarloweASTNode): void {
    for (let i = 0; i < nodes.length; i++) {
      const shouldContinue = this.walk(nodes[i], parent, i)
      if (!shouldContinue) {
        break
      }
    }
  }

  private walkTextFlowChildren(nodes: PassageTextFlowNode[], parent: HarloweASTNode): void {
    for (let i = 0; i < nodes.length; i++) {
      const shouldContinue = this.walk(nodes[i] as HarloweASTNode, parent, i)
      if (!shouldContinue) {
        break
      }
    }
  }
}

/**
 * Walk through AST with visitor pattern
 */
export function walkAST(
  node: HarloweASTNode,
  visitor: ASTVisitor
): void {
  const walker = new ASTWalker(visitor)
  walker.walk(node)
}

/**
 * Generator-based AST walker for convenient iteration
 */
export function* traverseAST(
  node: HarloweASTNode,
  parent?: HarloweASTNode,
  index?: number
): Generator<ASTWalkEvent, void, unknown> {
  yield { node, entering: true, parent, index }

  // Visit children based on node type
  switch (node.type) {
    case 'codeHook':
    case 'builtinChanger':
      yield* traverseArrayNodes((node as CodeHookNode | BuiltinChangerNode).children, node)
      break

    case 'textFlow':
      yield* traverseTextFlowChildren((node as TextFlowNode).children, node)
      break

    case 'macro':
      const macro = node as MacroNode
      yield* traverseArrayNodes(macro.args, node)
      if (macro.chainedMacros) {
        for (const chained of macro.chainedMacros) {
          yield* traverseChainedMacro(chained, node, index)
        }
      }
      if (macro.attachedHook) {
        yield* traverseAST(macro.attachedHook, node)
      }
      break

    case 'binary':
      const binary = node as OperatorNode & { type: 'binary' }
      yield* traverseAST(binary.left, node)
      yield* traverseAST(binary.right, node)
      break

    case 'prefix':
    case 'postfix':
      const unary = node as OperatorNode & { type: 'prefix' | 'postfix' }
      yield* traverseAST(unary.operand, node)
      break
  }

  yield { node, entering: false, parent, index }
}

function* traverseChainedMacro(
  chained: MacroMetadata,
  parent: HarloweASTNode,
  index?: number
): Generator<ASTWalkEvent, void, unknown> {
  const node: HarloweASTNode = { type: 'macro', ...chained };
  yield { node, entering: true, parent, index }
  yield* traverseArrayNodes(chained.args, parent)
  yield { node, entering: false, parent, index }
}

function* traverseArrayNodes(
  nodes: HarloweASTNode[],
  parent: HarloweASTNode
): Generator<ASTWalkEvent, void, unknown> {
  for (let i = 0; i < nodes.length; i++) {
    yield* traverseAST(nodes[i], parent, i)
  }
}

function* traverseTextFlowChildren(
  nodes: PassageTextFlowNode[],
  parent: HarloweASTNode
): Generator<ASTWalkEvent, void, unknown> {
  for (let i = 0; i < nodes.length; i++) {
    yield* traverseAST(nodes[i] as HarloweASTNode, parent, i)
  }
}

/**
 * Collect all nodes matching a predicate
 */
export function collectNodes(
  root: HarloweASTNode,
  predicate: (node: HarloweASTNode) => boolean
): HarloweASTNode[] {
  const collected: HarloweASTNode[] = []
  walkAST(root, ({ node, entering }) => {
    if (entering && predicate(node)) {
      collected.push(node)
    }
  })
  return collected
}

/**
 * Find first node matching a predicate
 */
export function findNode(
  root: HarloweASTNode,
  predicate: (node: HarloweASTNode) => boolean
): HarloweASTNode | undefined {
  let found: HarloweASTNode | undefined
  walkAST(root, ({ node, entering }) => {
    if (entering && predicate(node)) {
      found = node
      return false // Stop traversal
    }
  })
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
