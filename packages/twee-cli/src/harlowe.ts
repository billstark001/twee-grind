/**
 * Harlowe markup analysis command
 */

import { TokenWalker, Markup, traverseAST } from '@twee-grind/harlowe-markup';
import * as fs from 'fs';

const DISP_LENGTH = 128;

/**
 * Build line offsets array for efficient offset-to-line conversion
 */
function buildLineOffsets(code: string): number[] {
  const lineOffsets: number[] = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') {
      lineOffsets.push(i + 1);
    }
  }
  return lineOffsets;
}

/**
 * Convert character offset to 1-based line and column number using binary search
 */
function offsetToPosition(lineOffsets: number[], offset: number): { line: number; column: number } {
  let left = 0;
  let right = lineOffsets.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    if (lineOffsets[mid] <= offset) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  const line = left + 1; // Convert to 1-based
  const column = offset - lineOffsets[left] + 1; // Convert to 1-based
  return { line, column };
}

/**
 * Format location info as L:C format
 */
function formatLocation(lineOffsets: number[], start: number, end: number): string {
  const startPos = offsetToPosition(lineOffsets, start);
  const endPos = offsetToPosition(lineOffsets, end);

  if (startPos.line === endPos.line) {
    // Same line
    return `@${startPos.line}:${startPos.column}-${endPos.column}`;
  } else {
    // Different lines
    return `@${startPos.line}:${startPos.column}-${endPos.line}:${endPos.column}`;
  }
}

export const harlowe = {
  /**
   * Analyze Harlowe code from a file or stdin
   */
  analyze(file?: string, mode: 'tokens' | 'ast' = 'tokens') {
    try {
      let code: string;

      if (file) {
        // Read from file
        code = fs.readFileSync(file, 'utf-8');
      } else {
        // Read from stdin
        code = fs.readFileSync(0, 'utf-8');
      }

      // Build line offsets for efficient line number lookup
      const lineOffsets = buildLineOffsets(code);

      const rootToken = Markup.lex(code);

      if (mode === 'ast') {
        const rootNode = Markup.parse(rootToken);
        // Display parsed AST structure
        let astLayer = 1;
        for (const event of traverseAST(rootNode)) {
          if (!event.entering) {
            --astLayer;
            continue;
          }
          const astPad = '  '.repeat(astLayer);
          const {
            type, left, right,
            start, end, place,
            operand, chainedMacros, attachedHook, children, args,
            ...nodeData
          } = event.node as any;
          const nodeInfo = Object.keys(nodeData).length > 0
            ? JSON.stringify(nodeData)
            : '';
          const locationInfo = start !== undefined && end !== undefined
            ? ` ${formatLocation(lineOffsets, start, end)}`
            : '';
          console.log(`${astPad}[${type}${locationInfo}] ${nodeInfo}`);
          ++astLayer;
        }
        return;
      }

      const walker = new TokenWalker(rootToken);
      let layer = 0;
      for (const { node, entering } of walker) {
        if (!entering) {
          --layer;
          continue;
        }
        const pad = ' '.repeat(layer);

        const { name, children,
          innerMode, matches, cannotCross, isFront,
          type, start, end, text, innerText, place, aka,
          ...rest
        } = node as any;

        const locationInfo = start !== undefined && end !== undefined
          ? ` ${formatLocation(lineOffsets, start, end)}`
          : '';
        process.stdout.write(`${pad}[${type}${name ? ':' + name : ''}${locationInfo}]`);

        const textDisplay = node.text ? JSON.stringify(node.text) : '';
        const innerTextDisplay = node.innerText ? JSON.stringify(node.innerText) : '';
        const objectDisplay = Object.keys(rest).length === 0 ? '' : JSON.stringify(rest);
        console.log(' ' + (textDisplay.length > DISP_LENGTH
          ? textDisplay.slice(0, DISP_LENGTH - 3) + '...'
          : textDisplay
        ));
        if (innerTextDisplay) {
          console.log(`${pad} (innerText) ` + (innerTextDisplay.length > DISP_LENGTH
            ? innerTextDisplay.slice(0, DISP_LENGTH - 3) + '...'
            : innerTextDisplay
          ));
        }
        if (objectDisplay) {
          console.log(`${pad} (data) ` + objectDisplay);
        }

        ++layer;
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      console.error('Stack trace:', error instanceof Error ? error.stack : '');
      process.exit(1);
    }
  }
};
