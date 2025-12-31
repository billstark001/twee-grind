import {
  macroRegistry,
  invokeMacro,
  isMacroAsyncResult,
  createPromptAsyncResult,
  createWaitAsyncResult,
  type MacroDefinition,
  type MacroAsyncResult,
} from './macro-registry.js'
import type { HarloweEngineScope, HarloweEngineVariable } from '../types'
import { HarloweCustomDataType } from '../types'

describe('Macro Registry Module', () => {
  // Create a test scope
  const createTestScope = (): HarloweEngineScope => ({
    srcPassage: 'test',
    srcPos: 0,
    vars: new Map(),
  })

  // Clear registry before each test
  beforeEach(() => {
    macroRegistry.clear()
  })

  describe('Macro Registration', () => {
    it('should register a simple macro', () => {
      const macro: MacroDefinition = {
        name: 'test',
        fn: (args, scope) => 'test result',
      }

      macroRegistry.register(macro)

      expect(macroRegistry.has('test')).toBe(true)
      expect(macroRegistry.get('test')).toBe(macro)
    })

    it('should register macro with description', () => {
      const macro: MacroDefinition = {
        name: 'print',
        fn: (args, scope) => args[0],
        description: 'Prints the first argument',
      }

      macroRegistry.register(macro)

      const retrieved = macroRegistry.get('print')
      expect(retrieved?.description).toBe('Prints the first argument')
    })

    it('should register macro with argument constraints', () => {
      const macro: MacroDefinition = {
        name: 'add',
        fn: (args, scope) => (args[0] as number) + (args[1] as number),
        minArgs: 2,
        maxArgs: 2,
      }

      macroRegistry.register(macro)

      const retrieved = macroRegistry.get('add')
      expect(retrieved?.minArgs).toBe(2)
      expect(retrieved?.maxArgs).toBe(2)
    })

    it('should throw error when registering duplicate macro', () => {
      const macro1: MacroDefinition = {
        name: 'test',
        fn: () => 'first',
      }
      const macro2: MacroDefinition = {
        name: 'test',
        fn: () => 'second',
      }

      macroRegistry.register(macro1)
      expect(() => macroRegistry.register(macro2)).toThrow(
        "Macro 'test' is already registered"
      )
    })

    it('should be case-insensitive', () => {
      const macro: MacroDefinition = {
        name: 'Test',
        fn: () => 'result',
      }

      macroRegistry.register(macro)

      expect(macroRegistry.has('test')).toBe(true)
      expect(macroRegistry.has('TEST')).toBe(true)
      expect(macroRegistry.has('Test')).toBe(true)
    })
  })

  describe('Macro Unregistration', () => {
    it('should unregister a macro', () => {
      const macro: MacroDefinition = {
        name: 'test',
        fn: () => 'result',
      }

      macroRegistry.register(macro)
      expect(macroRegistry.has('test')).toBe(true)

      const result = macroRegistry.unregister('test')
      expect(result).toBe(true)
      expect(macroRegistry.has('test')).toBe(false)
    })

    it('should return false when unregistering non-existent macro', () => {
      const result = macroRegistry.unregister('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('Macro Listing', () => {
    it('should list all registered macros', () => {
      macroRegistry.register({ name: 'macro1', fn: () => {} })
      macroRegistry.register({ name: 'macro2', fn: () => {} })
      macroRegistry.register({ name: 'macro3', fn: () => {} })

      const list = macroRegistry.list()
      expect(list).toHaveLength(3)
      expect(list).toContain('macro1')
      expect(list).toContain('macro2')
      expect(list).toContain('macro3')
    })

    it('should return empty list when no macros registered', () => {
      const list = macroRegistry.list()
      expect(list).toHaveLength(0)
    })

    it('should return correct count', () => {
      expect(macroRegistry.count()).toBe(0)

      macroRegistry.register({ name: 'macro1', fn: () => {} })
      expect(macroRegistry.count()).toBe(1)

      macroRegistry.register({ name: 'macro2', fn: () => {} })
      expect(macroRegistry.count()).toBe(2)

      macroRegistry.unregister('macro1')
      expect(macroRegistry.count()).toBe(1)
    })
  })

  describe('Macro Invocation', () => {
    it('should invoke a macro with no arguments', () => {
      macroRegistry.register({
        name: 'test',
        fn: (args, scope) => 'success',
      })

      const scope = createTestScope()
      const result = invokeMacro('test', [], scope)

      expect(result).toBe('success')
    })

    it('should invoke a macro with arguments', () => {
      macroRegistry.register({
        name: 'add',
        fn: (args, scope) => (args[0] as number) + (args[1] as number),
      })

      const scope = createTestScope()
      const result = invokeMacro('add', [5, 3], scope)

      expect(result).toBe(8)
    })

    it('should invoke a macro with scope access', () => {
      macroRegistry.register({
        name: 'getVar',
        fn: (args, scope) => scope.vars.get(args[0] as string),
      })

      const scope = createTestScope()
      scope.vars.set('myVar', 42)

      const result = invokeMacro('getVar', ['myVar'], scope)

      expect(result).toBe(42)
    })

    it('should throw error when invoking non-existent macro', () => {
      const scope = createTestScope()
      expect(() => invokeMacro('nonexistent', [], scope)).toThrow(
        "Macro 'nonexistent' is not registered"
      )
    })

    it('should validate minimum argument count', () => {
      macroRegistry.register({
        name: 'test',
        fn: (args, scope) => 'result',
        minArgs: 2,
      })

      const scope = createTestScope()
      expect(() => invokeMacro('test', [1], scope)).toThrow(
        "Macro 'test' requires at least 2 arguments, got 1"
      )
    })

    it('should validate maximum argument count', () => {
      macroRegistry.register({
        name: 'test',
        fn: (args, scope) => 'result',
        maxArgs: 2,
      })

      const scope = createTestScope()
      expect(() => invokeMacro('test', [1, 2, 3], scope)).toThrow(
        "Macro 'test' accepts at most 2 arguments, got 3"
      )
    })

    it('should allow argument count within range', () => {
      macroRegistry.register({
        name: 'test',
        fn: (args, scope) => args.length,
        minArgs: 1,
        maxArgs: 3,
      })

      const scope = createTestScope()
      expect(invokeMacro('test', [1], scope)).toBe(1)
      expect(invokeMacro('test', [1, 2], scope)).toBe(2)
      expect(invokeMacro('test', [1, 2, 3], scope)).toBe(3)
    })

    it('should support macros returning void', () => {
      let sideEffect = 0
      macroRegistry.register({
        name: 'increment',
        fn: (args, scope) => {
          sideEffect++
        },
      })

      const scope = createTestScope()
      const result = invokeMacro('increment', [], scope)

      expect(result).toBeUndefined()
      expect(sideEffect).toBe(1)
    })
  })

  describe('MacroAsyncResult', () => {
    it('should create a prompt async result', () => {
      const result = createPromptAsyncResult('prompt-1', 'Enter your name:')

      expect(isMacroAsyncResult(result)).toBe(true)
      expect(result.asyncType).toBe('prompt')
      expect(result.asyncId).toBe('prompt-1')
      expect(result.state.promptMessage).toBe('Enter your name:')
    })

    it('should create a wait async result', () => {
      const result = createWaitAsyncResult('wait-1', 5000)

      expect(isMacroAsyncResult(result)).toBe(true)
      expect(result.asyncType).toBe('wait')
      expect(result.asyncId).toBe('wait-1')
      expect(result.state.duration).toBe(5000)
    })

    it('should support async result with continuation', () => {
      const continuation = (input: HarloweEngineVariable) => `Result: ${input}`
      const result = createPromptAsyncResult('prompt-1', 'Enter value:', continuation)

      expect(result.continuation).toBe(continuation)
      if (result.continuation) {
        expect(result.continuation('test')).toBe('Result: test')
      }
    })

    it('should invoke macro returning async result', () => {
      macroRegistry.register({
        name: 'prompt',
        fn: (args, scope) => {
          const message = args[0] as string
          return createPromptAsyncResult('prompt-1', message)
        },
      })

      const scope = createTestScope()
      const result = invokeMacro('prompt', ['Enter your name:'], scope)

      expect(isMacroAsyncResult(result)).toBe(true)
      if (isMacroAsyncResult(result)) {
        expect(result.asyncType).toBe('prompt')
        expect(result.state.promptMessage).toBe('Enter your name:')
      }
    })

    it('should not identify regular values as MacroAsyncResult', () => {
      expect(isMacroAsyncResult('string')).toBe(false)
      expect(isMacroAsyncResult(42)).toBe(false)
      expect(isMacroAsyncResult({})).toBe(false)
      expect(isMacroAsyncResult({ [HarloweCustomDataType]: 'Other' })).toBe(false)
    })
  })

  describe('Real-world Macro Examples', () => {
    it('should implement a set macro', () => {
      macroRegistry.register({
        name: 'set',
        fn: (args, scope) => {
          // args[0] should be a VariableToValue
          const varName = 'x' // simplified
          const value = args[0]
          scope.vars.set(varName, value)
        },
        minArgs: 1,
      })

      const scope = createTestScope()
      invokeMacro('set', [42], scope)

      expect(scope.vars.get('x')).toBe(42)
    })

    it('should implement a print macro', () => {
      macroRegistry.register({
        name: 'print',
        fn: (args, scope) => {
          return args.join(' ')
        },
      })

      const scope = createTestScope()
      const result = invokeMacro('print', ['Hello', 'World'], scope)

      expect(result).toBe('Hello World')
    })

    it('should implement an if macro', () => {
      macroRegistry.register({
        name: 'if',
        fn: (args, scope) => {
          const condition = args[0] as boolean
          return condition ? 'condition true' : 'condition false'
        },
        minArgs: 1,
        maxArgs: 1,
      })

      const scope = createTestScope()
      expect(invokeMacro('if', [true], scope)).toBe('condition true')
      expect(invokeMacro('if', [false], scope)).toBe('condition false')
    })

    it('should implement a prompt macro with async result', () => {
      macroRegistry.register({
        name: 'prompt',
        fn: (args, scope) => {
          const message = args[0] as string
          const varName = args[1] as string
          return createPromptAsyncResult(`prompt-${varName}`, message, (input) => {
            scope.vars.set(varName, input)
          })
        },
        minArgs: 2,
        maxArgs: 2,
      })

      const scope = createTestScope()
      const result = invokeMacro('prompt', ['Enter name:', 'userName'], scope)

      expect(isMacroAsyncResult(result)).toBe(true)
      if (isMacroAsyncResult(result)) {
        // Simulate user input
        if (result.continuation) {
          result.continuation('Alice')
        }
        expect(scope.vars.get('userName')).toBe('Alice')
      }
    })
  })
})
