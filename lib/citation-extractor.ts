import type { Citation, CitationStyle, ContentBlock } from "@/types";
import { normaliseHeading } from "./heading-detector";

// ---- Citation regex patterns (most-to-least greedy) ----
const PATTERNS: { style: CitationStyle; regex: RegExp }[] = [
  {
    // Parenthetical citations (unified multi-paren and single author-year)
    // Matches (Smith, 2020) or (van Dijk et al., 2018; de Castro, 2019) or (see also O'Connor, 2021)
    style: "author-year-paren",
    regex: /\(\s*([^()]*?[A-Z][^()]*?,\s*(?:19|20)\d{2}[a-z]?(?:\s*;\s*[^()]*?[A-Z][^()]*?,\s*(?:19|20)\d{2}[a-z]?)*)\)/g,
  },
  {
    // Inline citations: Smith (2020) or Smith & Jones (2018) or de Castro et al. (2015)
    style: "author-year-inline",
    regex: /\b((?:(?:[a-z]{2,4}\s+)?[A-Z][a-zA-Z'\-]*(?:\s+et\s+al\.)?)|(?:(?:[a-z]{2,4}\s+)?[A-Z][a-zA-Z'\-]*\s+(?:and|&)\s+(?:[a-z]{2,4}\s+)?[A-Z][a-zA-Z'\-]*))\s+\(((?:19|20)\d{2}[a-z]?)\)/g,
  },
  {
    // Numbered citations in brackets, e.g. [1], [1, 2], [1-3], [1; 2]
    style: "numbered-bracket",
    regex: /\[\s*(\d+(?:\s*[\-–,;]\s*\d+)*)\s*\]/g,
  },
];

const SENTINEL = "\x00";

// ---- Exact multi-word heading phrases ----
const KNOWN_HEADINGS = new Set([
  "abstract", "introduction", "background", "overview", "motivation", "rationale", "scope",
  "related work", "related works", "prior work",
  "literature review", "systematic review", "narrative review",
  "theoretical framework", "theoretical background", "conceptual framework",
  "methodology", "method", "methods",
  "materials and methods", "methods and materials",
  "data and methods", "data and materials",
  "experimental setup", "experimental design", "experimental procedure",
  "study design", "research design",
  "experiments", "experiment",
  "study 1", "study 2", "study 3", "study 4",
  "results", "findings", "outcomes",
  "analysis", "analyses",
  "discussion", "general discussion",
  "conclusion", "conclusions", "concluding remarks", "closing remarks",
  "summary", "summary and conclusions", "summary and conclusion",
  "future work", "future directions", "future research",
  "limitations", "limitations and future work",
  "implications", "practical implications", "theoretical implications",
  "acknowledgments", "acknowledgements",
  "appendix", "supplementary material", "supplementary materials",
  "ethics statement", "ethical considerations",
  "data availability", "data availability statement",
  "author contributions", "conflict of interest", "competing interests",
  "funding", "funding sources",
  "participants", "measures", "procedure", "stimuli", "materials", "design",
  "sample", "sampling procedure", "data collection", "data analysis",
  "validity", "reliability", "limitations and delimitations",
]);

// ---- Vocabulary for semantic heading recognition ----
// A line is a heading if ALL its content words are in this set (≤6 words, no sentence punctuation)
const HEADING_VOCAB = new Set([
  // Section types
  "abstract", "introduction", "background", "overview", "motivation", "rationale", "scope",
  "related", "prior", "literature", "review", "survey",
  "methodology", "method", "methods", "materials", "experimental", "design",
  "procedure", "procedures", "stimuli", "measures", "participants", "sample", "sampling",
  "data", "collection", "preprocessing", "coding", "annotation", "sources", "dataset", "datasets",
  "analysis", "analyses", "framework", "model", "models", "approach", "approaches",
  "results", "findings", "outcome", "outcomes", "performance",
  "discussion", "implications", "interpretation",
  "conclusion", "conclusions", "summary", "remarks", "closing",
  "limitations", "future", "work", "directions", "extensions",
  "acknowledgments", "acknowledgements", "appendix", "supplementary",
  "study", "studies", "experiment", "experiments", "evaluation", "validation",
  "aim", "aims", "objective", "objectives", "hypothesis", "hypotheses",
  "theory", "theoretical", "empirical", "conceptual",
  "quantitative", "qualitative", "mixed",
  "systematic", "narrative", "pilot", "preliminary",
  // Common modifiers in headings
  "general", "main", "key", "core", "overall", "final", "initial", "primary", "secondary",
]);

const HEADING_STOP_WORDS = new Set([
  "and", "of", "for", "the", "a", "an", "in", "on", "with", "to", "by", "at", "from", "or",
]);

// Headings signal the References section should stop body content
const REFERENCES_HEADINGS = new Set([
  "references",
  "bibliography",
  "works cited",
  "reference list",
  "notes",
  "endnotes",
  "footnotes",
]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function detectHeading(raw: string): { level: 2 | 3; text: string } | null {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 120) return null;

  // Lines ending with sentence punctuation are not headings
  if (/[.!?]$/.test(trimmed) && !/\d\.$/.test(trimmed)) return null;

  // Lines with math/comparison operators or data-typical symbols are not headings
  if (/[=<>\/]/.test(trimmed)) return null;
  // Word-wrap artefact: real headings don't end with a hyphen
  if (trimmed.endsWith("-")) return null;

  const lower = trimmed.toLowerCase();

  // 1. Exact known heading phrase (case-insensitive)
  if (KNOWN_HEADINGS.has(lower)) return { level: 2, text: trimmed };

  // 2. Numbered sections: "1 Introduction", "2.1 Background", "1. Introduction"
  //    Guards: text after number must start uppercase, be ≤ 65 chars, not end
  //    with a hyphen (word-wrap artefact), and not end with a dangling preposition.
  const numbered = trimmed.match(/^(\d+(?:\.\d+)*)\.?\s+(.{3,80})$/);
  if (numbered) {
    const afterNum = numbered[2].trim();
    const dangling = /\b(of|for|in|to|with|by|at|from|and|or|a|the)\s*$/i;
    if (
      /^[A-Z]/.test(afterNum) &&
      afterNum.length <= 65 &&
      !afterNum.endsWith("-") &&
      !dangling.test(afterNum)
    ) {
      const depth = numbered[1].split(".").length;
      return { level: depth >= 2 ? 3 : 2, text: trimmed };
    }
  }

  // 3. "Study N" / "Experiment N" / "Phase N" patterns (multi-study papers)
  if (/^(Study|Experiment|Phase|Part)\s+\d+/i.test(trimmed)) {
    return { level: 2, text: trimmed };
  }

  // 4. Vocabulary check: short line whose every content word is a known heading word.
  //    This catches "General Discussion", "Mixed Methods", "Theoretical Background", etc.
  //    while rejecting author names, keywords, affiliations, and body-text fragments.

  // Lines ending with , or : are almost never standalone headings
  if (/[,:]$/.test(trimmed)) return null;

  const words = lower.replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  if (words.length >= 1 && words.length <= 6) {
    const contentWords = words.filter(
      (w) => !HEADING_STOP_WORDS.has(w) && !/^\d+$/.test(w)
    );
    if (contentWords.length >= 1 && contentWords.every((w) => HEADING_VOCAB.has(w))) {
      // Single-word vocabulary match: only allow headings that commonly stand alone.
      // This prevents wrapped body words like "models", "framework", "approach"
      // from being mistaken for headings.
      if (contentWords.length === 1) {
        const SOLO_HEADINGS = new Set([
          "abstract", "introduction", "background", "overview", "motivation",
          "methodology", "methods", "results", "findings", "discussion",
          "conclusion", "conclusions", "summary", "limitations", "implications",
          "acknowledgments", "acknowledgements", "appendix",
        ]);
        if (!SOLO_HEADINGS.has(contentWords[0])) return null;
      }
      return { level: 2, text: trimmed };
    }
  }

  return null;
}

function isPageHeaderOrFooter(text: string): boolean {
  const t = text.trim();
  // Pure page number
  if (/^\d+$/.test(t)) return true;
  // Very short (≤ 4 chars)
  if (t.length <= 4) return true;
  // Looks like "464 DEVOS AND BANAJI" (page number + author names)
  if (/^\d{1,4}\s+[A-Z\s]{3,40}$/.test(t)) return true;
  // Looks like "DEVOS AND BANAJI 465" (author names + page number)
  if (/^[A-Z\s]{3,40}\s+\d{1,4}$/.test(t)) return true;
  // Journal / volume info: "Vol. X, No. Y", "Journal of ...", "Proceedings of ..."
  if (/^(vol\.|volume|journal of|proceedings|pp\.\s*\d)/i.test(t)) return true;
  // DOI / URL lines
  if (/https?:\/\//i.test(t) && t.length < 200) return true;
  if (/\bdoi\.org\//i.test(t)) return true;
  // Article received/accepted date stamps (journal footers)
  if (/\b(received|accepted|available online)\b.*\d{4}/i.test(t)) return true;
  // Copyright / publisher lines
  if (/©\s*20\d\d|all rights reserved|elsevier|springer|wiley|taylor.*francis/i.test(t)) return true;
  // E-mail address lines
  if (/\be-?mail\s*(address)?[:﹕]/i.test(t)) return true;
  // Phone / fax / correspondence lines
  if (/\b(tel|fax|phone|correspondence)\b.*\d{4,}/i.test(t)) return true;
  // DOI without doi.org prefix: "DOI: 10.xxxx" or "doi:10.xxxx"
  if (/\bdoi\s*:\s*10\.\d/i.test(t)) return true;
  // Journal header lines: "Author et al. / Journal Name Vol (Year) pages"
  if (/\bet al\.\s*[/|]|\b\d{4}\)\s*\d+[-–]\d+/.test(t)) return true;
  // Significance footnotes from tables: "Significant at X% level"
  if (/^significant\s+at\s+\d+%/i.test(t)) return true;
  // Lines that are purely numbers, ranges, and statistical symbols (table cells)
  if (/^[\d\s\(\)\[\]\+\-–−±%.,*†‡§]+$/.test(t) && t.length > 4) return true;
  return false;
}

function expandBracketRange(match: string): number[] {
  const inner = match.replace(/^\[/, "").replace(/\]$/, "");
  const parts = inner.split(/\s*[,]\s*/);
  const ids: number[] = [];
  for (const part of parts) {
    const range = part.match(/^(\d+)\s*[–\-]\s*(\d+)$/);
    if (range) {
      const start = parseInt(range[1], 10);
      const end = parseInt(range[2], 10);
      for (let i = start; i <= end; i++) ids.push(i);
    } else {
      const n = parseInt(part.trim(), 10);
      if (!isNaN(n)) ids.push(n);
    }
  }
  return ids;
}

export function extractCitations(
  rawText: string,
  /** Section heading texts from Groq (normalised). Ground-truth for headings. */
  groqHeadings: Set<string> = new Set(),
  /** Front-matter lines from Groq (normalised): author names, affiliations,
   *  keywords, subtitles, etc.  These are ALWAYS routed to the metadata
   *  toggle regardless of where they appear in the text. */
  groqFrontMatter: Set<string> = new Set()
): {
  citations: Citation[];
  blocks: ContentBlock[];
  frontMatter: string;
} {
  const citationMap = new Map<string, number>();
  const citations: Citation[] = [];
  let counter = 1;

  function register(originalText: string, style: CitationStyle): number {
    if (citationMap.has(originalText)) return citationMap.get(originalText)!;
    const id = counter++;
    citationMap.set(originalText, id);
    citations.push({ id, originalText, style });
    return id;
  }

  // ---- Step 1: Truncate at the References section ----
  // Find the first occurrence of a standalone "References" heading line
  const refsMatch = rawText.match(
    /\n\s*(References?|Bibliography|Works Cited|Reference List)\s*\n/i
  );
  const bodyText = refsMatch
    ? rawText.slice(0, refsMatch.index)
    : rawText;

  // ---- Step 2: Apply citation replacements ----
  let processed = bodyText;
  for (const { style, regex } of PATTERNS) {
    regex.lastIndex = 0;
    processed = processed.replace(regex, (match) => {
      if (match.includes(SENTINEL)) return match;
      const id = register(match, style);
      return `${SENTINEL}${id}${SENTINEL}`;
    });
  }

  // Convert placeholders → <sup> tags
  processed = processed.replace(
    new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, "g"),
    (_, idStr) => {
      const id = parseInt(idStr, 10);
      const citation = citations.find((c) => c.id === id);
      if (
        citation?.style === "numbered-bracket" &&
        /\d+\s*[–\-]\s*\d+/.test(citation.originalText)
      ) {
        const nums = expandBracketRange(citation.originalText);
        return nums
          .map((n) => {
            const bracket = `[${n}]`;
            if (!citationMap.has(bracket)) {
              citationMap.set(bracket, counter);
              citations.push({ id: counter, originalText: bracket, style: "numbered-bracket" });
              counter++;
            }
            return `<sup class="citation-ref">${citationMap.get(bracket)}</sup>`;
          })
          .join("");
      }
      return `<sup class="citation-ref">${id}</sup>`;
    }
  );

  // ---- Step 3: Process line-by-line so headings are caught even without blank lines ----
  // Front matter (title, authors, affiliations, keywords) is skipped until the first heading.
  const lines = processed.split("\n");
  const slugCounts = new Map<string, number>();
  const blocks: ContentBlock[] = [];
  let seenFirstHeading = false;
  const frontMatterBuffer: string[] = [];
  let paragraphBuffer: string[] = [];
  let currentPageNumber = 1;

  function makeHeadingId(text: string): string {
    const baseSlug = slugify(text);
    const count = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, count);
    return count > 1 ? `${baseSlug}-${count}` : baseSlug;
  }

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;
    const raw = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!raw) return;
    const plainText = raw.replace(/<sup[^>]*>.*?<\/sup>/g, "").trim();
    if (isPageHeaderOrFooter(plainText) || plainText.length < 15) return;

    const figureMatch = plainText.match(/^(?:Figure|Fig\.)\s+(\d+)/i);
    const tableMatch = plainText.match(/^(?:Table)\s+(\d+)/i);

    if (figureMatch) {
      const id = "fig-" + blocks.filter((b) => b.type === "figure").length;
      blocks.push({
        type: "figure",
        html: raw,
        text: plainText,
        id,
        pageNumber: currentPageNumber,
      });
    } else if (tableMatch) {
      const id = "tbl-" + blocks.filter((b) => b.type === "table").length;
      blocks.push({
        type: "table",
        html: raw,
        text: plainText,
        id,
        pageNumber: currentPageNumber,
      });
    } else {
      const id = "p-" + blocks.filter((b) => b.type === "paragraph").length;
      blocks.push({
        type: "paragraph",
        html: raw,
        text: plainText,
        id,
        pageNumber: currentPageNumber,
      });
    }
  }

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph();
      continue;
    }

    const pageMarkerMatch = trimmedLine.match(/^---PAGE_NUMBER_(\d+)---$/);
    if (pageMarkerMatch) {
      flushParagraph();
      currentPageNumber = parseInt(pageMarkerMatch[1], 10);
      continue;
    }

    const plainLine = trimmedLine.replace(/<sup[^>]*>.*?<\/sup>/g, "").trim();

    if (isPageHeaderOrFooter(plainLine)) {
      flushParagraph();
      continue;
    }

    if (REFERENCES_HEADINGS.has(plainLine.toLowerCase())) {
      flushParagraph();
      break;
    }

    const normLine = normaliseHeading(plainLine);

    // Lines Groq identified as front matter (author names, affiliations, keywords,
    // subtitles…) always go to the metadata toggle — never into body content.
    if (groqFrontMatter.has(normLine)) {
      flushParagraph();
      const clean = plainLine.replace(/<[^>]+>/g, "").trim();
      if (clean.length >= 5) frontMatterBuffer.push(clean);
      continue;
    }

    // Groq heading ground-truth takes priority; heuristics fill in the rest.
    const groqMatch = groqHeadings.has(normLine);
    const heading = groqMatch
      ? { level: (/^\d+\.\d+/.test(plainLine) ? 3 : 2) as 2 | 3, text: plainLine }
      : detectHeading(plainLine);

    if (heading) {
      flushParagraph();
      seenFirstHeading = true;
      blocks.push({
        type: "heading",
        html: heading.text,
        text: heading.text,
        level: heading.level,
        id: makeHeadingId(heading.text),
        pageNumber: currentPageNumber,
      });
      continue;
    }

    // Before first heading: collect as front matter (strip any <sup> tags for display)
    if (!seenFirstHeading) {
      const clean = plainLine.replace(/<[^>]+>/g, "").trim();
      if (clean.length >= 5) frontMatterBuffer.push(clean);
      continue;
    }

    paragraphBuffer.push(trimmedLine);
  }
  flushParagraph();

  return { citations, blocks, frontMatter: frontMatterBuffer.join("\n") };
}

export function extractTitle(rawText: string): string {
  const skipPhrases = [
    "abstract",
    "introduction",
    "keywords",
    "contents",
    "references",
    "provided proper attribution",
    "permission to reproduce",
    "reproduce the tables",
    "all rights reserved",
    "arxiv:",
    "doi:",
    "preprint",
    "copyright",
    "journalistic or scholarly",
    "scholarly works",
    "google hereby",
    "submitted to",
    "under review",
    "working paper",
  ];
  const lines = rawText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    if (
      trimmed.length > 5 &&
      trimmed.length < 180 &&
      !skipPhrases.some((p) => lower.includes(p)) &&
      !lower.startsWith("http") &&
      !/^\d+$/.test(trimmed)
    ) {
      return trimmed;
    }
  }
  return rawText.slice(0, 120).replace(/\n/g, " ").trim();
}
