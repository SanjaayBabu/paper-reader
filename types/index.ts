// ---- Citation (in-text) ----
export type CitationStyle =
  | "numbered-bracket"
  | "author-year-paren"
  | "author-year-inline"
  | "multi-paren";

export interface Citation {
  id: number;
  originalText: string;
  style: CitationStyle;
}

// ---- Content blocks (headings + paragraphs + figures + tables) ----
export interface ContentBlock {
  type: "paragraph" | "heading" | "figure" | "table";
  html: string;   // HTML-safe (may contain <sup> tags for paragraphs)
  text: string;   // plain text (for ToC labels and anchors)
  level?: 2 | 3; // only for headings
  id: string;     // slug for anchor navigation
  pageNumber?: number; // 1-indexed source PDF page number
}

// ---- API request/response shapes ----
export interface ParseApiResponse {
  rawText: string;
  title: string;
  citations: Citation[];
  blocks: ContentBlock[];
  frontMatter: string;
}

export interface CitationNetworkRequest {
  title: string;
}

export interface PaperNode {
  paperId: string;
  title: string;
  year?: number;
  authors: string[];
  doi?: string;
  url: string;
}

export interface CitationNetworkResponse {
  paperId: string;
  paperTitle: string;
  paperYear?: number;
  paperAuthors: string[];
  references: PaperNode[];
  citedBy: PaperNode[];
}

// ---- React Flow node data ----
export interface PaperNodeData extends Record<string, unknown> {
  label: string;
  year?: number;
  authors: string[];
  url: string;
  nodeType: "center" | "reference" | "citedBy";
}

// ---- Reader page state (passed via sessionStorage) ----
export interface ReaderState {
  parseResult: ParseApiResponse;
}
