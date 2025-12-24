export const colors = Object.freeze([
  'none',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple'
] as const);

export type Color = typeof colors[number];

export type TagColors = Record<string, Exclude<Color, 'none'>>;

/**
 * A single passage in a story.
 */
export interface Passage {
  id?: string;

  name: string;
  tags: string[];
  text: string;
  
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export interface Story {
  /**
   * IFID of the story. An IFID should stay stable when a story is imported or exported.
   */
  ifid: string;
  /**
   * GUID identifying the story.
   */
  id: string;
  /**
   * When the story was last changed.
   */
  lastUpdate: Date;
  /**
   * Name of the story.
   */
  name: string;
  /**
   * Passages in the story.
   */
  passages: Passage[];
  /**
   * Author-created JavaScript associated with the story.
   */
  script: string;
  /**
   * Is the story currently selected by the user?
   */
  selected: boolean;
  /**
   * Should passages snap to a grid?
   */
  snapToGrid: boolean;
  /**
   * ID of the passage that the story begins at.
   */
  startPassage: string;
  /**
   * Name of the story format the story uses.
   */
  storyFormat: string;
  /**
   * Version of the story format that this story uses.
   */
  storyFormatVersion: string;
  /**
   * Author-created CSS associated with the story.
   */
  stylesheet: string;
  /**
   * Tags applied to the story.
   */
  tags: string[];
  /**
   * Author-specified colors for passage tags.
   */
  tagColors: TagColors;
  /**
   * Zoom level the story is displayed at.
   */
  zoom: number;
}