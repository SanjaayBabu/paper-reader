import type { CitationNetworkResponse, PaperNode } from "@/types";

const BASE = "https://api.semanticscholar.org/graph/v1";

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent": "paper-reader/1.0",
  };
  if (process.env.S2_API_KEY) {
    headers["x-api-key"] = process.env.S2_API_KEY;
  }
  return headers;
}

function mapNode(entry: Record<string, unknown>): PaperNode | null {
  const p = (entry.citedPaper ?? entry.citingPaper) as Record<string, unknown>;
  if (!p || !p.paperId) return null;
  const externalIds = p.externalIds as Record<string, string> | undefined;
  const doi = externalIds?.DOI;
  const authors = (p.authors as { name: string }[]) ?? [];
  return {
    paperId: p.paperId as string,
    title: (p.title as string) ?? "Unknown Title",
    year: p.year as number | undefined,
    authors: authors.map((a) => a.name),
    doi,
    url: doi
      ? `https://doi.org/${doi}`
      : `https://www.semanticscholar.org/paper/${p.paperId}`,
  };
}

export async function fetchCitationNetwork(
  title: string
): Promise<CitationNetworkResponse> {
  const headers = buildHeaders();

  // 1. Search for paper
  const searchRes = await fetch(
    `${BASE}/paper/search?query=${encodeURIComponent(title)}&fields=paperId,title,year,authors&limit=1`,
    { headers }
  );

  if (searchRes.status === 429) {
    throw new Error("RATE_LIMIT");
  }
  if (!searchRes.ok) {
    throw new Error(`Search failed: ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  if (!searchData.data?.length) {
    throw new Error("NOT_FOUND");
  }

  const paper = searchData.data[0];
  const paperId: string = paper.paperId;

  // 2. Fetch references and citations in parallel
  const [refRes, citeRes] = await Promise.all([
    fetch(
      `${BASE}/paper/${paperId}/references?fields=title,year,authors,externalIds&limit=100`,
      { headers }
    ),
    fetch(
      `${BASE}/paper/${paperId}/citations?fields=title,year,authors,externalIds&limit=100`,
      { headers }
    ),
  ]);

  if (refRes.status === 429 || citeRes.status === 429) {
    throw new Error("RATE_LIMIT");
  }

  const refData = await refRes.json();
  const citeData = await citeRes.json();

  return {
    paperId,
    paperTitle: paper.title,
    paperYear: paper.year,
    paperAuthors: (paper.authors as { name: string }[])?.map((a) => a.name) ?? [],
    references: ((refData.data ?? []) as Record<string, unknown>[])
      .map(mapNode)
      .filter((n): n is PaperNode => n !== null),
    citedBy: ((citeData.data ?? []) as Record<string, unknown>[])
      .map(mapNode)
      .filter((n): n is PaperNode => n !== null),
  };
}
