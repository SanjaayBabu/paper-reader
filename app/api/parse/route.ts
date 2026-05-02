import { NextResponse } from "next/server";
import { extractCitations, extractTitle } from "@/lib/citation-extractor";
import { detectHeadingsWithClaude } from "@/lib/heading-detector";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;

  let pdfData: { text: string };
  try {
    pdfData = await pdfParse(buffer);
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

  // Run Claude heading detection and PDF title extraction in parallel.
  // Claude call is a no-op (returns empty Set) when ANTHROPIC_API_KEY is absent.
  const [{ headings, frontMatter: groqFrontMatter }, title] = await Promise.all([
    detectHeadingsWithClaude(rawText),
    Promise.resolve(extractTitle(rawText)),
  ]);

  const { citations, blocks, frontMatter } = extractCitations(rawText, headings, groqFrontMatter);

  return NextResponse.json({ rawText, title, citations, blocks, frontMatter });
}
