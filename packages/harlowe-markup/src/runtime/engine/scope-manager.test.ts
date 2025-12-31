import {
  createScope,
  createGlobalScope,
  createChildScope,
  getVariable,
  hasVariable,
  setVariable,
  updateVariable,
  deleteVariable,
  findGlobalScope,
  findVariableScope,
  getAllVariables,
  getScopeDepth,
  isGlobalScope,
  getScopeInfo,
} from './scope-manager.js'
import type { HarloweEngineScope } from '../types'

describe('Scope Manager Module', () => {
  describe('Scope Creation', () => {
    it('should create a basic scope', () => {
      const scope = createScope('passage1', 10)

      expect(scope.srcPassage).toBe('passage1')
      expect(scope.srcPos).toBe(10)
      expect(scope.vars.size).toBe(0)
      expect(scope.parent).toBeUndefined()
    })

    it('should create a global scope', () => {
      const scope = createGlobalScope()

      expect(scope.srcPassage).toBeNull()
      expect(scope.srcPos).toBe(0)
      expect(scope.parent).toBeUndefined()
      expect(isGlobalScope(scope)).toBe(true)
    })

    it('should create a child scope', () => {
      const parent = createGlobalScope()
      const child = createChildScope(parent, 'passage1', 5)

      expect(child.srcPassage).toBe('passage1')
      expect(child.srcPos).toBe(5)
      expect(child.parent).toBe(parent)
      expect(isGlobalScope(child)).toBe(false)
    })

    it('should create a scope hierarchy', () => {
      const global = createGlobalScope()
      const level1 = createChildScope(global, 'passage1', 0)
      const level2 = createChildScope(level1, 'passage2', 10)

      expect(level2.parent).toBe(level1)
      expect(level1.parent).toBe(global)
      expect(global.parent).toBeUndefined()
    })
  })

  describe('Variable Access', () => {
    it('should get variable from current scope', () => {
      const scope = createGlobalScope()
      scope.vars.set('x', 42)

      expect(getVariable(scope, 'x')).toBe(42)
    })

    it('should get variable from parent scope', () => {
      const parent = createGlobalScope()
      parent.vars.set('x', 42)
      const child = createChildScope(parent, 'passage1', 0)

      expect(getVariable(child, 'x')).toBe(42)
    })

    it('should return undefined for non-existent variable', () => {
      const scope = createGlobalScope()

      expect(getVariable(scope, 'nonexistent')).toBeUndefined()
    })

    it('should prioritize current scope over parent', () => {
      const parent = createGlobalScope()
      parent.vars.set('x', 'parent')
      const child = createChildScope(parent, 'passage1', 0)
      child.vars.set('x', 'child')

      expect(getVariable(child, 'x')).toBe('child')
    })

    it('should check if variable exists', () => {
      const parent = createGlobalScope()
      parent.vars.set('x', 42)
      const child = createChildScope(parent, 'passage1', 0)

      expect(hasVariable(child, 'x')).toBe(true)
      expect(hasVariable(child, 'nonexistent')).toBe(false)
    })

    it('should traverse multiple levels', () => {
      const global = createGlobalScope()
      global.vars.set('x', 'global')
      const level1 = createChildScope(global, 'passage1', 0)
      const level2 = createChildScope(level1, 'passage2', 10)

      expect(getVariable(level2, 'x')).toBe('global')
    })
  })

  describe('Variable Setting', () => {
    it('should set story variable in global scope', () => {
      const global = createGlobalScope()
      const child = createChildScope(global, 'passage1', 0)

      setVariable(child, 'storyVar', 42)

      expect(global.vars.get('storyVar')).toBe(42)
      expect(child.vars.has('storyVar')).toBe(false)
    })

    it('should set temporary variable in current scope', () => {
      const global = createGlobalScope()
      const child = createChildScope(global, 'passage1', 0)

      setVariable(child, '_tempVar', 42)

      expect(child.vars.get('_tempVar')).toBe(42)
      expect(global.vars.has('_tempVar')).toBe(false)
    })

    it('should handle multiple temporary variables in different scopes', () => {
      const global = createGlobalScope()
      const child1 = createChildScope(global, 'passage1', 0)
      const child2 = createChildScope(global, 'passage2', 0)

      setVariable(child1, '_temp', 'child1')
      setVariable(child2, '_temp', 'child2')

      expect(getVariable(child1, '_temp')).toBe('child1')
      expect(getVariable(child2, '_temp')).toBe('child2')
    })

    it('should update existing variable in its scope', () => {
      const scope = createGlobalScope()
      scope.vars.set('x', 10)

      updateVariable(scope, 'x', 20)

      expect(scope.vars.get('x')).toBe(20)
    })

    it('should update variable in parent scope', () => {
      const parent = createGlobalScope()
      parent.vars.set('x', 10)
      const child = createChildScope(parent, 'passage1', 0)

      updateVariable(child, 'x', 20)

      expect(parent.vars.get('x')).toBe(20)
    })

    it('should create variable if it does not exist', () => {
      const scope = createGlobalScope()

      updateVariable(scope, 'newVar', 42)

      expect(scope.vars.get('newVar')).toBe(42)
    })

    it('should delete variable from scope', () => {
      const scope = createGlobalScope()
      scope.vars.set('x', 42)

      const deleted = deleteVariable(scope, 'x')

      expect(deleted).toBe(true)
      expect(scope.vars.has('x')).toBe(false)
    })

    it('should delete variable from parent scope', () => {
      const parent = createGlobalScope()
      parent.vars.set('x', 42)
      const child = createChildScope(parent, 'passage1', 0)

      const deleted = deleteVariable(child, 'x')

      expect(deleted).toBe(true)
      expect(parent.vars.has('x')).toBe(false)
    })

    it('should return false when deleting non-existent variable', () => {
      const scope = createGlobalScope()

      const deleted = deleteVariable(scope, 'nonexistent')

      expect(deleted).toBe(false)
    })
  })

  describe('Scope Traversal', () => {
    it('should find global scope from child', () => {
      const global = createGlobalScope()
      const level1 = createChildScope(global, 'passage1', 0)
      const level2 = createChildScope(level1, 'passage2', 10)

      expect(findGlobalScope(level2)).toBe(global)
    })

    it('should find global scope when already at global', () => {
      const global = createGlobalScope()

      expect(findGlobalScope(global)).toBe(global)
    })

    it('should find variable scope', () => {
      const global = createGlobalScope()
      const child = createChildScope(global, 'passage1', 0)
      child.vars.set('x', 42)

      const foundScope = findVariableScope(child, 'x')

      expect(foundScope).toBe(child)
    })

    it('should find variable in parent scope', () => {
      const parent = createGlobalScope()
      parent.vars.set('x', 42)
      const child = createChildScope(parent, 'passage1', 0)

      const foundScope = findVariableScope(child, 'x')

      expect(foundScope).toBe(parent)
    })

    it('should return undefined for non-existent variable scope', () => {
      const scope = createGlobalScope()

      const foundScope = findVariableScope(scope, 'nonexistent')

      expect(foundScope).toBeUndefined()
    })

    it('should get all visible variables', () => {
      const global = createGlobalScope()
      global.vars.set('globalVar', 'global')
      const child = createChildScope(global, 'passage1', 0)
      child.vars.set('childVar', 'child')

      const allVars = getAllVariables(child)

      expect(allVars.size).toBe(2)
      expect(allVars.get('globalVar')).toBe('global')
      expect(allVars.get('childVar')).toBe('child')
    })

    it('should override parent variables in getAllVariables', () => {
      const parent = createGlobalScope()
      parent.vars.set('x', 'parent')
      const child = createChildScope(parent, 'passage1', 0)
      child.vars.set('x', 'child')

      const allVars = getAllVariables(child)

      expect(allVars.get('x')).toBe('child')
    })

    it('should calculate scope depth', () => {
      const global = createGlobalScope()
      const level1 = createChildScope(global, 'passage1', 0)
      const level2 = createChildScope(level1, 'passage2', 10)

      expect(getScopeDepth(global)).toBe(0)
      expect(getScopeDepth(level1)).toBe(1)
      expect(getScopeDepth(level2)).toBe(2)
    })
  })

  describe('Scope Information', () => {
    it('should identify global scope', () => {
      const global = createGlobalScope()
      const child = createChildScope(global, 'passage1', 0)

      expect(isGlobalScope(global)).toBe(true)
      expect(isGlobalScope(child)).toBe(false)
    })

    it('should get scope info', () => {
      const global = createGlobalScope()
      global.vars.set('var1', 1)
      const child = createChildScope(global, 'passage1', 5)
      child.vars.set('var2', 2)

      const info = getScopeInfo(child)

      expect(info.depth).toBe(1)
      expect(info.isGlobal).toBe(false)
      expect(info.srcPassage).toBe('passage1')
      expect(info.srcPos).toBe(5)
      expect(info.varCount).toBe(1)
      expect(info.totalVisibleVars).toBe(2)
    })

    it('should get global scope info', () => {
      const global = createGlobalScope()
      global.vars.set('var1', 1)

      const info = getScopeInfo(global)

      expect(info.depth).toBe(0)
      expect(info.isGlobal).toBe(true)
      expect(info.srcPassage).toBeNull()
      expect(info.srcPos).toBe(0)
      expect(info.varCount).toBe(1)
      expect(info.totalVisibleVars).toBe(1)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should simulate passage scope hierarchy', () => {
      // Global scope
      const global = createGlobalScope()
      setVariable(global, 'playerName', 'Alice')
      setVariable(global, 'score', 100)

      // Passage 1 scope
      const passage1 = createChildScope(global, 'StartPassage', 0)
      setVariable(passage1, '_localChoice', 'option1')

      // Nested block in passage 1
      const block1 = createChildScope(passage1, 'StartPassage', 50)
      setVariable(block1, '_tempResult', 'success')

      // Verify global variables accessible everywhere
      expect(getVariable(block1, 'playerName')).toBe('Alice')
      expect(getVariable(block1, 'score')).toBe(100)

      // Verify temporary variables in correct scopes
      expect(getVariable(block1, '_localChoice')).toBe('option1')
      expect(getVariable(block1, '_tempResult')).toBe('success')

      // Verify temporary variable not in global scope
      expect(getVariable(global, '_localChoice')).toBeUndefined()

      // Passage 2 scope (separate from passage 1)
      const passage2 = createChildScope(global, 'NextPassage', 0)
      expect(getVariable(passage2, '_localChoice')).toBeUndefined()
      expect(getVariable(passage2, 'playerName')).toBe('Alice')
    })

    it('should simulate set macro behavior', () => {
      const global = createGlobalScope()
      const passage = createChildScope(global, 'Test', 0)

      // Simulating (set: $x to 10)
      setVariable(passage, 'x', 10)
      expect(global.vars.get('x')).toBe(10)

      // Simulating (set: _temp to 20)
      setVariable(passage, '_temp', 20)
      expect(passage.vars.get('_temp')).toBe(20)
      expect(global.vars.has('_temp')).toBe(false)

      // Simulating (set: $x to $x + 5)
      const currentX = getVariable(passage, 'x') as number
      setVariable(passage, 'x', currentX + 5)
      expect(global.vars.get('x')).toBe(15)
    })
  })
})
