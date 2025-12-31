import { Markup } from './markup.js'
import type { CodeHookNode, MacroNode, TextFlowNode, VariableNode, PassageFlowNode, PassageTextFlowNode } from './types'

describe('Parser Integration Tests (Lexer + Parser)', () => {
  describe('Simple Expressions', () => {
    it('should parse simple text', () => {
      const source = 'Hello World'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.type).toBe('codeHook')
      expect(result.children).toHaveLength(1)
      expect(result.children[0].type).toBe('textFlow')
      
      const textFlow = result.children[0] as TextFlowNode
      expect(textFlow.children.some((c: PassageTextFlowNode) => c.type === 'text' && c.content === 'Hello World')).toBe(true)
    })

    it('should parse text with line breaks', () => {
      const source = 'Line 1\nLine 2\nLine 3'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.type).toBe('codeHook')
      
      const textFlow = result.children[0] as TextFlowNode
      const brElements = textFlow.children.filter((c: PassageTextFlowNode) => c.type === 'textElement' && c.element === 'br')
      expect(brElements.length).toBeGreaterThan(0)
    })

    it('should parse formatted text (bold)', () => {
      const source = "This is ''bold'' text"
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const boldNode = result.children.find((c: PassageFlowNode) => c.type === 'builtinChanger')
      expect(boldNode).toBeDefined()
      expect((boldNode as any).changer).toBe('bold')
    })

    it('should parse formatted text (italic)', () => {
      const source = 'This is //italic// text'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const italicNode = result.children.find((c: PassageFlowNode) => c.type === 'builtinChanger')
      expect(italicNode).toBeDefined()
      expect((italicNode as any).changer).toBe('italic')
    })
  })

  describe('Variables', () => {
    it('should parse simple variable', () => {
      const source = '$myVariable'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.children).toHaveLength(1)
      expect(result.children[0].type).toBe('variable')
      
      const varNode = result.children[0] as VariableNode
      expect(varNode.name).toBe('myVariable') // Lexer strips the $ prefix
      expect(varNode.isTemp).toBe(false)
    })

    it('should parse temp variable', () => {
      const source = '_tempVar'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.children).toHaveLength(1)
      expect(result.children[0].type).toBe('variable')
      
      const varNode = result.children[0] as VariableNode
      expect(varNode.name).toBe('tempVar') // Lexer strips the _ prefix
      expect(varNode.isTemp).toBe(true)
    })

    it('should parse variables in text', () => {
      const source = 'Your name is $name'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const varNode = result.children.find((c: PassageFlowNode) => c.type === 'variable')
      expect(varNode).toBeDefined()
      expect((varNode as VariableNode).name).toBe('name') // Lexer strips the $ prefix
    })
  })

  describe('Macros', () => {
    it('should parse simple macro', () => {
      const source = '(print: "Hello")'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.children).toHaveLength(1)
      expect(result.children[0].type).toBe('macro')
      
      const macro = result.children[0] as MacroNode
      expect(macro.name).toBe('print')
      expect(macro.args.length).toBeGreaterThan(0)
    })

    it('should parse macro with multiple arguments', () => {
      const source = '(set: $x to 5)'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('set')
      expect(macro.args.length).toBeGreaterThan(0)
    })

    it('should parse macro with attached hook', () => {
      const source = '(if: $x > 5)[Display this text]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('if')
      expect(macro.attachedHook).toBeDefined()
      expect(macro.attachedHook?.type).toBe('codeHook')
    })

    it('should parse nested macros', () => {
      const source = '(print: (either: "a", "b", "c"))'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('print')
      
      // The argument should be another macro
      const argMacro = macro.args[0]
      expect(argMacro).toBeDefined()
      expect(argMacro.type).toBe('macro')
    })

    it('should parse chained macros', () => {
      const source = '(text-color: red)+(text-style: "bold")[Styled text]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.chainedMacros).toBeDefined()
      expect(macro.chainedMacros?.length).toBeGreaterThan(0)
    })
  })

  describe('Hooks', () => {
    it('should parse simple hook', () => {
      const source = '[Hook content]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.children).toHaveLength(1)
      expect(result.children[0].type).toBe('codeHook')
      
      const hook = result.children[0] as CodeHookNode
      expect(hook.children.length).toBeGreaterThan(0)
    })

    it('should parse named hook', () => {
      const source = '|hookName>[Named hook content]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const hook = result.children[0] as CodeHookNode
      expect(hook).toBeDefined()
      expect(hook.name).toBe('hookName')
    })

    it('should parse hidden hook', () => {
      const source = '|secret)[(Hidden content)]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const hook = result.children[0] as CodeHookNode
      expect(hook).toBeDefined()
      expect(hook.initiallyHidden).toBe(true)
    })
  })

  describe('Links', () => {
    it('should parse simple link', () => {
      const source = '[[Next Passage]]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const link = result.children[0]
      expect(link).toBeDefined()
      expect(link.type).toBe('link')
      expect((link as any).passage).toBe('Next Passage')
    })

    it('should parse link with arrow syntax', () => {
      const source = '[[Click here->Target]]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const link = result.children[0]
      expect(link).toBeDefined()
      expect(link.type).toBe('link')
      expect((link as any).text).toBe('Click here')
      expect((link as any).passage).toBe('Target')
    })

    it('should parse link with reverse arrow syntax', () => {
      const source = '[[Target<-Click here]]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const link = result.children[0]
      expect(link).toBeDefined()
      expect(link.type).toBe('link')
    })
  })

  describe('Complex Expressions', () => {
    it('should parse arithmetic expression in macro', () => {
      const source = '(set: $result to 5 + 3 * 2)'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('set')
      expect(macro.args.length).toBeGreaterThan(0)
      
      // Should have a binary expression with proper precedence
      const assignmentExpr = macro.args.find(arg => arg.type === 'binary')
      expect(assignmentExpr).toBeDefined()
    })

    it('should parse comparison expression', () => {
      const source = '(if: $x > 10 and $y < 20)[Text]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('if')
      
      // Should have a logical AND expression
      const logicalExpr = macro.args[0]
      expect(logicalExpr).toBeDefined()
      expect(logicalExpr.type).toBe('binary')
      expect((logicalExpr as any).operator).toBe('and')
    })

    it('should parse property access', () => {
      const source = "(print: $item's name)"
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      
      // Should have a possessive operator
      const propAccess = macro.args[0]
      expect(propAccess).toBeDefined()
      expect(propAccess.type).toBe('binary')
      expect((propAccess as any).operator).toBe('possessiveOperator')
    })

    it('should parse array access with contains', () => {
      const source = '(if: $list contains 5)[Found]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      
      const containsExpr = macro.args[0]
      expect(containsExpr).toBeDefined()
      expect(containsExpr.type).toBe('binary')
      expect((containsExpr as any).operator).toBe('contains')
    })

    it('should parse complex nested expression', () => {
      const source = '(set: $x to ($a + $b) * ($c - $d))'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('set')
      
      // Should parse the complex expression correctly
      expect(macro.args.length).toBeGreaterThan(0)
    })

    it('should parse string concatenation', () => {
      const source = '(set: $greeting to "Hello, " + $name)'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('set')
      
      // Should have a to operator and args
      expect(macro.args.length).toBeGreaterThan(0)
    })

    it('should parse lambda expression', () => {
      const source = '(set: $doubled to (a: _num, ..._nums) where _num > 5)'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      
      // Complex lambda with where clause
      expect(macro.args.length).toBeGreaterThan(0)
    })

    it('should parse multiple macros in sequence', () => {
      const source = '(set: $x to 5)(set: $y to 10)(print: $x + $y)'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.children.length).toBeGreaterThan(2)
      
      // All should be macros
      const macros = result.children.filter((c: PassageFlowNode) => c.type === 'macro')
      expect(macros.length).toBe(3)
    })
  })

  describe('Mixed Content', () => {
    it('should parse text with embedded macros and variables', () => {
      const source = 'Hello $name, you have (print: $points) points.'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      
      // Should have textFlow, variable, and macro
      const hasVariable = result.children.some((c: PassageFlowNode) => c.type === 'variable')
      const hasMacro = result.children.some((c: PassageFlowNode) => c.type === 'macro')
      expect(hasVariable).toBe(true)
      expect(hasMacro).toBe(true)
    })

    it('should parse conditional with formatted text', () => {
      const source = "(if: $bold)[This is ''bold'' text]"
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.attachedHook).toBeDefined()
      
      // Hook should contain bold text
      const hook = macro.attachedHook as CodeHookNode
      const hasBold = hook.children.some((c: PassageFlowNode) => c.type === 'builtinChanger')
      expect(hasBold).toBe(true)
    })

    it('should parse multiple hooks with macros', () => {
      const source = '(set: $x to 5)[First hook](if: $x > 3)[Second hook]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      
      // Should have two macros
      const macros = result.children.filter((c: PassageFlowNode) => c.type === 'macro')
      expect(macros.length).toBe(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const source = ''
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.type).toBe('codeHook')
      expect(result.children).toHaveLength(0)
    })

    it('should handle whitespace only', () => {
      const source = '   \n  \t  '
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.type).toBe('codeHook')
    })

    it('should handle unclosed hook gracefully', () => {
      const source = '[Unclosed hook'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      // Should parse without throwing - exact behavior depends on lexer
      expect(result.type).toBe('codeHook')
    })

    it('should handle special characters in strings', () => {
      const source = '(print: "Hello \\"world\\"")'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('print')
    })

    it('should handle numbers with decimals', () => {
      const source = '(set: $x to 3.14159)'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
    })

    it('should handle negative numbers', () => {
      const source = '(set: $x to -42)'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('set')
      
      // Should parse the macro successfully
      expect(macro.args.length).toBeGreaterThan(0)
    })
  })

  describe('Real-World Examples', () => {
    it('should parse a typical passage with multiple elements', () => {
      const source = `You are in a dark room.
      
(set: $health to 100)
Your health: $health

What do you do?
[[Look around->examine]]
[[Leave->exit]]`

      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.type).toBe('codeHook')
      
      // Should have macros, variables, and links
      const hasMacro = result.children.some((c: PassageFlowNode) => c.type === 'macro')
      const hasVariable = result.children.some((c: PassageFlowNode) => c.type === 'variable')
      const hasLink = result.children.some((c: PassageFlowNode) => c.type === 'link')
      
      expect(hasMacro).toBe(true)
      expect(hasVariable).toBe(true)
      expect(hasLink).toBe(true)
    })

    it('should parse inventory system logic', () => {
      const source = `(if: $inventory contains "key")[
  You have a key. [[Use it->unlock]]
](else:)[
  You need to find a key.
]`

      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      
      // Should parse the conditional structure
      const ifMacro = result.children.find((c: PassageFlowNode) => c.type === 'macro' && (c as MacroNode).name === 'if')
      expect(ifMacro).toBeDefined()
    })

    it('should parse complex arithmetic in game logic', () => {
      const source = '(set: $damage to ($strength * 2) + ($weapon * 1.5) - ($armor / 2))'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('set')
      
      // Should parse the complex expression with proper operator precedence
      expect(macro.args.length).toBeGreaterThan(0)
    })

    it('should parse character dialogue system', () => {
      const source = `(if: $relationship >= 50)[
  "I'm glad we're friends," says $npcName.
](else-if: $relationship >= 20)[
  "Hello there," $npcName says politely.
](else:)[
  $npcName ignores you.
]`

      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      
      // Should have conditional macros
      const macros = result.children.filter((c: PassageFlowNode) => c.type === 'macro')
      expect(macros.length).toBeGreaterThan(0)
    })

    it('should parse loop with collection', () => {
      const source = '(for: each _item, ...$inventory)[(print: _item)]'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('for')
      expect(macro.attachedHook).toBeDefined()
    })
  })

  describe('Stress Tests', () => {
    it('should handle deeply nested expressions', () => {
      const source = '(set: $x to ((1 + 2) + 3) + 4)'
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(() => Markup.parse(token)).not.toThrow()
      
      const macro = result.children[0] as MacroNode
      expect(macro).toBeDefined()
      expect(macro.name).toBe('set')
    })

    it('should handle very long text', () => {
      const source = 'a'.repeat(1000)
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      expect(result.type).toBe('codeHook')
    })

    it('should handle many sequential macros', () => {
      const source = Array(50).fill('(set: $x to 1)').join('')
      const token = Markup.lex(source, 'test')
      const result = Markup.parse(token)

      expect(result).toBeDefined()
      const macros = result.children.filter((c: PassageFlowNode) => c.type === 'macro')
      expect(macros.length).toBe(50)
    })
  })
})
