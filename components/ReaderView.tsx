"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Citation, ContentBlock } from "@/types";
import FootnoteList from "./FootnoteList";
import TableOfContents from "./TableOfContents";

interface Props {
  blocks: ContentBlock[];
  citations: Citation[];
  title: string;
  frontMatter?: string;
}

export default function ReaderView({ blocks, citations, title, frontMatter }: Props) {
  const hasCitations = citations.length > 0;
  const hasHeadings = blocks.some((b) => b.type === "heading");
  const [metaOpen, setMetaOpen] = useState(false);

  return (
    <div className="flex gap-8 px-6 py-8 max-w-6xl mx-auto w-full">
      {/* Left sidebar: Table of Contents */}
      {hasHeadings && <TableOfContents blocks={blocks} />}

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-3xl">
        {title && (
          <h1 className="text-2xl font-bold text-slate-900 mb-4 leading-snug">
            {title}
          </h1>
        )}

        {/* Collapsible front matter (authors, affiliations, abstract, keywords) */}
        {frontMatter && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
            <button
              onClick={() => setMetaOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {metaOpen ? (
                <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
              )}
              Paper info &amp; abstract
            </button>
            {metaOpen && (
              <div className="px-4 pb-4 pt-1 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed border-t border-slate-200">
                {frontMatter}
              </div>
            )}
          </div>
        )}

        {!hasCitations && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No in-text citations were detected. The paper may use a footnote
            style not yet supported, or citations are already in a
            non-standard format.
          </div>
        )}

        <article className="prose prose-slate prose-lg max-w-none">
          {blocks.map((block) => {
            if (block.type === "heading") {
              const Tag = block.level === 3 ? "h3" : "h2";
              return (
                <Tag
                  key={block.id}
                  id={block.id}
                  className={
                    block.level === 3
                      ? "text-base font-semibold text-slate-700 mt-6 mb-2 scroll-mt-4"
                      : "text-lg font-bold text-slate-800 mt-8 mb-3 scroll-mt-4"
                  }
                >
                  {block.text}
                </Tag>
              );
            }
            return (
              <p
                key={block.id}
                dangerouslySetInnerHTML={{ __html: block.html }}
                className="leading-relaxed"
              />
            );
          })}
        </article>

        <FootnoteList citations={citations} />
      </div>
    </div>
  );
}
