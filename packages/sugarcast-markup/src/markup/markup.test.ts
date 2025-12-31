/**
 * Tests for the complete SugarCube markup parser
 */

import { parse, MarkupParser } from '../markup';
import {
  DocumentNode,
  MacroContainerNode,
  MacroNode,
  LinkNode,
  TextFlowNode,
} from '../types';

describe('SugarCube Markup Parser', () => {
  describe('Basic parsing', () => {
    test('parses plain text', () => {
      const result = parse('Hello world');
      expect(result.type).toBe('document');
      expect(result.children).toHaveLength(1);
      expect(result.children[0].type).toBe('textFlow');
    });

    test('parses text with variables', () => {
      const result = parse('Your name is $name');
      expect(result.type).toBe('document');
      expect(result.children.length).toBeGreaterThan(0);
      
      // Find variable node
      const varNode = result.children.find(n => n.type === 'variable');
      expect(varNode).toBeDefined();
      expect((varNode as any)?.name).toBe('$name');
    });

    test('parses links', () => {
      const result = parse('Go to [[Next Room]]');
      expect(result.type).toBe('document');
      
      // Find link node
      const linkNode = result.children.find(n => n.type === 'link') as LinkNode;
      expect(linkNode).toBeDefined();
      expect(linkNode.passage).toBe('Next Room');
    });

    test('parses links with display text', () => {
      const result = parse('[[Click here|Next Room]]');
      const linkNode = result.children.find(n => n.type === 'link') as LinkNode;
      expect(linkNode).toBeDefined();
      expect(linkNode.text).toBe('Click here');
      expect(linkNode.passage).toBe('Next Room');
    });
  });

  describe('Simple macros', () => {
    test('parses self-closing macro', () => {
      const result = parse('<<set $x = 5>>');
      expect(result.type).toBe('document');
      
      const macroNode = result.children.find(n => n.type === 'macro') as MacroNode;
      expect(macroNode).toBeDefined();
      expect(macroNode.name).toBe('set');
      expect(macroNode.args).toBeDefined();
    });

    test('parses print macro', () => {
      const result = parse('The value is <<print $x>>');
      const macroNode = result.children.find(n => n.type === 'macro') as MacroNode;
      expect(macroNode).toBeDefined();
      expect(macroNode.name).toBe('print');
    });
  });

  describe('If-elseif-else structures', () => {
    test('parses simple if macro', () => {
      const source = `<<if $x > 5>>
        X is greater than 5
      <</if>>`;
      
      const result = parse(source);
      const container = result.children.find(n => n.type === 'macroContainer') as MacroContainerNode;
      
      expect(container).toBeDefined();
      expect(container.containerType).toBe('if');
      expect(container.branches).toHaveLength(1);
      expect(container.branches[0].branchType).toBe('if');
      expect(container.branches[0].children.length).toBeGreaterThan(0);
    });

    test('parses if-else structure', () => {
      const source = `<<if $x > 5>>
        X is greater than 5
      <<else>>
        X is not greater than 5
      <</if>>`;
      
      const result = parse(source);
      const container = result.children.find(n => n.type === 'macroContainer') as MacroContainerNode;
      
      expect(container).toBeDefined();
      expect(container.containerType).toBe('if');
      expect(container.branches).toHaveLength(2);
      expect(container.branches[0].branchType).toBe('if');
      expect(container.branches[1].branchType).toBe('else');
    });

    test('parses if-elseif-else structure', () => {
      const source = `<<if $x > 10>>
        X is greater than 10
      <<elseif $x > 5>>
        X is greater than 5
      <<else>>
        X is 5 or less
      <</if>>`;
      
      const result = parse(source);
      const container = result.children.find(n => n.type === 'macroContainer') as MacroContainerNode;
      
      expect(container).toBeDefined();
      expect(container.containerType).toBe('if');
      expect(container.branches).toHaveLength(3);
      expect(container.branches[0].branchType).toBe('if');
      expect(container.branches[1].branchType).toBe('elseif');
      expect(container.branches[2].branchType).toBe('else');
    });

    test('parses nested if structures', () => {
      const source = `<<if $x > 5>>
        <<if $y > 10>>
          Both conditions true
        <</if>>
      <</if>>`;
      
      const result = parse(source);
      const outerContainer = result.children.find(n => n.type === 'macroContainer') as MacroContainerNode;
      
      expect(outerContainer).toBeDefined();
      expect(outerContainer.containerType).toBe('if');
      
      const innerContainer = outerContainer.branches[0].children.find(
        n => n.type === 'macroContainer'
      ) as MacroContainerNode;
      
      expect(innerContainer).toBeDefined();
      expect(innerContainer.containerType).toBe('if');
    });
  });

  describe('Switch-case structures', () => {
    test('parses simple switch-case', () => {
      const source = `<<switch $value>>
        <<case 1>>
          Value is one
        <<case 2>>
          Value is two
        <<default>>
          Value is something else
      <</switch>>`;
      
      const result = parse(source);
      const container = result.children.find(n => n.type === 'macroContainer') as MacroContainerNode;
      
      expect(container).toBeDefined();
      expect(container.containerType).toBe('switch');
      expect(container.branches).toHaveLength(3);
      expect(container.branches[0].branchType).toBe('case');
      expect(container.branches[1].branchType).toBe('case');
      expect(container.branches[2].branchType).toBe('default');
    });

    test('parses switch without default', () => {
      const source = `<<switch $value>>
        <<case 1>>
          Value is one
        <<case 2>>
          Value is two
      <</switch>>`;
      
      const result = parse(source);
      const container = result.children.find(n => n.type === 'macroContainer') as MacroContainerNode;
      
      expect(container).toBeDefined();
      expect(container.containerType).toBe('switch');
      expect(container.branches).toHaveLength(2);
    });
  });

  describe('For and while loops', () => {
    test('parses for loop', () => {
      const source = `<<for $i = 0; $i < 10; $i++>>
        Item $i
      <</for>>`;
      
      const result = parse(source);
      const container = result.children.find(n => n.type === 'macroContainer') as MacroContainerNode;
      
      expect(container).toBeDefined();
      expect(container.containerType).toBe('for');
      expect(container.branches).toHaveLength(1);
      expect(container.branches[0].branchType).toBe('main');
    });

    test('parses while loop', () => {
      const source = `<<while $x > 0>>
        X is $x
        <<set $x-->>
      <</while>>`;
      
      const result = parse(source);
      const container = result.children.find(n => n.type === 'macroContainer') as MacroContainerNode;
      
      expect(container).toBeDefined();
      expect(container.containerType).toBe('while');
    });
  });

  describe('Complex passages', () => {
    test('parses passage with mixed content', () => {
      const source = `You are in a room.

<<if $hasKey>>
  You have a key. You can [[open the door|Next Room]].
<<else>>
  You need to find a key.
<</if>>

Your health: <<print $health>>`;
      
      const result = parse(source);
      expect(result.type).toBe('document');
      expect(result.children.length).toBeGreaterThan(0);
      
      // Should have textFlow, macroContainer, and macro nodes
      const hasTextFlow = result.children.some(n => n.type === 'textFlow');
      const hasContainer = result.children.some(n => n.type === 'macroContainer');
      const hasMacro = result.children.some(n => n.type === 'macro');
      
      expect(hasTextFlow).toBe(true);
      expect(hasContainer).toBe(true);
      expect(hasMacro).toBe(true);
    });

    test('parses passage from test file', () => {
      const source = `<<widget "importDetailsDisplay">>
  <<if _args[0]>>
    <div class="presetConfirm settingsGrid">
      <<if _args[0].starting isnot undefined>>
        <div class="settingsHeader">
          test1
        </div>
      <</if>>
    </div>
  <</if>>
<</widget>>`;
      
      const result = parse(source);
      expect(result.type).toBe('document');
      
      const widgetContainer = result.children.find(n => n.type === 'macroContainer') as MacroContainerNode;
      expect(widgetContainer).toBeDefined();
      expect(widgetContainer.containerType).toBe('widget');
    });
  });

  describe('Formatted text', () => {
    test('parses bold text', () => {
      const result = parse("This is ''bold'' text");
      expect(result.type).toBe('document');
      // Check that formatted text is parsed
      const textFlow = result.children.find(n => n.type === 'textFlow') as TextFlowNode;
      expect(textFlow).toBeDefined();
    });

    test('parses italic text', () => {
      const result = parse('This is //italic// text');
      expect(result.type).toBe('document');
      const textFlow = result.children.find(n => n.type === 'textFlow') as TextFlowNode;
      expect(textFlow).toBeDefined();
    });

    test('parses code text', () => {
      const result = parse('This is {{{code}}} text');
      expect(result.type).toBe('document');
      const textFlow = result.children.find(n => n.type === 'textFlow') as TextFlowNode;
      expect(textFlow).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    test('handles empty string', () => {
      const result = parse('');
      expect(result.type).toBe('document');
      expect(result.children).toHaveLength(0);
    });

    test('handles unclosed macros gracefully', () => {
      const source = '<<if $x > 5>>\n  Content without closing tag';
      const result = parse(source);
      expect(result.type).toBe('document');
      // Should still create a container even if unclosed
      const container = result.children.find(n => n.type === 'macroContainer');
      expect(container).toBeDefined();
    });

    test('handles multiple line breaks', () => {
      const result = parse('Line 1\n\n\nLine 2');
      expect(result.type).toBe('document');
      expect(result.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser options', () => {
    test('retains literal text when option is set', () => {
      const parser = new MarkupParser({ retainLiteral: true });
      const result = parser.parse('Hello world');
      expect(result.type).toBe('document');
      // Literal should be retained in nodes
    });
  });
});
