/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { extractCitations, extractTitle } from "@/lib/citation-extractor";
import { detectHeadingsWithClaude } from "@/lib/heading-detector";

export const runtime = "nodejs";
export const maxDuration = 60;

async function renderPageWithLayout(pageData: any): Promise<string> {
  const textContent = await pageData.getTextContent({ normalizeWhitespace: true });
  const items = textContent.items || [];
  if (items.length === 0) return "";

  const pageNum = pageData.pageIndex + 1;
  const viewport = pageData.getViewport ? pageData.getViewport({ scale: 1.0 }) : null;
  const pageWidth = pageData.view ? pageData.view[2] : (viewport ? viewport.width : 612);
  const midX = pageWidth / 2;

  const tolerance = 3;
  const linesMap: { y: number; items: any[] }[] = [];

  for (const item of items) {
    if (typeof item.str !== "string" || !item.transform) continue;

    const x = item.transform[4];
    const y = item.transform[5];
    const width = item.width || 0;
    const str = item.str;

    if (!str.trim()) continue;

    const foundLine = linesMap.find((line) => Math.abs(line.y - y) <= tolerance);
    if (foundLine) {
      foundLine.items.push({ x, y, width, str });
    } else {
      linesMap.push({ y, items: [{ x, y, width, str }] });
    }
  }

  linesMap.sort((a, b) => b.y - a.y);

  for (const line of linesMap) {
    line.items.sort((a, b) => a.x - b.x);
  }

  interface PageLine {
    y: number;
    leftItems: any[];
    rightItems: any[];
    spanningItems: any[];
    type: "spanning" | "two-column";
  }

  const pageLines: PageLine[] = linesMap.map((line) => {
    const leftItems: any[] = [];
    const rightItems: any[] = [];
    const spanningItems: any[] = [];

    for (const entry of line.items) {
      const rightEdge = entry.x + entry.width;
      const center = entry.x + entry.width / 2;
      
      if (entry.x < midX - 15 && rightEdge > midX + 15) {
        spanningItems.push(entry);
      } else if (center < midX) {
        leftItems.push(entry);
      } else {
        rightItems.push(entry);
      }
    }

    let type: "spanning" | "two-column" = "two-column";
    
    if (spanningItems.length > 0) {
      type = "spanning";
    } else if (leftItems.length > 0 && rightItems.length > 0) {
      const rightmostLeft = Math.max(...leftItems.map(it => it.x + it.width));
      const leftmostRight = Math.min(...rightItems.map(it => it.x));
      const gap = leftmostRight - rightmostLeft;
      
      if (gap <= 18) {
        type = "spanning";
      }
    } else {
      type = "two-column";
    }

    if (type === "spanning") {
      return {
        y: line.y,
        leftItems: [],
        rightItems: [],
        spanningItems: line.items,
        type: "spanning",
      };
    } else {
      return {
        y: line.y,
        leftItems,
        rightItems,
        spanningItems: [],
        type: "two-column",
      };
    }
  });

  interface PageBlock {
    type: "spanning" | "two-column";
    lines: PageLine[];
  }

  const blocks: PageBlock[] = [];
  let currentBlock: PageBlock | null = null;

  for (const line of pageLines) {
    if (!currentBlock) {
      currentBlock = { type: line.type, lines: [line] };
      blocks.push(currentBlock);
    } else if (currentBlock.type === line.type) {
      currentBlock.lines.push(line);
    } else {
      currentBlock = { type: line.type, lines: [line] };
      blocks.push(currentBlock);
    }
  }

  const joinLines = (linesList: { str: string; y: number }[]): string => {
    if (linesList.length === 0) return "";
    let result = "";
    for (let i = 0; i < linesList.length; i++) {
      const current = linesList[i].str.trim();
      if (!current) continue;

      result += current;

      if (i < linesList.length - 1) {
        const currentY = linesList[i].y;
        const nextY = linesList[i + 1].y;
        const yGap = Math.abs(currentY - nextY);

        const endsWithPunctuation = /[.!?﹕.”"]$/.test(current);
        const isShortLine = current.length < 55;
        const largeGap = yGap > 16;

        if (largeGap || (endsWithPunctuation && isShortLine)) {
          result += "\n\n";
        } else {
          if (current.endsWith("-") && /[a-zA-Z]/.test(current[current.length - 2])) {
            result = result.slice(0, -1);
          } else {
            result += " ";
          }
        }
      }
    }
    return result;
  };

  let pageText = "";

  for (const block of blocks) {
    if (block.type === "spanning") {
      const linesFormatted = block.lines.map(line => ({
        str: line.spanningItems.map(it => it.str).join(" ").trim(),
        y: line.y
      })).filter(l => l.str);
      
      const blockText = joinLines(linesFormatted);
      if (blockText) pageText += blockText + "\n\n";
    } else {
      const leftLines = block.lines.map(line => ({
        str: line.leftItems.map(it => it.str).join(" ").trim(),
        y: line.y
      })).filter(l => l.str);
      const leftColText = joinLines(leftLines);

      const rightLines = block.lines.map(line => ({
        str: line.rightItems.map(it => it.str).join(" ").trim(),
        y: line.y
      })).filter(l => l.str);
      const rightColText = joinLines(rightLines);

      if (leftColText) pageText += leftColText + "\n\n";
      if (rightColText) pageText += rightColText + "\n\n";
    }
  }

  return `\n---PAGE_NUMBER_${pageNum}---\n` + pageText;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const fileType = (file as File).type;
  if (fileType && fileType !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 20 MB)" },
      { status: 413 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Import inner lib to avoid pdf-parse's self-test that reads a file on require
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer, options?: any) => Promise<{ text: string }>;

  let pdfData: { text: string };
  try {
    pdfData = await pdfParse(buffer, { pagerender: renderPageWithLayout });
  } catch {
    return NextResponse.json(
      { error: "Could not parse PDF — the file may be corrupted" },
      { status: 422 }
    );
  }

  const rawText = pdfData.text;

  if (rawText.trim().length < 100) {
    return NextResponse.json(
      {
        error:
          "PDF appears to be a scanned image. Text extraction requires OCR (not yet supported).",
      },
      { status: 422 }
    );
  }

  // Run Groq document structure detection and PDF title extraction in parallel.
  const [groqStructure, fallbackTitle] = await Promise.all([
    detectHeadingsWithClaude(rawText),
    Promise.resolve(extractTitle(rawText)),
  ]);

  const headings = groqStructure.headings;
  const groqFrontMatter = groqStructure.frontMatter;
  const title = groqStructure.title || fallbackTitle;
  
  if (groqStructure.authors) {
    groqFrontMatter.add(groqStructure.authors.toLowerCase().trim());
  }

  const { citations, blocks, frontMatter } = extractCitations(rawText, headings, groqFrontMatter);

  let finalFrontMatter = frontMatter;
  if (!frontMatter.trim() && groqStructure.authors) {
    finalFrontMatter = `Authors: ${groqStructure.authors}`;
  }

  return NextResponse.json({ rawText, title, citations, blocks, frontMatter: finalFrontMatter });
}
