import { NextResponse } from "next/server";
import { fetchCitationNetwork } from "@/lib/semantic-scholar";
import type { CitationNetworkRequest } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: CitationNetworkRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const data = await fetchCitationNetwork(body.title.trim());
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "NOT_FOUND", title: body.title.trim() },
        { status: 404 }
      );
    }
    if (message === "RATE_LIMIT") {
      return NextResponse.json(
        { error: "RATE_LIMIT" },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
