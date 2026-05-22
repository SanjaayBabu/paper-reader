/**
 * Groq-powered document structure detector.
 *
 * One call asks Groq to return two lists:
 *   • section_headings  – actual section / subsection labels
 *   • front_matter      – author names, affiliations, keywords, subtitles, dates
 *
 * Both sets are normalised (lowercase, collapsed whitespace) so the parser can
 * do fast O(1) lookups.  Falls back to empty sets when GROQ_API_KEY is absent
 * or the call fails — heuristics in citation-extractor.ts keep working.
 */

import Groq from "groq-sdk";

export interface PaperStructure {
  headings: Set<string>;      // section / subsection labels
  frontMatter: Set<string>;   // metadata lines to keep out of the body
  title?: string;
  authors?: string;
}

/** Normalise a string for comparison: lowercase, collapse whitespace, strip
 *  trailing punctuation that PDFs sometimes append. */
export function normaliseHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "");
}

export async function detectHeadingsWithClaude(
  rawText: string
): Promise<PaperStructure> {
  const empty: PaperStructure = { headings: new Set(), frontMatter: new Set() };
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return empty;

  // Collect deduplicated candidate lines: short (≤ 120 chars), no
  // sentence-terminal punctuation, at least 2 chars.
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const raw of rawText.split("\n")) {
    const line = raw.trim();
    if (
      line.length >= 2 &&
      line.length <= 120 &&
      !/[.!?]$/.test(line) &&
      !seen.has(line)
    ) {
      seen.add(line);
      candidates.push(line);
      if (candidates.length >= 300) break;
    }
  }

  if (candidates.length === 0) return empty;

  const prompt = `You are analysing candidate lines extracted from an academic research paper PDF.

Return a JSON object with exactly FOUR fields:

"title": A clean string containing the exact main title of the paper.
"authors": A clean string containing the names of the authors of the paper (e.g. "John Doe, Jane Smith").
"section_headings": Lines that are section or subsection HEADINGS of the paper body.
  INCLUDE: numbered sections ("1 Introduction", "2.1 Methods"), named sections ("Abstract", "Results", "Discussion", "Conclusion"), subsection titles.
  These are SHORT LABELS — not sentences, not list items.

"front_matter": Lines that are METADATA appearing before or around the paper body.
  INCLUDE: subtitle phrases ("A systematic review", "A meta-analysis"), author names, author affiliations, university/institution/department names, city/country lines, dates, "Keywords:" lines and keyword lists, "Corresponding author" lines, journal names, ISSN/DOI lines, mixed-methods labels used as keywords.
  These should NOT appear as readable body content.

Rules:
- A line can appear in at most ONE array.
- Full sentences and paragraph fragments go in neither array.
- If unsure, omit the line.

Return ONLY valid JSON like: {"title": "...", "authors": "...", "section_headings": [...], "front_matter": [...]}

Candidate lines:
${candidates.join("\n")}`;

  try {
    const client = new Groq({ apiKey });
    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 1500,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    // Extract the JSON object even if the model wraps it in markdown fences
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const toSet = (arr: unknown): Set<string> => {
      if (!Array.isArray(arr)) return new Set();
      return new Set(
        arr
          .filter((h): h is string => typeof h === "string")
          .map(normaliseHeading)
      );
    };

    return {
      headings: toSet(parsed.section_headings),
      frontMatter: toSet(parsed.front_matter),
      title: typeof parsed.title === "string" ? parsed.title.trim() : undefined,
      authors: typeof parsed.authors === "string" ? parsed.authors.trim() : undefined,
    };
  } catch {
    return empty;
  }
}
