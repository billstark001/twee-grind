/**
 * Complete SugarCube markup parser
 * Combines all syntax parsers and handles macro pairing
 */

import { Parser, SyntaxCollection, SyntaxNode } from '../parser';
import { defaultSyntax, MacroParserConfigCollection, MacroArgument } from '../syntax';
import {
  DocumentNode,
  PassageFlowNode,
  MacroNode,
  MacroContainerNode,
  MacroBranch,
} from '../types';

/**
 * Convert SyntaxNode to PassageFlowNode
 */
function convertSyntaxNode(node: SyntaxNode): PassageFlowNode | PassageFlowNode[] {
  const args = node.args as any || {};

  switch (node.name) {
    case '__text__':
      return {
        type: 'textFlow',
        start: node.start,
        end: node.end,
        children: [{
          type: 'text',
          content: args.text || '',
          start: node.start,
          end: node.end,
        }],
      };

    case 'macro':
      return {
        type: 'macro',
        name: args.name || '',
        args: args.args || [],
        isClose: args.isClose,
        closed: args.closed,
        children: node.children ? convertSyntaxNodes(node.children) : undefined,
        error: args.error,
        start: node.start,
        end: node.end,
      };

    case 'link':
      if (args.isLink) {
        return {
          type: 'link',
          text: args.text,
          passage: args.link,
          setter: args.setter,
          start: node.start,
          end: node.end,
        };
      } else if (args.isImage) {
        return {
          type: 'image',
          source: args.source,
          text: args.text,
          link: args.link,
          setter: args.setter,
          align: args.align,
          start: node.start,
          end: node.end,
        };
      }
      break;

    case 'image':
      return {
        type: 'image',
        source: args.source || '',
        text: args.text,
        link: args.link,
        setter: args.setter,
        align: args.align,
        start: node.start,
        end: node.end,
      };

    case 'nakedVariable':
      return {
        type: 'variable',
        name: args.text || '',
        raw: args.text,
        start: node.start,
        end: node.end,
      };

    case 'htmlTag':
      return {
        type: 'htmlTag',
        tagName: args.name || '',
        attributes: args.attrs,
        isVoid: args.isVoid,
        children: node.children ? convertSyntaxNodes(node.children) : undefined,
        start: node.start,
        end: node.end,
      };

    case 'lineBreak':
      return {
        type: 'textFlow',
        start: node.start,
        end: node.end,
        children: [{
          type: 'textElement',
          element: 'lineBreak',
          count: args.count || 1,
          start: node.start,
          end: node.end,
        }],
      };

    case 'horizontalRule':
      return {
        type: 'textFlow',
        start: node.start,
        end: node.end,
        children: [{
          type: 'textElement',
          element: 'horizontalRule',
          start: node.start,
          end: node.end,
        }],
      };

    case 'formatByChar':
      if (args.type === 'code') {
        return {
          type: 'textFlow',
          start: node.start,
          end: node.end,
          children: [{
            type: 'formattedText',
            format: 'code',
            children: [{
              type: 'text',
              content: args.text || '',
              start: node.start,
              end: node.end,
            }],
            start: node.start,
            end: node.end,
          }],
        };
      } else {
        return {
          type: 'textFlow',
          start: node.start,
          end: node.end,
          children: [{
            type: 'formattedText',
            format: args.type || 'em',
            children: node.children ? flattenTextFlow(convertSyntaxNodes(node.children)) : [],
            start: node.start,
            end: node.end,
          }],
        };
      }

    default:
      // For unhandled node types, try to convert children
      if (node.children && node.children.length > 0) {
        return convertSyntaxNodes(node.children);
      }
      // Return as text if we can't convert
      return {
        type: 'textFlow',
        start: node.start,
        end: node.end,
        children: [{
          type: 'text',
          content: node.literal || '',
          start: node.start,
          end: node.end,
        }],
      };
  }

  return {
    type: 'textFlow',
    start: node.start,
    end: node.end,
    children: [],
  };
}

/**
 * Convert array of SyntaxNodes to PassageFlowNodes
 */
function convertSyntaxNodes(nodes: SyntaxNode[]): PassageFlowNode[] {
  const result: PassageFlowNode[] = [];
  for (const node of nodes) {
    const converted = convertSyntaxNode(node);
    if (Array.isArray(converted)) {
      result.push(...converted);
    } else {
      result.push(converted);
    }
  }
  return mergeTextFlows(result);
}

/**
 * Merge consecutive textFlow nodes
 */
function mergeTextFlows(nodes: PassageFlowNode[]): PassageFlowNode[] {
  const result: PassageFlowNode[] = [];
  let lastTextFlow: any = null;

  for (const node of nodes) {
    if (node.type === 'textFlow') {
      if (lastTextFlow) {
        // Merge with previous textFlow
        lastTextFlow.children.push(...(node as any).children);
        lastTextFlow.end = node.end;
      } else {
        // Start new textFlow
        lastTextFlow = { ...node };
        result.push(lastTextFlow);
      }
    } else {
      lastTextFlow = null;
      result.push(node);
    }
  }

  return result;
}

/**
 * Flatten text flow children from PassageFlowNode array
 */
function flattenTextFlow(nodes: PassageFlowNode[]): any[] {
  const result: any[] = [];
  for (const node of nodes) {
    if (node.type === 'textFlow') {
      result.push(...(node as any).children);
    } else {
      result.push(node);
    }
  }
  return result;
}

/**
 * Pair macros and create container structures
 */
function pairMacros(nodes: PassageFlowNode[]): PassageFlowNode[] {
  const result: PassageFlowNode[] = [];
  const stack: Array<{ opener: MacroNode; container: MacroContainerNode; index: number }> = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.type !== 'macro') {
      if (stack.length > 0) {
        // Add to current container
        const top = stack[stack.length - 1];
        const currentBranch = top.container.branches[top.container.branches.length - 1];
        currentBranch.children.push(node);
      } else {
        result.push(node);
      }
      continue;
    }

    const macro = node as MacroNode;

    // Handle if-elseif-else structures
    if (macro.name === 'if') {
      const container: MacroContainerNode = {
        type: 'macroContainer',
        containerType: 'if',
        branches: [{
          type: 'macroBranch',
          branchType: 'if',
          condition: macro.args,
          children: [],
          start: macro.start,
          end: macro.end,
        }],
        start: macro.start,
        end: macro.end,
      };
      stack.push({ opener: macro, container, index: result.length });
      if (stack.length === 1) {
        result.push(container);
      } else {
        const parent = stack[stack.length - 2];
        const currentBranch = parent.container.branches[parent.container.branches.length - 1];
        currentBranch.children.push(container);
      }
    } else if ((macro.name === 'elseif' || macro.name === 'elif') && stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.container.containerType === 'if') {
        top.container.branches.push({
          type: 'macroBranch',
          branchType: 'elseif',
          condition: macro.args,
          children: [],
          start: macro.start,
          end: macro.end,
        });
      }
    } else if (macro.name === 'else' && stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.container.containerType === 'if') {
        top.container.branches.push({
          type: 'macroBranch',
          branchType: 'else',
          children: [],
          start: macro.start,
          end: macro.end,
        });
      }
    } else if (macro.name === 'endif' || macro.name === '/if' || macro.name === 'end if') {
      if (stack.length > 0 && stack[stack.length - 1].container.containerType === 'if') {
        const top = stack.pop()!;
        top.container.end = macro.end;
      }
    }
    // Handle switch-case structures
    else if (macro.name === 'switch') {
      const container: MacroContainerNode = {
        type: 'macroContainer',
        containerType: 'switch',
        branches: [],
        start: macro.start,
        end: macro.end,
      };
      // Store switch condition separately
      (container as any).switchCondition = macro.args;
      stack.push({ opener: macro, container, index: result.length });
      if (stack.length === 1) {
        result.push(container);
      } else {
        const parent = stack[stack.length - 2];
        const currentBranch = parent.container.branches[parent.container.branches.length - 1];
        currentBranch.children.push(container);
      }
    } else if (macro.name === 'case' && stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.container.containerType === 'switch') {
        top.container.branches.push({
          type: 'macroBranch',
          branchType: 'case',
          condition: macro.args,
          children: [],
          start: macro.start,
          end: macro.end,
        });
      }
    } else if (macro.name === 'default' && stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.container.containerType === 'switch') {
        top.container.branches.push({
          type: 'macroBranch',
          branchType: 'default',
          children: [],
          start: macro.start,
          end: macro.end,
        });
      }
    } else if (macro.name === 'endswitch' || macro.name === '/switch' || macro.name === 'end switch') {
      if (stack.length > 0 && stack[stack.length - 1].container.containerType === 'switch') {
        const top = stack.pop()!;
        top.container.end = macro.end;
      }
    }
    // Handle other paired macros (for, while, widget, etc.)
    else if (macro.isClose) {
      // Try to match with opener
      const baseName = macro.name.replace(/^(end|\/)\s*/, '');
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].opener.name === baseName) {
          const top = stack.splice(j, 1)[0];
          top.container.end = macro.end;
          break;
        }
      }
    } else if (macro.children && macro.children.length > 0) {
      // Macro already has children parsed - treat as self-contained
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        const currentBranch = top.container.branches[top.container.branches.length - 1];
        currentBranch.children.push(macro);
      } else {
        result.push(macro);
      }
    } else if (macro.closed === false && macro.error === 'REQ_CHILDREN_NOT_CLOSED') {
      // Opening macro that requires closing but wasn't closed
      const containerType = macro.name === 'for' ? 'for' :
                           macro.name === 'while' ? 'while' :
                           macro.name === 'widget' ? 'widget' :
                           'generic';
      const container: MacroContainerNode = {
        type: 'macroContainer',
        containerType: containerType,
        branches: [{
          type: 'macroBranch',
          branchType: 'main',
          condition: macro.args,
          children: [],
          start: macro.start,
          end: macro.end,
        }],
        start: macro.start,
        end: macro.end,
      };
      stack.push({ opener: macro, container, index: result.length });
      if (stack.length === 1) {
        result.push(container);
      } else {
        const parent = stack[stack.length - 2];
        const currentBranch = parent.container.branches[parent.container.branches.length - 1];
        currentBranch.children.push(container);
      }
    } else {
      // Self-closing or already closed macro (including macros with closed===false but no error)
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        const currentBranch = top.container.branches[top.container.branches.length - 1];
        currentBranch.children.push(macro);
      } else {
        result.push(macro);
      }
    }
  }

  // Close any unclosed containers
  while (stack.length > 0) {
    const top = stack.pop()!;
    top.container.end = top.container.start; // Mark as unclosed
  }

  return result;
}

/**
 * Options for the markup parser
 */
export interface MarkupParserOptions {
  retainLiteral?: boolean;
  macroConfig?: MacroParserConfigCollection;
}

/**
 * Complete SugarCube markup parser
 */
export class MarkupParser {
  private parser: Parser;

  constructor(options: MarkupParserOptions = {}) {
    const syntax = defaultSyntax(undefined, options.macroConfig);
    this.parser = new Parser(syntax, {
      profile: 'all',
      retainLiteral: options.retainLiteral || false,
      ignoreTerminatorCase: true,
      createNewTerminatorRegex: false,
      noLineBreak: false,
      noBlockContext: false,
      cleanup: false,
    });
  }

  /**
   * Parse source text into AST
   */
  parse(source: string): DocumentNode {
    const syntaxTree = this.parser.parse(source);
    const children = syntaxTree.children ? convertSyntaxNodes(syntaxTree.children) : [];
    const pairedChildren = pairMacros(children);

    return {
      type: 'document',
      children: pairedChildren,
      start: syntaxTree.start,
      end: syntaxTree.end,
    };
  }
}

/**
 * Parse source text into AST (convenience function)
 */
export function parse(source: string, options?: MarkupParserOptions): DocumentNode {
  const parser = new MarkupParser(options);
  return parser.parse(source);
}
