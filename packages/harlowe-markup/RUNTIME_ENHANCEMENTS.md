# Harlowe Runtime Enhancements

This document describes the newly implemented features for the Harlowe runtime engine.

## Overview

The following enhancements have been added to the `harlowe-markup` package runtime:

1. **Lambda (Anonymous Function) Evaluation**
2. **Advanced Pattern Matching with `matches` Operator**
3. **Macro Registration and Invocation Infrastructure**
4. **Scope Management Infrastructure**

## 1. Lambda Evaluation

Module: `src/runtime/engine/eval-lambda.ts`

### Features

- Create and invoke anonymous functions (lambdas)
- Support for closures (lambdas capture their creation scope)
- Multiple parameters
- Evaluated in isolated scope with access to parent scopes

### API

```typescript
import { createLambda, invokeLambda } from '@twee-grind/harlowe-markup/runtime'

// Create a lambda
const lambda = createLambda(['x', 'y'], bodyExpressionNode, scope)

// Invoke a lambda
const result = invokeLambda(lambda, [arg1, arg2], context)
```

### Example

```typescript
// Lambda: (x, y) => x + y
const addLambda = createLambda(['x', 'y'], addExpressionNode, scope)
const sum = invokeLambda(addLambda, [5, 3], context) // Returns 8
```

## 2. Advanced Pattern Matching

Module: `src/runtime/engine/eval-matches.ts`

### Features

The `matches` operator has been significantly enhanced to support:

- **Array pattern matching**: `(a:2,3) matches (a: num, num)`
- **Nested array patterns**: `(a: array) matches (a:(a: ))`
- **Datamap (Map) patterns**: `(dm:"Love",2,"Fear",4) matches (dm: "Love", num, "Fear", num)`
- **Dataset (Set) patterns**: `(ds:2,3) matches (ds: 3, num)`
- **Nested dataset patterns**: `(ds: array) matches (ds:(a: ))`
- **Pattern variables**: `(p: ...)` or `(pattern: ...)` as datatypes
- **Regex as datatype**: Support for regular expressions in pattern matching

### API

```typescript
import { advancedMatches, createArrayPattern, createDatamapPattern, createRegexDatatype } from '@twee-grind/harlowe-markup/runtime'

// Array pattern matching
advancedMatches([2, 3], ['num', 'num']) // true

// Datamap pattern matching
const value = new Map([['Love', 2], ['Fear', 4]])
const pattern = new Map([['Love', 'num'], ['Fear', 'num']])
advancedMatches(value, pattern) // true

// Regex pattern
const regexPattern = createRegexDatatype(/hello\d+/)
advancedMatches('hello123', regexPattern) // true
```

### Pattern Types

#### Array Patterns
```typescript
// Exact match
advancedMatches([1, 2, 3], [1, 2, 3]) // true

// Type match
advancedMatches([1, 2, 3], ['num', 'num', 'num']) // true

// Nested patterns
advancedMatches([[1, 2]], [['num', 'num']]) // true
```

#### Datamap Patterns
```typescript
const dm = new Map([['key1', 42], ['key2', 'hello']])
const pattern = new Map([['key1', 'num'], ['key2', 'str']])
advancedMatches(dm, pattern) // true
```

#### Dataset Patterns
```typescript
const ds = new Set([2, 3, 4])
advancedMatches(ds, new Set([3, 'num'])) // true
```

#### Regex Patterns
```typescript
const regex = createRegexDatatype(/^\w+@\w+\.\w+$/)
advancedMatches('test@example.com', regex) // true
```

## 3. Macro Registry

Module: `src/runtime/engine/macro-registry.ts`

### Features

- Register custom macros with validation
- Case-insensitive macro names
- Argument count validation
- Support for synchronous and asynchronous macros
- Serializable/resumable macro results (for save/prompt functionality)

### API

```typescript
import { macroRegistry, invokeMacro, createPromptAsyncResult } from '@twee-grind/harlowe-markup/runtime'

// Register a macro
macroRegistry.register({
  name: 'add',
  fn: (args, scope) => (args[0] as number) + (args[1] as number),
  description: 'Adds two numbers',
  minArgs: 2,
  maxArgs: 2,
})

// Invoke a macro
const result = invokeMacro('add', [5, 3], scope) // Returns 8

// Asynchronous macro (e.g., prompt)
macroRegistry.register({
  name: 'prompt',
  fn: (args, scope) => {
    const message = args[0] as string
    return createPromptAsyncResult('prompt-1', message, (userInput) => {
      scope.vars.set('userResponse', userInput)
    })
  }
})
```

### Macro Types

#### Synchronous Macro
Returns a value immediately:
```typescript
fn: (args, scope) => args[0]
```

#### No-output Macro
Performs side effects without returning:
```typescript
fn: (args, scope) => {
  scope.vars.set('x', args[0])
  // No return
}
```

#### Asynchronous Macro
Returns a serializable async result:
```typescript
fn: (args, scope) => {
  return createPromptAsyncResult('id', 'Enter value:', (input) => {
    // Handle user input
  })
}
```

## 4. Scope Management

Module: `src/runtime/engine/scope-manager.ts`

### Features

- Hierarchical scope management
- Global and local scope support
- Temporary (`_var`) vs permanent (`$var`) variables
- Scope traversal and variable lookup
- Parent scope chaining

### API

```typescript
import {
  createGlobalScope,
  createChildScope,
  setVariable,
  getVariable,
  updateVariable,
  deleteVariable,
} from '@twee-grind/harlowe-markup/runtime'

// Create global scope
const global = createGlobalScope()

// Create child scope
const child = createChildScope(global, 'passage1', 0)

// Set variables
setVariable(child, 'storyVar', 42)    // Goes to global scope
setVariable(child, '_tempVar', 'temp') // Stays in current scope

// Get variables (searches hierarchy)
const value = getVariable(child, 'storyVar') // Finds in global scope

// Update variables
updateVariable(child, 'storyVar', 43)

// Delete variables
deleteVariable(child, 'storyVar')
```

### Scope Hierarchy

```
Global Scope (srcPassage: null, srcPos: 0)
  └── Passage Scope (srcPassage: "StartPassage", srcPos: 0)
       └── Block Scope (srcPassage: "StartPassage", srcPos: 50)
```

### Variable Scoping Rules

- **Story variables** (`$var`): Stored in global scope, accessible everywhere
- **Temporary variables** (`_var`): Stored in current scope, accessible in current scope and children
- Variable lookup traverses from current scope up to global scope

## Testing

All features are comprehensively tested:

- `eval-lambda.test.ts`: Lambda creation and invocation tests
- `eval-matches.test.ts`: Pattern matching tests (all combinations)
- `macro-registry.test.ts`: Macro registration and invocation tests
- `scope-manager.test.ts`: Scope management and variable tests

Run tests:
```bash
npm test
```

## Build

The package can be built with:
```bash
npm run build
```

All features are properly exported through:
- `src/runtime/index.ts`
- `src/runtime/engine/index.ts`

## Type Definitions

New types added to the system:

- `LambdaVariable`: Anonymous function type
- `PatternVariable`: Pattern matching type
- `RegexDatatypeVariable`: Regex as datatype
- `MacroAsyncResult`: Async macro result type

## Integration

These features integrate seamlessly with the existing Harlowe runtime:

1. **Lambda evaluation** extends the expression evaluator
2. **Pattern matching** enhances the `matches` operator in `eval-helpers.ts`
3. **Macro registry** provides infrastructure for macro definitions
4. **Scope management** enables proper variable handling for macros like `(set:)`

## Examples

### Complete Example: Custom Macro with Lambda

```typescript
import {
  macroRegistry,
  invokeMacro,
  createLambda,
  createGlobalScope,
  setVariable,
} from '@twee-grind/harlowe-markup/runtime'

// Register a map macro
macroRegistry.register({
  name: 'map',
  fn: (args, scope) => {
    const array = args[0] as any[]
    const lambda = args[1] as LambdaVariable
    return array.map(item => invokeLambda(lambda, [item], context))
  },
  minArgs: 2,
  maxArgs: 2,
})

// Use the macro
const scope = createGlobalScope()
setVariable(scope, 'numbers', [1, 2, 3])

// Create lambda: x => x * 2
const doubleLambda = createLambda(['x'], multiplyByTwoExpressionNode, scope)

// Map over array
const result = invokeMacro('map', [[1, 2, 3], doubleLambda], scope)
// result: [2, 4, 6]
```

## Future Enhancements

Possible future extensions:

1. Lambda serialization for save/load support
2. Pattern compilation for better performance
3. Macro debugging and introspection tools
4. Scope snapshots for time-travel debugging
