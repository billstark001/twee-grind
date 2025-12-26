#!/usr/bin/env node
/**
 * CLI entry point
 */

import { Command } from 'commander';
import { extractor } from './extractor';
import { harlowe } from './harlowe';
import * as path from 'path';

const program = new Command();

program
  .name('twee')
  .description('CLI tool for Twee/Twine operations')
  .version('0.1.0');

program
  .command('extract <html-file>')
  .description('Extract tw-storydata and tw-passagedata from HTML file')
  .option('-o, --output <dir>', 'Output directory', '.')
  .action((htmlFile: string, options: { output: string }) => {
    try {
      const htmlPath = path.resolve(htmlFile);
      const outputDir = path.resolve(options.output);
      extractor.extractFromFile(htmlPath, outputDir);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('harlowe [file]')
  .description('Analyze Harlowe markup code from file or stdin')
  .option('--ast', 'Display AST structure instead of tokens')
  .action((file?: string, options?: { ast?: boolean }) => {
    harlowe.analyze(file, options?.ast ? 'ast' : 'tokens');
  });

program.parse();
