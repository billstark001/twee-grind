/**
 * HTML extraction utilities
 */

import * as fs from 'fs';
import * as path from 'path';

export interface StoryData {
  name: string;
  startnode?: string;
  creator?: string;
  'creator-version'?: string;
  ifid?: string;
  format?: string;
  'format-version'?: string;
  options?: string;
  [key: string]: any;
}

export interface PassageData {
  pid: string;
  name: string;
  tags?: string;
  position?: string;
  size?: string;
  content: string;
  [key: string]: any;
}

/**
 * Extract tw-storydata and tw-passagedata from HTML
 */
export class HTMLExtractor {
  /**
   * Extract story data from HTML content
   */
  extractStoryData(html: string): StoryData | null {
    const storyDataMatch = html.match(/<tw-storydata([^>]*)>/i);
    if (!storyDataMatch) return null;

    const attrs = storyDataMatch[1];
    const data: StoryData = { name: '' };

    // Extract attributes from opening tag only
    const attrRegex = /(\w+(?:-\w+)*)="([^"]*)"/g;
    let match;
    while ((match = attrRegex.exec(attrs)) !== null) {
      data[match[1]] = match[2];
    }

    return data;
  }

  /**
   * Extract passage data from HTML content
   */
  extractPassages(html: string): PassageData[] {
    const passages: PassageData[] = [];
    const passageRegex = /<tw-passagedata([^>]*)>([\s\S]*?)<\/tw-passagedata>/gi;
    let match;

    while ((match = passageRegex.exec(html)) !== null) {
      const attrs = match[1];
      const content = match[2].trim();
      
      const passage: PassageData = {
        pid: '',
        name: '',
        content: this.decodeHTML(content),
      };

      // Extract attributes
      const attrRegex = /(\w+)="([^"]*)"/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        passage[attrMatch[1]] = attrMatch[2];
      }

      passages.push(passage);
    }

    return passages;
  }

  /**
   * Decode HTML entities
   */
  private decodeHTML(html: string): string {
    return html
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  /**
   * Convert passages to Twee format
   */
  passagesToTwee(passages: PassageData[]): string {
    return passages.map(p => {
      const tags = p.tags ? ` [${p.tags}]` : '';
      const meta: string[] = [];
      if (p.position) meta.push(`position:${p.position}`);
      if (p.size) meta.push(`size:${p.size}`);
      const metaStr = meta.length > 0 ? ` <${meta.join(' ')}>` : '';
      
      return `::${p.name}${tags}${metaStr}\n${p.content}\n`;
    }).join('\n\n');
  }

  /**
   * Extract and save from HTML file
   */
  extractFromFile(htmlPath: string, outputDir: string = '.'): void {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const storyData = this.extractStoryData(html);
    const passages = this.extractPassages(html);

    if (!storyData) {
      throw new Error('No story data found in HTML');
    }

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save metadata as JSON
    const metadataPath = path.join(outputDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(storyData, null, 2));

    // Save passages as Twee files
    const passagesDir = path.join(outputDir, 'passages');
    if (!fs.existsSync(passagesDir)) {
      fs.mkdirSync(passagesDir, { recursive: true });
    }

    const tweePath = path.join(passagesDir, `${storyData.name || 'story'}.twee`);
    const tweeContent = this.passagesToTwee(passages);
    fs.writeFileSync(tweePath, tweeContent);

    console.log(`Extracted to ${outputDir}`);
    console.log(`  Metadata: ${metadataPath}`);
    console.log(`  Passages: ${tweePath}`);
  }
}

export const extractor = new HTMLExtractor();
