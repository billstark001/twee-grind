#!/usr/bin/env node
/**
 * CLI entry point
 */

import { Command } from 'commander';
import { extractor } from './extractor';
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
  .action(async (htmlFile: string, options: { output: string }) => {
    try {
      const htmlPath = path.resolve(htmlFile);
      const outputDir = path.resolve(options.output);
      await extractor.extractFromFile(htmlPath, outputDir);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
