import { Expression } from './expression.js'
import type {
  AnyToken,
  CodeHookNode,
  CodeHookChildNode,
  MacroToken,
  HookToken,
  TwineLinkToken,
  VariableToken,
  TempVariableToken,
  ExpressionNode,
  MacroNode,
  VariableNode,
  LinkNode,
  TextFlowChildNode,
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
    children: parseCodeHookChildren(token.children as AnyToken[]),
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

/**
 * Parse children tokens into CodeHookChildNode array
 */
function parseCodeHookChildren(tokens: AnyToken[]): CodeHookChildNode[] {
  const children: CodeHookChildNode[] = []
  const textFlowBuffer: TextFlowChildNode[] = []
  let currentMacro: MacroNode | null = null
  let marcoChainContextText: string | null = null

  const flushMacro = () => {
    if (currentMacro) {
      children.push(currentMacro)
      currentMacro = null
    }
    if (marcoChainContextText) {
      textFlowBuffer.push({ type: 'text', content: marcoChainContextText })
      marcoChainContextText = null
    }
  }
  const flushText = () => {
    if (textFlowBuffer.length > 0) {
      children.push({
        type: 'textFlow',
        children: [...textFlowBuffer],
      })
      textFlowBuffer.splice(0, textFlowBuffer.length)
    }
  }

  const flush = () => {
    flushMacro()
    flushText()
  }

  for (const token of tokens) {
    switch (token.type) {
      case 'macro':
        if (currentMacro && marcoChainContextText != null) {
          // Handle macro chaining
          // (e.g., (changer1: ...)+(changer2: ...))
          currentMacro.chainedMacros = currentMacro.chainedMacros || []
          const { name, args } = parseMacro(token as MacroToken)
          currentMacro.chainedMacros.push({ name, args })
          marcoChainContextText = null
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

      case 'text':
      case 'whitespace':
        if (token.text.trim() === '+' && currentMacro) {
          // Macro chaining context
          // (e.g., (changer1: ...)+(changer2: ...))
          marcoChainContextText = token.text
        } else {
          textFlowBuffer.push({ type: 'text', content: token.text || '' })
        }
        break

      case 'br':
        textFlowBuffer.push({ type: 'lineBreak' })
        break

      case 'hr':
        textFlowBuffer.push({ type: 'horizontalRule' })
        break

      // Formatted text nodes
      case 'bold':
      case 'italic':
      case 'strong':
      case 'em':
      case 'strike':
      case 'sub':
      case 'sup':
        const formatted = parseFormatted(token)
        textFlowBuffer.push(formatted)
        break

      default:
        // This should never happen for well-formed tokens
        throw new ParserError(`Unexpected token type in code hook children: ${token.type}`, token)
    }
  }

  flush()
  return children
}

/**
 * Parse formatted text token
 */
function parseFormatted(token: AnyToken) {
  const style = token.type
  const textContent: string[] = []

  const extractText = (tokens: AnyToken[]): void => {
    for (const t of tokens) {
      if (t.type === 'text' || t.type === 'whitespace') {
        textContent.push(t.text || '')
      } else if (t.children) {
        extractText(t.children)
      }
    }
  }

  extractText(token.children || [])

  return {
    type: 'formatted' as const,
    style,
    children: [{
      type: 'text' as const,
      content: textContent.join(''),
    }],
  }
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
    children: parseCodeHookChildren(rootToken.children || []),
  }
}

/**
 * Main parser export
 */
export const Parser = Object.freeze({
  parse: parseRootToCodeHook,
  parseCodeHookChildren,
} as const)
