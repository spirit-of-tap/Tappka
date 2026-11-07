export interface PlaybookParagraphBlock {
  kind: "paragraph";
  text: string;
}

export interface PlaybookListBlock {
  kind: "list";
  ordered: boolean;
  items: string[];
}

export interface PlaybookTableBlock {
  kind: "table";
  headers: string[];
  rows: string[][];
}

export interface PlaybookNoteBlock {
  kind: "note";
  text: string;
}

export interface PlaybookHeadingBlock {
  kind: "heading";
  level: 2 | 3;
  text: string;
}

export type PlaybookBlock =
  | PlaybookHeadingBlock
  | PlaybookParagraphBlock
  | PlaybookListBlock
  | PlaybookTableBlock
  | PlaybookNoteBlock;

export interface PlaybookSection {
  /** URL-safe id used for anchors (#metriky-training-session) and search deep-links. */
  slug: string;
  title: string;
  blocks: PlaybookBlock[];
}

export interface PlaybookChapter {
  slug: string;
  title: string;
  /** One-sentence lead shown on the chapter page under the header. */
  lead?: string;
  sections: PlaybookSection[];
}
