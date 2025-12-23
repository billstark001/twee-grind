/**
 * Twee 3 project types and parser
 */

export interface Passage {
  name: string;
  tags: string[];
  metadata: Record<string, string>;
  text: string;
}

export interface Story {
  name: string;
  startPassage?: string;
  passages: Passage[];
  metadata: Record<string, any>;
}

/**
 * Parse Twee 3 format content
 */
export class TweeParser {
  /**
   * Parse a Twee 3 file content into passages
   */
  parse(content: string): Passage[] {
    const passages: Passage[] = [];
    const passageRegex = /^::(.+?)(?:\[(.+?)\])?(?:\s*<(.+?)>)?$/gm;
    const lines = content.split('\n');
    
    let currentPassage: Passage | null = null;
    let textLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/^::(.+?)(?:\[(.+?)\])?(?:\s*<(.+?)>)?$/);
      
      if (match) {
        // Save previous passage
        if (currentPassage) {
          currentPassage.text = textLines.join('\n').trim();
          passages.push(currentPassage);
        }

        // Parse new passage header
        const name = match[1].trim();
        const tags = match[2] ? match[2].split(/\s+/).filter(t => t) : [];
        const metadataStr = match[3] || '';
        const metadata: Record<string, string> = {};

        // Parse metadata
        if (metadataStr) {
          const metaPairs = metadataStr.split(/\s+/);
          for (const pair of metaPairs) {
            const [key, value] = pair.split(':');
            if (key) metadata[key] = value || '';
          }
        }

        currentPassage = { name, tags, metadata, text: '' };
        textLines = [];
      } else if (currentPassage) {
        textLines.push(line);
      }
    }

    // Save last passage
    if (currentPassage) {
      currentPassage.text = textLines.join('\n').trim();
      passages.push(currentPassage);
    }

    return passages;
  }

  /**
   * Create a Story from passages
   */
  createStory(name: string, passages: Passage[], metadata: Record<string, any> = {}): Story {
    return {
      name,
      passages,
      metadata,
      startPassage: passages.find(p => p.tags.includes('start'))?.name || passages[0]?.name,
    };
  }
}

export const parser = new TweeParser();
