import { Expression } from './expression.js'
import type {
  AnyToken,
  CodeHookNode,
  PassageFlowNode,
  MacroToken,
  HookToken,
  TwineLinkToken,
  VariableToken,
  TempVariableToken,
  ExpressionNode,
  MacroNode,
  VariableNode,
  LinkNode,
  PassageTextFlowNode,
  BuiltinChangerNode,
  TextFlowNode,
  UnclosedBuiltinChangerNode,
} from './types.js'
import type { PrattExprToken } from '../utils/pratt-parser.js'

/**
 * Custom error class for parser errors with token position information
 */
export class ParserError extends Error {
  public readonly token?: AnyToken
  public readonly start?: number
  public readonly end?: number
  public readonly place?: string

  constructor(message: string, token?: AnyToken) {
    super(message)
    this.name = 'ParserError'
    this.token = token
    if (token) {
      this.start = token.start
      this.end = token.end
      this.place = token.place
      // Enhance message with position info
      const posInfo = []
      if (token.place) posInfo.push(`passage: ${token.place}`)
      if (token.start !== undefined) posInfo.push(`position: ${token.start}-${token.end}`)
      if (posInfo.length > 0) {
        this.message = `${message} (${posInfo.join(', ')})`
      }
    }
  }
}


function convertLeafToken({ value: _token }: PrattExprToken): ExpressionNode {
  const token = _token as AnyToken
  switch (token.type) {
    case 'macro':
      return parseMacro(token as MacroToken)
    case 'hook':
    case 'unclosedHook':
      return parseHook(token as HookToken)
    case 'variable':
    case 'tempVariable':
      return parseVariable(token as VariableToken | TempVariableToken)
    case 'text':
      return { type: 'rawVariable', name: token.text || '' }
    case 'hookName':
      return { type: 'hookName', name: token.name || '' }

    case 'colour':
    case 'string':
    case 'number':
    case 'boolean':
      return {
        type: 'literal',
        dataType: token.type,
        value: token.text,
      }

    case 'grouping':
      let ret = Expression.parse(
        token.children as AnyToken[] ?? [],
        convertLeafToken,
        false,
      )
      if (!ret) {
        throw new ParserError('Failed to parse grouping token', token)
      }
      return ret

    default:
      throw new ParserError(`Unsupported leaf token type in expression: ${token.type}`, token)
  }
}

/**
 * Parse macro token and its children into MacroNode
 */
function parseMacro(token: MacroToken): MacroNode {
  const prattAST = Expression.parse(
    token.children as AnyToken[] ?? [],
    convertLeafToken,
    false,
  )
  const args: ExpressionNode[] = Expression.extractCommaArgs(prattAST)

  return {
    type: 'macro',
    name: token.name,
    args,
  }
}

/**
 * Parse hook token into CodeHookNode
 */
function parseHook(token: HookToken): CodeHookNode {
  return {
    type: 'codeHook',
    name: token.name || undefined,
    initiallyHidden: token.hidden,
    unclosed: token.type === 'unclosedHook',
    children: parsePassageFlow(token.children as AnyToken[]),
  }
}

/**
 * Parse variable token into VariableNode
 */
function parseVariable(token: VariableToken | TempVariableToken): VariableNode {
  return {
    type: 'variable',
    name: token.name,
    isTemp: token.type === 'tempVariable',
  }
}

/**
 * Parse link token into LinkNode
 */
function parseLink(token: TwineLinkToken): LinkNode {
  return {
    type: 'link',
    text: token.innerText || token.passage,
    passage: token.passage,
  }
}

function handleUnclosedHooks(nodeFlow: PassageFlowNode[]): PassageFlowNode[] {
  const macroIndicesWithUnclosedHooks: number[] = []
  for (let i = 0; i < nodeFlow.length; i++) {
    const node = nodeFlow[i]
    if (node.type === 'macro') {
      const macro = node as MacroNode
      if (macro.attachedHook && macro.attachedHook.unclosed) {
        macroIndicesWithUnclosedHooks.push(i)
      }
    }
  }

  let i: number | undefined
  while ((i = macroIndicesWithUnclosedHooks.pop()) !== undefined) {
    const macro = nodeFlow[i] as MacroNode
    const unclosedHook = macro.attachedHook as CodeHookNode
    const childrenNodes = nodeFlow.splice(i + 1)
    unclosedHook.children.push(...childrenNodes)
  }
  return nodeFlow
}

/**
 * Parse children tokens into CodeHookChildNode array
 */
function parsePassageFlow(tokens: AnyToken[]): PassageFlowNode[] {
  const children: PassageFlowNode[] = []

  const textFlowBuffer: PassageTextFlowNode[] = []
  const flushText = (forceNewNode: boolean = false) => {
    // Merge consecutive text nodes
    if (!textFlowBuffer.length) {
      return
    }
    const mergedBuffer: PassageTextFlowNode[] = []
    for (let i = 0; i < textFlowBuffer.length; i++) {
      const current = textFlowBuffer[i]
      if (current.type === 'text') {
        const last = mergedBuffer[mergedBuffer.length - 1]
        if (last && last.type === 'text') {
          // Merge with previous text node
          last.content += current.content
        } else {
          // Add as new node
          mergedBuffer.push(current)
        }
      } else {
        // Non-text node, just add it
        mergedBuffer.push(current)
      }
    }

    // Replace textFlowBuffer content with merged content
    textFlowBuffer.splice(0, textFlowBuffer.length)

    if (mergedBuffer.length > 0) {
      if (!forceNewNode && children.length > 0 && children[children.length - 1].type === 'textFlow') {
        // Merge with previous textFlow
        const lastTextFlow = children[children.length - 1] as TextFlowNode
        lastTextFlow.children.push(...mergedBuffer)
      } else {
        // Create new textFlow
        children.push({
          type: 'textFlow',
          children: mergedBuffer,
        })
      }
    }
  }

  let currentMacro: MacroNode | null = null
  let macroChainContextText: string | null = null

  const flushMacro = () => {
    if (currentMacro) {
      children.push(currentMacro)
      currentMacro = null
    }
    if (macroChainContextText) {
      textFlowBuffer.push({ type: 'text', content: macroChainContextText })
      macroChainContextText = null
    }
  }

  let leadingChangerType: string | null = null
  let leadingChangerData: any | null = null
  let leadingChangerStartIndex: number | null = null

  const flushLeadingChanger = () => {
    if (leadingChangerType == null || leadingChangerStartIndex == null) {
      return false
    }
    flush(true)
    const changerChildren = children.splice(leadingChangerStartIndex)
    handleUnclosedHooks(changerChildren)
    const child: BuiltinChangerNode = {
      type: 'builtinChanger',
      changer: leadingChangerType,
      children: changerChildren,
    }
    if (leadingChangerData != null) {
      child.data = leadingChangerData
    }
    children.push(child)
    leadingChangerType = null
    leadingChangerData = null
    leadingChangerStartIndex = null
    return true
  }

  const flushMacroChainText = () => {
    if (macroChainContextText != null) {
      textFlowBuffer.push({ type: 'text', content: macroChainContextText })
      macroChainContextText = null
    }
  }

  const flush = (forceNewNode: boolean = false) => {
    flushMacro()
    flushMacroChainText()
    flushText(forceNewNode)
  }

  for (const token of tokens) {

    if (token.type !== 'macro') {
      flushMacroChainText()
    }

    switch (token.type) {
      case 'macro':
        if (currentMacro && macroChainContextText != null) {
          // Handle macro chaining
          // (e.g., (changer1: ...)+(changer2: ...))
          currentMacro.chainedMacros = currentMacro.chainedMacros || []
          const { name, args } = parseMacro(token as MacroToken)
          currentMacro.chainedMacros.push({ name, args })
          macroChainContextText = null
          break
        }
        flush()
        currentMacro = parseMacro(token as MacroToken)
        break

      case 'hook':
      case 'unclosedHook':
        if (currentMacro) {
          // Attach hook to current macro
          // (e.g., (if: ...)[operations])
          currentMacro.attachedHook = parseHook(token as HookToken)
          flush()
          break
        }
        flush()
        children.push(parseHook(token as HookToken))
        break

      case 'twineLink':
        flush()
        children.push(parseLink(token as TwineLinkToken))
        break

      case 'variable':
      case 'tempVariable':
        flush()
        children.push(parseVariable(token as VariableToken | TempVariableToken))
        break

      case 'tag':
      case 'scriptStyleTag':
        flush()
        children.push({
          type: 'htmlTag',
          tag: (token as any).tag
            || token.text?.match(/^<\/?([a-zA-Z0-9\-]+)/)?.[1]
            || (token.type === 'tag' ? 'div' : 'script'),
          content: token.text
        })
        break

      case 'br':
      case 'hr':
      case 'escapedLine':
        if (
          (token.type === 'br' || token.type === 'hr')
          && flushLeadingChanger()
        ) {
          break
        }
        textFlowBuffer.push({ type: 'textElement', element: token.type })
        break

      case 'heading':
      case 'bulleted':
      case 'numbered':
        flushLeadingChanger() || flush(true)
        leadingChangerType = token.type
        leadingChangerData = Expression.extractTokenValue(token, true)
        if (Object.keys(leadingChangerData).length === 0) {
          leadingChangerData = null
        }
        leadingChangerStartIndex = children.length
        break

      // Formatted text nodes
      case 'bold':
      case 'italic':
      case 'strong':
      case 'em':
      case 'strike':
      case 'sub':
      case 'sup':
      case 'collapsed':
        flush()
        const changer = parseBuiltinChanger(token)
        children.push(changer)
        break

      case 'unclosedCollapsed':
      case 'align':
      case 'column':
        flush()
        const unclosedChanger = parseUnclosedBuiltinChanger(token)
        children.push(unclosedChanger)
        break

      case 'verbatim':
        const verbatimNodes = parseVerbatimNodeTextFlow(token)
        textFlowBuffer.push(...verbatimNodes)
        break


      case 'text':
      case 'whitespace':
        if (token.text.trim() === '+' && currentMacro) {
          // Macro chaining context
          // (e.g., (changer1: ...)+(changer2: ...))
          macroChainContextText = token.text
        } else {
          textFlowBuffer.push({ type: 'text', content: token.text || '' })
        }
        break

      default:
        // This should never happen for well-formed tokens
        // unless there is an unclosed macro or hook...
        textFlowBuffer.push({ type: 'text', content: token.text || '' })
    }
  }

  flush()
  flushLeadingChanger()
  handleUnclosedHooks(children)
  return children
}

function parseVerbatimNodeTextFlow(token: AnyToken): PassageTextFlowNode[] {
  const allTexts = token.innerText?.split('\n') || []
  const children: PassageTextFlowNode[] = []

  for (let i = 0; i < allTexts.length; i++) {
    if (i > 0) {
      children.push({ type: 'textElement', element: 'br' })
    }
    if (allTexts[i].length > 0) {
      children.push({ type: 'text', content: allTexts[i] })
    }
  }
  return children
}

function parseBuiltinChanger(token: AnyToken): BuiltinChangerNode {
  const changer = token.type
  return {
    type: 'builtinChanger' as const,
    changer,
    children: parsePassageFlow(token.children || []),
  }
}

function parseUnclosedBuiltinChanger(token: AnyToken): UnclosedBuiltinChangerNode {
  const changer = token.type === 'unclosedCollapsed' ? 'collapsed' : token.type
  const data = Expression.extractTokenValue(token, true)
  const ret: UnclosedBuiltinChangerNode = {
    type: 'unclosedBuiltinChanger' as const,
    changer,
  }
  if (data != null && Object.keys(data).length > 0) {
    ret.data = data
  }
  return ret
}

/**
 * Parse root token into CodeHookNode
 * @param rootToken - Token with type 'root'
 * @returns Parsed CodeHookNode representing the entire passage
 */
export function parseRootToCodeHook(rootToken: AnyToken): CodeHookNode {
  if (rootToken.type !== 'root') {
    throw new ParserError(`Expected root token, got ${rootToken.type}`, rootToken)
  }

  return {
    type: 'codeHook',
    children: parsePassageFlow(rootToken.children || []),
  }
}

/**
 * Main parser export
 */
export const Parser = Object.freeze({
  parse: parseRootToCodeHook,
  parsePassageFlow,
} as const)
