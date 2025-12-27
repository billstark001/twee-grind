/**
 * Harlowe markup analysis command
 */

import { TokenWalker, Markup, traverseAST } from '@twee-grind/harlowe-markup';
import * as fs from 'fs';

const DISP_LENGTH = 128;

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
            operand, chainedMacros, attachedHook, children, args,
            ...nodeData
          } = event.node as any;
          const nodeInfo = Object.keys(nodeData).length > 0
            ? JSON.stringify(nodeData)
            : '';
          console.log(`${astPad}[${type}] ${nodeInfo}`);
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

        process.stdout.write(`${pad}[${node.type}${(node as any).name ? ':' + (node as any).name : ''}]`);
        const { name, children,
          innerMode, matches, cannotCross, isFront,
          type, start, end, text, innerText, place, aka,
          ...rest
        } = node as any;
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
