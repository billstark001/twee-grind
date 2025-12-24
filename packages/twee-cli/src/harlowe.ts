/**
 * Harlowe markup analysis command
 */

import { TokenWalker, Markup } from '@twee-grind/harlowe-markup';
import * as fs from 'fs';

const DISP_LENGTH = 128;

export const harlowe = {
  /**
   * Analyze Harlowe code from a file or stdin
   */
  analyze(file?: string) {
    try {
      let code: string;

      if (file) {
        // Read from file
        code = fs.readFileSync(file, 'utf-8');
      } else {
        // Read from stdin
        code = fs.readFileSync(0, 'utf-8');
      }

      // Call TokenWalker.walk to analyze and output results
      const walker = new TokenWalker(code);
      let layer = 0;
      let ignoreUntilLayer = -1;
      for (const { node, entering } of walker) {
        if (!entering) {
          --layer;
          if (layer < ignoreUntilLayer) {
            ignoreUntilLayer = -1;
          }
          continue;
        }
        const pad = ' '.repeat(layer);

        process.stdout.write(`${pad}[${node.type}${(node as any).name ? ':' + (node as any).name : ''}]`);
        const { name, children,
          innerMode, matches, cannotCross, isFront,
          type, start, end, text, innerText, place,
          ...rest
        } = node as any;
        let textDisplay = JSON.stringify(node.text) ?? JSON.stringify(node.innerText) ?? '';
        if (Object.keys(rest).length > 0) {
          textDisplay += (textDisplay ? ' ' : '') + JSON.stringify(rest);
        }
        console.log(' ' + (textDisplay.length > DISP_LENGTH
          ? textDisplay.slice(0, DISP_LENGTH - 3) + '...'
          : textDisplay
        ));


        if (node.type === 'macro') {
          const parsedMacro = Markup.parse([node]);
          const rawText = JSON.stringify(parsedMacro, null, 2);
          const paddedText = rawText
            .replace(/\n/g, '\n' + pad);
          console.log(pad + paddedText);
          ignoreUntilLayer = layer;
          // ++layer;
        }

        ++layer;
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
};
