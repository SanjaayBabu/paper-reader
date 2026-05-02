"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReaderView from "@/components/ReaderView";
import CitationNetwork from "@/components/CitationNetwork";
import { BookOpen, Network, ArrowLeft } from "lucide-react";
import type { ParseApiResponse } from "@/types";

export default function ReaderPage() {
  const router = useRouter();
  const [result, setResult] = useState<ParseApiResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("paperReader:result");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setResult(JSON.parse(raw));
    } catch {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    // h-screen + overflow-hidden makes this a fully bounded layout.
    // Children use flex-1 + overflow-y-auto to create their own scroll containers,
    // which is required for position:sticky to work inside them.
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header — shrink-0 so it never collapses */}
      <header className="border-b bg-white/90 backdrop-blur-sm px-6 py-3 flex items-center gap-4 shrink-0 z-20">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Upload another
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{result.title}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>{result.citations.length} citations</span>
        </div>
      </header>

      {/* Tabs — min-h-0 lets the flex child shrink so overflow-y-auto activates */}
      <Tabs defaultValue="clean" className="flex-1 flex flex-col min-h-0">
        <div className="border-b px-6 bg-white shrink-0">
          <TabsList className="h-10 bg-transparent gap-1 p-0">
            <TabsTrigger
              value="clean"
              className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 rounded-none px-4 text-sm"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              Clean Text
            </TabsTrigger>
            <TabsTrigger
              value="network"
              className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 rounded-none px-4 text-sm"
            >
              <Network className="w-3.5 h-3.5 mr-1.5" />
              Citation Network
            </TabsTrigger>
          </TabsList>
        </div>

        {/* This div is now the real scroll container — sticky children work inside it */}
        <TabsContent value="clean" className="flex-1 overflow-y-auto min-h-0 mt-0" data-scroll-root="true">
          <ReaderView
            blocks={result.blocks}
            citations={result.citations}
            title={result.title}
            frontMatter={result.frontMatter}
          />
        </TabsContent>

        <TabsContent value="network" className="flex-1 min-h-0 mt-0 overflow-hidden">
          <CitationNetwork title={result.title} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
