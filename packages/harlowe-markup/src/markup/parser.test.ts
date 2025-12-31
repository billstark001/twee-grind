import { Parser, ParserError } from './parser.js'
import type { AnyToken, CodeHookNode, MacroNode, VariableNode, LinkNode } from './types'

// Helper to create minimal tokens for testing
const tok = (data: any): AnyToken => data as AnyToken

describe('Parser Module', () => {
  describe('parseRootToCodeHook', () => {
    it('should parse simple root token with text', () => {
      const rootToken = tok({
        type: 'root',
        text: 'Hello World',
        start: 0,
        end: 11,
        children: [
          tok({ type: 'text', text: 'Hello World', start: 0, end: 11 }),
        ],
      })

      const result = Parser.parse(rootToken)
      
      expect(result).toBeDefined()
      expect(result.type).toBe('codeHook')
      expect(result.children).toHaveLength(1)
      expect(result.children[0].type).toBe('textFlow')
    })

    it('should throw error if token is not root type', () => {
      const invalidToken = tok({
        type: 'text',
        text: 'Not a root',
        start: 0,
        end: 10,
      })

      expect(() => Parser.parse(invalidToken)).toThrow(ParserError)
      expect(() => Parser.parse(invalidToken)).toThrow('Expected root token')
    })

    it('should parse root with empty children', () => {
      const rootToken = tok({
        type: 'root',
        text: '',
        start: 0,
        end: 0,
        children: [],
      })

      const result = Parser.parse(rootToken)
      
      expect(result).toBeDefined()
      expect(result.type).toBe('codeHook')
      expect(result.children).toHaveLength(0)
    })
  })

  describe('parsePassageFlow - Basic Tokens', () => {
    it('should parse text tokens', () => {
      const tokens = [
        tok({ type: 'text', text: 'Hello', start: 0, end: 5 }),
        tok({ type: 'text', text: ' ', start: 5, end: 6 }),
        tok({ type: 'text', text: 'World', start: 6, end: 11 }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('textFlow')
      const textFlow = result[0] as any
      expect(textFlow.children.length).toBeGreaterThan(0)
    })

    it('should parse whitespace tokens', () => {
      const tokens = [
        tok({ type: 'text', text: 'Hello', start: 0, end: 5 }),
        tok({ type: 'whitespace', text: '   ', start: 5, end: 8 }),
        tok({ type: 'text', text: 'World', start: 8, end: 13 }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('textFlow')
    })

    it('should parse br tokens', () => {
      const tokens = [
        tok({ type: 'text', text: 'Line 1', start: 0, end: 6 }),
        tok({ type: 'br', text: '\n', start: 6, end: 7 }),
        tok({ type: 'text', text: 'Line 2', start: 7, end: 13 }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('textFlow')
      const textFlow = result[0] as any
      const brElement = textFlow.children.find((c: any) => c.type === 'textElement' && c.element === 'br')
      expect(brElement).toBeDefined()
    })
  })

  describe('parsePassageFlow - Macro Tokens', () => {
    it('should parse simple macro without hook', () => {
      const tokens = [
        tok({
          type: 'macro',
          name: 'print',
          text: '(print: "hello")',
          start: 0,
          end: 16,
          children: [
            tok({ type: 'string', text: '"hello"', start: 8, end: 15 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('macro')
      const macro = result[0] as MacroNode
      expect(macro.name).toBe('print')
      expect(macro.args).toHaveLength(1)
    })

    it('should parse macro with attached hook', () => {
      const tokens = [
        tok({
          type: 'macro',
          name: 'if',
          text: '(if: true)',
          start: 0,
          end: 10,
          children: [
            tok({ type: 'boolean', text: 'true', start: 5, end: 9 }),
          ],
        }),
        tok({
          type: 'hook',
          text: '[Display this]',
          start: 10,
          end: 24,
          children: [
            tok({ type: 'text', text: 'Display this', start: 11, end: 23 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('macro')
      const macro = result[0] as MacroNode
      expect(macro.name).toBe('if')
      expect(macro.attachedHook).toBeDefined()
      expect(macro.attachedHook?.type).toBe('codeHook')
    })

    it('should parse macro with multiple arguments', () => {
      const tokens = [
        tok({
          type: 'macro',
          name: 'set',
          text: '(set: $x, 5)',
          start: 0,
          end: 12,
          children: [
            tok({ type: 'variable', name: '$x', text: '$x', start: 6, end: 8 }),
            tok({ type: 'comma', text: ',', start: 8, end: 9 }),
            tok({ type: 'number', text: '5', start: 10, end: 11 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('macro')
      const macro = result[0] as MacroNode
      expect(macro.args.length).toBeGreaterThan(0)
    })

    it('should parse chained macros', () => {
      const tokens = [
        tok({
          type: 'macro',
          name: 'text-color',
          text: '(text-color: red)',
          start: 0,
          end: 17,
          children: [
            tok({ type: 'colour', text: 'red', start: 13, end: 16 }),
          ],
        }),
        tok({ type: 'text', text: '+', start: 17, end: 18 }),
        tok({
          type: 'macro',
          name: 'text-style',
          text: '(text-style: "bold")',
          start: 18,
          end: 38,
          children: [
            tok({ type: 'string', text: '"bold"', start: 31, end: 37 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('macro')
      const macro = result[0] as MacroNode
      expect(macro.chainedMacros).toBeDefined()
      expect(macro.chainedMacros?.length).toBeGreaterThan(0)
    })
  })

  describe('parsePassageFlow - Hook Tokens', () => {
    it('should parse standalone hook', () => {
      const tokens = [
        tok({
          type: 'hook',
          text: '[Some content]',
          start: 0,
          end: 14,
          children: [
            tok({ type: 'text', text: 'Some content', start: 1, end: 13 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('codeHook')
      const hook = result[0] as CodeHookNode
      expect(hook.children).toHaveLength(1)
    })

    it('should parse named hook', () => {
      const tokens = [
        tok({
          type: 'hook',
          name: 'myHook',
          text: '|myHook>[Content]',
          start: 0,
          end: 17,
          children: [
            tok({ type: 'text', text: 'Content', start: 9, end: 16 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('codeHook')
      const hook = result[0] as CodeHookNode
      expect(hook.name).toBe('myHook')
    })

    it('should parse hidden hook', () => {
      const tokens = [
        tok({
          type: 'hook',
          name: 'secret',
          hidden: true,
          text: '|secret)[(Hidden)]',
          start: 0,
          end: 18,
          children: [
            tok({ type: 'text', text: 'Hidden', start: 10, end: 16 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('codeHook')
      const hook = result[0] as CodeHookNode
      expect(hook.initiallyHidden).toBe(true)
    })

    it('should parse unclosed hook', () => {
      const tokens = [
        tok({
          type: 'unclosedHook',
          text: '[Unclosed',
          start: 0,
          end: 9,
          children: [
            tok({ type: 'text', text: 'Unclosed', start: 1, end: 9 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('codeHook')
      const hook = result[0] as CodeHookNode
      expect(hook.unclosed).toBe(true)
    })
  })

  describe('parsePassageFlow - Variable Tokens', () => {
    it('should parse regular variable', () => {
      const tokens = [
        tok({ type: 'variable', name: '$myVar', text: '$myVar', start: 0, end: 6 }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('variable')
      const variable = result[0] as VariableNode
      expect(variable.name).toBe('$myVar')
      expect(variable.isTemp).toBe(false)
    })

    it('should parse temp variable', () => {
      const tokens = [
        tok({ type: 'tempVariable', name: '_temp', text: '_temp', start: 0, end: 5 }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('variable')
      const variable = result[0] as VariableNode
      expect(variable.name).toBe('_temp')
      expect(variable.isTemp).toBe(true)
    })
  })

  describe('parsePassageFlow - Link Tokens', () => {
    it('should parse simple link', () => {
      const tokens = [
        tok({
          type: 'twineLink',
          passage: 'NextPassage',
          innerText: 'Click here',
          text: '[[Click here->NextPassage]]',
          start: 0,
          end: 27,
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('link')
      const link = result[0] as LinkNode
      expect(link.text).toBe('Click here')
      expect(link.passage).toBe('NextPassage')
    })

    it('should parse link with same text as passage', () => {
      const tokens = [
        tok({
          type: 'twineLink',
          passage: 'SamePassage',
          text: '[[SamePassage]]',
          start: 0,
          end: 15,
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('link')
      const link = result[0] as LinkNode
      expect(link.text).toBe('SamePassage')
      expect(link.passage).toBe('SamePassage')
    })
  })

  describe('parsePassageFlow - Formatted Text', () => {
    it('should parse bold text', () => {
      const tokens = [
        tok({
          type: 'bold',
          text: "''bold''",
          start: 0,
          end: 8,
          children: [
            tok({ type: 'text', text: 'bold', start: 2, end: 6 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('builtinChanger')
      const changer = result[0] as any
      expect(changer.changer).toBe('bold')
    })

    it('should parse italic text', () => {
      const tokens = [
        tok({
          type: 'italic',
          text: '//italic//',
          start: 0,
          end: 10,
          children: [
            tok({ type: 'text', text: 'italic', start: 2, end: 8 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('builtinChanger')
      const changer = result[0] as any
      expect(changer.changer).toBe('italic')
    })

    it('should parse strikethrough text', () => {
      const tokens = [
        tok({
          type: 'strike',
          text: '~~strike~~',
          start: 0,
          end: 10,
          children: [
            tok({ type: 'text', text: 'strike', start: 2, end: 8 }),
          ],
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('builtinChanger')
    })
  })

  describe('parsePassageFlow - HTML Tags', () => {
    it('should parse regular HTML tag', () => {
      const tokens = [
        tok({
          type: 'tag',
          tag: 'div',
          text: '<div class="test">content</div>',
          start: 0,
          end: 31,
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('htmlTag')
      const tag = result[0] as any
      expect(tag.tag).toBe('div')
    })

    it('should parse script/style tag', () => {
      const tokens = [
        tok({
          type: 'scriptStyleTag',
          text: '<script>console.log("test")</script>',
          start: 0,
          end: 37,
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('htmlTag')
    })
  })

  describe('parsePassageFlow - Verbatim', () => {
    it('should parse verbatim with single line', () => {
      const tokens = [
        tok({
          type: 'verbatim',
          innerText: 'verbatim text',
          text: '`verbatim text`',
          start: 0,
          end: 15,
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('textFlow')
    })

    it('should parse verbatim with multiple lines', () => {
      const tokens = [
        tok({
          type: 'verbatim',
          innerText: 'line1\nline2\nline3',
          text: '```line1\nline2\nline3```',
          start: 0,
          end: 23,
        }),
      ]

      const result = Parser.parsePassageFlow(tokens)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('textFlow')
      const textFlow = result[0] as any
      // Should have br elements for line breaks
      const brCount = textFlow.children.filter((c: any) => c.type === 'textElement' && c.element === 'br').length
      expect(brCount).toBe(2) // Two line breaks for three lines
    })
  })

  describe('ParserError', () => {
    it('should create error with token information', () => {
      const token = tok({
        type: 'text',
        text: 'bad',
        start: 10,
        end: 13,
        place: 'TestPassage',
      })

      const error = new ParserError('Test error', token)
      
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('ParserError')
      expect(error.token).toBe(token)
      expect(error.start).toBe(10)
      expect(error.end).toBe(13)
      expect(error.place).toBe('TestPassage')
      expect(error.message).toContain('TestPassage')
      expect(error.message).toContain('10-13')
    })

    it('should create error without token', () => {
      const error = new ParserError('Simple error')
      
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Simple error')
      expect(error.token).toBeUndefined()
    })
  })
})
