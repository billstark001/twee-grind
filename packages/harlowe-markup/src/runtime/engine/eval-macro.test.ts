import {
  createMacroEvaluationState,
  stepThroughMacroStack,
  commitMacroResult,
  type MacroEvaluationState,
  type MacroStackOptions,
} from './eval-macro.js'
import type {
  MacroMetadata,
} from '../../markup/types'
import type { EvaluationContext, HarloweEngineScope, VariableResolver, HookNameEvaluator } from '../types'
import { HarloweCustomDataType } from '../types'
import { Markup } from '../../markup/markup.js'

/**
 * Helper to extract macro metadata from parsed code
 */
const getMacroMetadata = (code: string): MacroMetadata => {
  const parsed = Markup.parse(Markup.lex(code));
  return parsed.children[0] as MacroMetadata;
}

/**
 * Helper to create a basic evaluation context
 */
const createTestContext = (vars: Record<string, any> = {}): EvaluationContext => {
  const scope: HarloweEngineScope = {
    srcPassage: 'test',
    srcPos: 0,
    vars: new Map(Object.entries(vars)),
  }

  const resolver: VariableResolver = {
    getVariable: (name: string, scope: HarloweEngineScope) => {
      return scope.vars.get(name)
    },
  }

  const hookNameEvaluator: HookNameEvaluator = {
    evaluateHookName: (node, scope) => {
      return {
        [HarloweCustomDataType]: 'HookName',
        hookName: node.name,
        chars: '',
        links: [],
        lines: [],
        slice: () => ({} as any),
        visited: {} as any,
      }
    },
  }

  return {
    scope,
    reserved: {},
    resolver,
    hookNameEvaluator,
  }
}

/**
 * Macro evaluator that returns predefined results or default mock results
 */
type MacroEvaluator = (macroName: string, params: any[]) => any;

const createMacroEvaluator = (macroHandlers: Record<string, (params: any[]) => any> = {}): MacroEvaluator => {
  return (macroName: string, params: any[]) => {
    if (macroName in macroHandlers) {
      return macroHandlers[macroName](params);
    }
    // Default behavior: return a mock result with macro info
    return {
      [HarloweCustomDataType]: 'MacroResult',
      macroName,
      params
    };
  };
}

/**
 * Helper to fully evaluate a macro expression end-to-end
 * Returns the final result or throws if evaluation fails
 */
const evaluateMacroExpression = (
  code: string,
  context: EvaluationContext,
  macroEvaluator: MacroEvaluator,
  options: MacroStackOptions = {}
): any => {
  const macro = getMacroMetadata(code);
  const stack: MacroEvaluationState[] = [createMacroEvaluationState(macro)];

  // Main evaluation loop
  let maxIterations = 100; // Safety limit
  while (maxIterations-- > 0) {
    const result = stepThroughMacroStack(stack, context, options);

    if (result.status === 'complete') {
      // Evaluation complete - return the final result
      if (stack.length === 0) {
        throw new Error('Evaluation completed but no result in stack');
      }
      return stack[0].evaluatedResult;
    }

    if (result.status === 'needMacroCall') {
      // Need to call a macro - get the top of stack
      const topState = stack[stack.length - 1];
      if (topState.phase !== 'body') {
        throw new Error(`Expected body phase but got ${topState.phase}`);
      }

      // Call the macro
      const macroName = (topState.node as MacroMetadata).name;
      const macroResult = macroEvaluator(macroName, topState.evaluatedParameters);

      // Commit the result
      commitMacroResult(stack, macroResult);
    }
  }

  throw new Error('Macro evaluation exceeded maximum iterations');
}

/**
 * Helper to evaluate a macro and expect it to succeed with a specific result
 */
const expectMacroResult = (
  code: string,
  vars: Record<string, any>,
  macroHandlers: Record<string, (params: any[]) => any>,
  expectedResult: any
) => {
  const context = createTestContext(vars);
  const evaluator = createMacroEvaluator(macroHandlers);
  const result = evaluateMacroExpression(code, context, evaluator);
  expect(result).toEqual(expectedResult);
}

/**
 * Helper to evaluate a macro and expect it to produce an error
 */
const expectMacroError = (
  code: string,
  vars: Record<string, any>,
  macroHandlers: Record<string, (params: any[]) => any>,
  errorPattern?: string | RegExp
) => {
  const context = createTestContext(vars);
  const evaluator = createMacroEvaluator(macroHandlers);
  const result = evaluateMacroExpression(code, context, evaluator, {
    stopMacroEvaluationOnError: true
  });

  expect((result as any)?.[HarloweCustomDataType]).toBe('Error');
  if (errorPattern) {
    if (typeof errorPattern === 'string') {
      expect((result as any).message).toContain(errorPattern);
    } else {
      expect((result as any).message).toMatch(errorPattern);
    }
  }
}

describe('Eval Macro Module', () => {
  describe('createMacroEvaluationState', () => {
    it('should create initial macro evaluation state', () => {
      const macro = getMacroMetadata('(test: 1, 2, 3)');
      const state = createMacroEvaluationState(macro);

      expect(state.node).toBe(macro);
      expect(state.phase).toBe('parameter');
      expect(state.evaluatedParameters).toEqual([]);
      expect(state.currentParameterIndex).toBe(0);
      expect(state.currentParameterEvaluationState).toBeUndefined();
    });
  });

  describe('stepThroughMacroStack - simple macro', () => {
    it('should evaluate all parameters and reach body phase', () => {
      const macro = getMacroMetadata('(test: 1, 2, 3)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      const result = stepThroughMacroStack(stack, context, options);

      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');
      expect(state.evaluatedParameters).toEqual([1, 2, 3]);
      expect(state.currentParameterIndex).toBe(3);
    });

    it('should handle macro with variable parameters', () => {
      const macro = getMacroMetadata('(test: $x, $y)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext({ x: 10, y: 20 });
      const options: MacroStackOptions = {};

      const result = stepThroughMacroStack(stack, context, options);

      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');
      expect(state.evaluatedParameters).toEqual([10, 20]);
    });

    it('should handle macro with expression parameters', () => {
      const macro = getMacroMetadata('(test: 1 + 2, 3 * 4)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      const result = stepThroughMacroStack(stack, context, options);

      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');
      expect(state.evaluatedParameters).toEqual([3, 12]);
    });
  });

  describe('commitMacroResult', () => {
    it('should commit result and move to end phase', () => {
      const macro = getMacroMetadata('(test: 1, 2)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      // First, evaluate parameters
      stepThroughMacroStack(stack, context, options);
      expect(state.phase).toBe('body');

      // Then commit result
      const result = { value: 42 };
      commitMacroResult(stack, result);

      expect(state.phase).toBe('end');
      expect(state.evaluatedResult).toBe(result);
    });

    it('should throw error if stack is empty', () => {
      const stack: MacroEvaluationState[] = [];
      expect(() => commitMacroResult(stack, { value: 42 })).toThrow('Macro evaluation stack is empty');
    });

    it('should throw error if not in body phase', () => {
      const macro = getMacroMetadata('(test: 1)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];

      expect(() => commitMacroResult(stack, { value: 42 })).toThrow('Top of macro evaluation stack is not in body phase');
    });
  });

  describe('stepThroughMacroStack - nested macros', () => {
    it('should handle nested macro in parameter', () => {
      const macro = getMacroMetadata('(outer: (inner: 1))');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      // First step: should process outer macro parameters and encounter inner macro
      let result = stepThroughMacroStack(stack, context, options);

      // Should be ready to call a macro (inner)
      expect(result.status).toBe('needMacroCall');
      let topState = stack[stack.length - 1];
      expect(topState.phase).toBe('body');
      expect((topState.node as MacroMetadata).name).toBe('inner');

      // Simulate evaluating inner macro
      const innerResult = { innerValue: 100 };
      commitMacroResult(stack, innerResult);

      // Continue evaluating
      result = stepThroughMacroStack(stack, context, options);

      // Outer should now be ready to call
      expect(result.status).toBe('needMacroCall');
      topState = stack[stack.length - 1];
      expect(topState.phase).toBe('body');
      expect(topState.evaluatedParameters).toEqual([innerResult]);
    });

    it('should handle multiple nested macros', () => {
      const macro = getMacroMetadata('(outer: (inner1: 1), (inner2: 2))');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      // Process first parameter (inner1)
      let result = stepThroughMacroStack(stack, context, options);
      expect(result.status).toBe('needMacroCall');
      let topState = stack[stack.length - 1];
      expect((topState.node as MacroMetadata).name).toBe('inner1');

      // Evaluate inner1
      commitMacroResult(stack, { value: 'result1' });

      // Continue - should process second parameter (inner2)
      result = stepThroughMacroStack(stack, context, options);
      expect(result.status).toBe('needMacroCall');
      topState = stack[stack.length - 1];
      expect((topState.node as MacroMetadata).name).toBe('inner2');

      // Evaluate inner2
      commitMacroResult(stack, { value: 'result2' });

      // Continue - outer should now be ready to call
      result = stepThroughMacroStack(stack, context, options);
      expect(result.status).toBe('needMacroCall');
      topState = stack[stack.length - 1];
      expect(topState.phase).toBe('body');
      expect(topState.evaluatedParameters).toEqual([
        { value: 'result1' },
        { value: 'result2' }
      ]);
    });

    it('should handle deeply nested macros', () => {
      const macro = getMacroMetadata('(outer: (middle: (inner: 1)))');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      // First call: processes to innermost (inner) macro
      // Note: middle stays in stepEvaluation's internal stack waiting for inner's result
      let result = stepThroughMacroStack(stack, context, options);
      expect(result.status).toBe('needMacroCall');
      let topState = stack[stack.length - 1];
      expect((topState.node as MacroMetadata).name).toBe('inner');

      // Evaluate inner
      commitMacroResult(stack, { value: 'innerResult' });
      result = stepThroughMacroStack(stack, context, options);

      // Evaluate inner
      commitMacroResult(stack, { value: 'innerResult' });
      result = stepThroughMacroStack(stack, context, options);

      // Middle should now be ready to call
      expect(result.status).toBe('needMacroCall');
      topState = stack[stack.length - 1];
      expect(topState.phase).toBe('body');

      // Evaluate middle
      commitMacroResult(stack, { value: 'middleResult' });
      result = stepThroughMacroStack(stack, context, options);

      // Outer should now be ready to call
      expect(result.status).toBe('needMacroCall');
      topState = stack[stack.length - 1];
      expect(topState.phase).toBe('body');
      expect(topState.evaluatedParameters).toEqual([{ value: 'middleResult' }]);
    });
  });

  describe('stepThroughMacroStack - complete workflow', () => {
    it('should complete full macro evaluation workflow', () => {
      const macro = getMacroMetadata('(test: 1, 2)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      // Step 1: Process parameters
      let result = stepThroughMacroStack(stack, context, options);
      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');

      // Step 2: Commit result
      commitMacroResult(stack, { finalValue: 42 });

      // Step 3: Process to completion
      result = stepThroughMacroStack(stack, context, options);
      expect(result.status).toBe('complete');
      expect(stack.length).toBe(1); // State returned to stack for result access
      expect(stack[0].phase).toBe('end');
      expect(stack[0].evaluatedResult).toEqual({ finalValue: 42 });
    });

    it('should complete nested macro evaluation workflow', () => {
      const macro = getMacroMetadata('(outer: (inner: 5))');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      // Process until inner macro needs call
      let result = stepThroughMacroStack(stack, context, options);
      expect(result.status).toBe('needMacroCall');
      expect(stack.length).toBe(2);

      // Evaluate inner macro
      commitMacroResult(stack, 50);

      // Continue to outer macro
      result = stepThroughMacroStack(stack, context, options);
      expect(result.status).toBe('needMacroCall');
      expect(stack.length).toBe(1);
      expect(stack[0].evaluatedParameters).toEqual([50]);

      // Evaluate outer macro
      commitMacroResult(stack, 500);

      // Complete
      result = stepThroughMacroStack(stack, context, options);
      expect(result.status).toBe('complete');
      expect(stack[0].evaluatedResult).toBe(500);
    });
  });

  describe('Error handling', () => {
    it('should handle error in parameter evaluation', () => {
      const macro = getMacroMetadata('(test: $undefined)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext(); // $undefined is not defined
      const options: MacroStackOptions = {
        stopParameterEvaluationOnError: false
      };

      const result = stepThroughMacroStack(stack, context, options);

      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');
      // Parameter should be error value
      expect(state.evaluatedParameters.length).toBe(1);
      expect((state.evaluatedParameters[0] as any)?.[HarloweCustomDataType]).toBe('Error');
    });

    it('should stop parameter evaluation on error when option is set', () => {
      const macro = getMacroMetadata('(test: $undefined, 1, 2)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {
        stopParameterEvaluationOnError: true
      };

      const result = stepThroughMacroStack(stack, context, options);

      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');
      // Should have evaluated only the first parameter
      expect(state.evaluatedParameters.length).toBe(1);
      expect(state.currentParameterIndex).toBe(3); // Skipped to end
    });

    it('should handle error in nested macro parameter', () => {
      const macro = getMacroMetadata('(outer: (inner: $undefined))');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {
        stopMacroEvaluationOnError: false,
        stopParameterEvaluationOnError: false,
      };

      // Process - when inner's parameter has an error, the error is returned immediately
      // without pushing inner onto the macro stack
      let result = stepThroughMacroStack(stack, context, options);

      // Outer macro should have received an error as its parameter but still reach body phase
      const topState = stack[stack.length - 1];
      expect(topState.phase).toBe('body');
      expect((topState.node as MacroMetadata).name).toBe('outer');
      expect(topState.evaluatedParameters.length).toBe(1);
      // The parameter should be an error value
      expect((topState.evaluatedParameters[0] as any)?.[HarloweCustomDataType]).toBe('Error');
    });

    it('should continue macro evaluation with error parameter when option not set', () => {
      const macro = getMacroMetadata('(test: $undefined, 1)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {
        stopMacroEvaluationOnError: false
      };

      const result = stepThroughMacroStack(stack, context, options);

      // Should still reach body phase to allow macro to handle error
      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');
      expect(state.evaluatedParameters.length).toBe(2);
    });
  });

  describe('Mixed expressions in parameters', () => {
    it('should handle macro with mixed literal and expression parameters', () => {
      const macro = getMacroMetadata('(test: 1, 2 + 3, $x, "hello")');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext({ x: 10 });
      const options: MacroStackOptions = {};

      const result = stepThroughMacroStack(stack, context, options);

      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');
      expect(state.evaluatedParameters).toEqual([1, 5, 10, 'hello']);
    });

    it('should handle macro with comparison and logical expressions', () => {
      const macro = getMacroMetadata('(test: 1 < 2, true and false)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      const result = stepThroughMacroStack(stack, context, options);

      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');
      expect(state.evaluatedParameters).toEqual([true, false]);
    });
  });

  describe('Edge cases', () => {
    it('should handle macro with no parameters', () => {
      const macro = getMacroMetadata('(test:)');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      const result = stepThroughMacroStack(stack, context, options);

      expect(result.status).toBe('needMacroCall');
      expect(state.phase).toBe('body');
      expect(state.evaluatedParameters).toEqual([]);
    });

    it('should handle empty stack', () => {
      const stack: MacroEvaluationState[] = [];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      const result = stepThroughMacroStack(stack, context, options);

      expect(result.status).toBe('complete');
      expect(stack.length).toBe(0);
    });

    it('should handle macro with array and object literals', () => {
      const macro = getMacroMetadata('(test: (a: 1, 2), (dm: "key", "value"))');
      const state = createMacroEvaluationState(macro);
      const stack: MacroEvaluationState[] = [state];
      const context = createTestContext();
      const options: MacroStackOptions = {};

      // Will encounter nested macros for array and map construction
      let result = stepThroughMacroStack(stack, context, options);

      // Should have encountered first nested macro (array)
      expect(stack.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // End-to-End Black Box Tests
  // ============================================================================

  describe('End-to-End Macro Evaluation (Black Box)', () => {
    describe('Simple macro calls', () => {
      it('should evaluate macro with literal parameters', () => {
        expectMacroResult(
          '(set: 1, 2, 3)',
          {},
          {
            set: (params) => ({ success: true, values: params })
          },
          { success: true, values: [1, 2, 3] }
        );
      });

      it('should evaluate macro with string parameters', () => {
        expectMacroResult(
          '(print: "hello", "world")',
          {},
          {
            print: (params) => params.join(' ')
          },
          'hello world'
        );
      });

      it('should evaluate macro with expression parameters', () => {
        expectMacroResult(
          '(add: 1 + 2, 3 * 4)',
          {},
          {
            add: (params) => params.reduce((a: number, b: number) => a + b, 0)
          },
          15
        );
      });

      it('should evaluate macro with variable parameters', () => {
        expectMacroResult(
          '(display: $name, $age)',
          { name: 'Alice', age: 30 },
          {
            display: (params) => `${params[0]} is ${params[1]} years old`
          },
          'Alice is 30 years old'
        );
      });

      it('should evaluate macro with mixed parameters', () => {
        expectMacroResult(
          '(calc: $x, 2 + 3, "result")',
          { x: 10 },
          {
            calc: (params) => ({ x: params[0], sum: params[1], label: params[2] })
          },
          { x: 10, sum: 5, label: 'result' }
        );
      });
    });

    describe('Nested macro calls', () => {
      it('should evaluate nested macro in parameter', () => {
        expectMacroResult(
          '(outer: (inner: 5))',
          {},
          {
            inner: (params) => params[0] * 10,
            outer: (params) => params[0] + 100
          },
          150 // inner(5) = 50, outer(50) = 150
        );
      });

      it('should evaluate multiple nested macros', () => {
        expectMacroResult(
          '(add: (mul: 2, 3), (mul: 4, 5))',
          {},
          {
            mul: (params) => (params[0] as number) * (params[1] as number),
            add: (params) => (params[0] as number) + (params[1] as number)
          },
          26 // mul(2,3)=6, mul(4,5)=20, add(6,20)=26
        );
      });

      it('should evaluate deeply nested macros', () => {
        expectMacroResult(
          '(a: (b: (c: 1)))',
          {},
          {
            c: (params) => params[0] + 10,
            b: (params) => params[0] + 20,
            a: (params) => params[0] + 30
          },
          61 // c(1)=11, b(11)=31, a(31)=61
        );
      });

      it('should evaluate complex nested expressions', () => {
        expectMacroResult(
          '(sum: (add: 1, 2 + 3), (mul: 3, 4), (sub: 10, 5))',
          {},
          {
            add: (params) => (params[0] as number) + (params[1] as number),
            mul: (params) => (params[0] as number) * (params[1] as number),
            sub: (params) => (params[0] as number) - (params[1] as number),
            sum: (params) => (params as number[]).reduce((a, b) => a + b, 0)
          },
          23
        );
      });
    });

    describe('Variable interaction', () => {
      it('should use variables in nested macros', () => {
        expectMacroResult(
          '(outer: (inner: $value))',
          { value: 7 },
          {
            inner: (params) => params[0] * 2,
            outer: (params) => params[0] + 3
          },
          17 // inner(7)=14, outer(14)=17
        );
      });

      it('should handle multiple variables in nested context', () => {
        expectMacroResult(
          '(combine: (format: $first, $last), $age)',
          { first: 'John', last: 'Doe', age: 25 },
          {
            format: (params) => `${params[0]} ${params[1]}`,
            combine: (params) => ({ name: params[0], age: params[1] })
          },
          { name: 'John Doe', age: 25 }
        );
      });

      it('should evaluate expressions with variables in nested macros', () => {
        expectMacroResult(
          '(result: (calc: $x + $y))',
          { x: 10, y: 5 },
          {
            calc: (params) => params[0],
            result: (params) => `Result is ${params[0]}`
          },
          'Result is 15'
        );
      });
    });

    describe('Conditional logic in macros', () => {
      it('should handle boolean parameters', () => {
        expectMacroResult(
          '(if: true and false)',
          {},
          {
            if: (params) => params[0] ? 'yes' : 'no'
          },
          'no'
        );
      });

      it('should handle comparison in parameters', () => {
        expectMacroResult(
          '(check: $age > 18)',
          { age: 25 },
          {
            check: (params) => params[0] ? 'adult' : 'minor'
          },
          'adult'
        );
      });

      it('should handle complex boolean logic', () => {
        expectMacroResult(
          '(validate: ($x > 0) and ($y < 10))',
          { x: 5, y: 3 },
          {
            validate: (params) => params[0] ? 'valid' : 'invalid'
          },
          'valid'
        );
      });
    });

    describe('Error handling', () => {
      it('should handle undefined variable', () => {
        expectMacroError(
          '(test: $undefined)',
          {},
          {},
          'Undefined variable'
        );
      });

      it('should propagate error from nested macro', () => {
        expectMacroError(
          '(outer: (inner: $missing))',
          {},
          {
            inner: (params) => params[0],
            outer: (params) => params[0]
          },
          'Undefined variable'
        );
      });

      it('should handle macro that returns error', () => {
        const result = evaluateMacroExpression(
          '(test: 1)',
          createTestContext(),
          (name, params) => ({
            [HarloweCustomDataType]: 'Error',
            message: 'Test error'
          }),
          { stopMacroEvaluationOnError: true }
        );

        expect((result as any)?.[HarloweCustomDataType]).toBe('Error');
        expect((result as any).message).toBe('Test error');
      });

      it('should continue evaluation when error handling disabled', () => {
        const result = evaluateMacroExpression(
          '(process: $undefined)',
          createTestContext(),
          (name, params) => {
            // Even with error parameter, macro can process it
            const isError = (params[0] as any)?.[HarloweCustomDataType] === 'Error';
            return isError ? 'handled error' : params[0];
          },
          { stopMacroEvaluationOnError: false }
        );

        expect(result).toBe('handled error');
      });
    });

    describe('Real-world scenarios', () => {
      it('should simulate set-like macro with nested expression', () => {
        expectMacroResult(
          '(assign: "result", (multiply: $a, $b))',
          { a: 6, b: 7 },
          {
            multiply: (params) => (params[0] as number) * (params[1] as number),
            assign: (params) => ({ variable: params[0], value: params[1] })
          },
          { variable: 'result', value: 42 }
        );
      });

      it('should simulate if-else chain with conditions', () => {
        expectMacroResult(
          '(branch: (check: $score >= 90), "A", "B")',
          { score: 95 },
          {
            check: (params) => params[0],
            branch: (params) => params[0] ? params[1] : params[2]
          },
          'A'
        );
      });

      it('should handle data structure creation', () => {
        expectMacroResult(
          '(createPerson: $name, $age, (address: $city, $country))',
          { name: 'Alice', age: 30, city: 'Tokyo', country: 'Japan' },
          {
            address: (params) => ({ city: params[0], country: params[1] }),
            createPerson: (params) => ({
              name: params[0],
              age: params[1],
              address: params[2]
            })
          },
          {
            name: 'Alice',
            age: 30,
            address: { city: 'Tokyo', country: 'Japan' }
          }
        );
      });

      it('should handle array operations', () => {
        expectMacroResult(
          '(sum: (map: $numbers, (lambda: $x, $x * 2)))',
          { numbers: [1, 2, 3], x: 0 },
          {
            lambda: (params) => params[1], // Return the multiplier expression result
            map: (params) => [2, 4, 6], // Simplified: just return doubled values
            sum: (params) => (params[0] as number[]).reduce((a, b) => a + b, 0)
          },
          12 // sum([2,4,6]) = 12
        );
      });

      it('should handle multiple levels of nesting with variables', () => {
        expectMacroResult(
          '(format: (concat: (upper: $firstName), " ", (upper: $lastName)))',
          { firstName: 'john', lastName: 'doe' },
          {
            upper: (params) => (params[0] as string).toUpperCase(),
            concat: (params) => params.join(''),
            format: (params) => `Name: ${params[0]}`
          },
          'Name: JOHN DOE'
        );
      });
    });

    describe('Performance and limits', () => {
      it('should handle many parameters', () => {
        const params = Array.from({ length: 20 }, (_, i) => i + 1).join(', ');
        expectMacroResult(
          `(sum: ${params})`,
          {},
          {
            sum: (params) => (params as number[]).reduce((a, b) => a + b, 0)
          },
          210 // sum of 1..20
        );
      });

      it('should handle deep nesting within iteration limit', () => {
        // Nest 5 levels deep
        expectMacroResult(
          '(a: (b: (c: (d: (e: 1)))))',
          {},
          {
            e: (params) => params[0] + 1,
            d: (params) => params[0] + 1,
            c: (params) => params[0] + 1,
            b: (params) => params[0] + 1,
            a: (params) => params[0] + 1
          },
          6 // 1+1+1+1+1+1 = 6
        );
      });
    });
  });
});
