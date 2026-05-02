"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { computeLayout } from "@/lib/layout";
import type { CitationNetworkResponse, PaperNodeData } from "@/types";

// ---- Custom node ----
function PaperNode({ data }: NodeProps) {
  const d = data as PaperNodeData;
  const authorLine =
    d.authors.length > 0
      ? d.authors.slice(0, 2).join(", ") + (d.authors.length > 2 ? " et al." : "")
      : "";

  const borderColor =
    d.nodeType === "center"
      ? "border-indigo-500"
      : d.nodeType === "reference"
      ? "border-slate-300"
      : "border-violet-300";

  const bg =
    d.nodeType === "center" ? "bg-indigo-50" : "bg-white";

  return (
    <div
      className={`rounded-lg border-2 ${borderColor} ${bg} p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
      style={{ width: 240, minHeight: 90 }}
      onClick={() => window.open(d.url, "_blank", "noopener,noreferrer")}
    >
      {d.nodeType !== "center" && (
        <Handle type="source" position={Position.Right} className="opacity-0" />
      )}
      {d.nodeType !== "center" && (
        <Handle type="target" position={Position.Left} className="opacity-0" />
      )}
      {d.nodeType === "center" && (
        <>
          <Handle type="source" position={Position.Right} className="opacity-0" />
          <Handle type="target" position={Position.Left} className="opacity-0" />
        </>
      )}
      <p
        className={`text-xs font-semibold leading-snug line-clamp-3 ${
          d.nodeType === "center" ? "text-indigo-800" : "text-slate-800"
        }`}
      >
        {d.label}
      </p>
      {(authorLine || d.year) && (
        <p className="text-[11px] text-slate-500 mt-1.5">
          {authorLine}
          {authorLine && d.year ? " · " : ""}
          {d.year}
        </p>
      )}
    </div>
  );
}

const nodeTypes = { paperNode: PaperNode };

// ---- Legend ----
function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg border shadow-sm px-4 py-3 text-xs text-slate-600 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
        Current paper
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-0.5 bg-slate-400 inline-block" />
        Cited by this paper (references)
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-0.5 bg-violet-400 inline-block" />
        Papers citing this paper
      </div>
    </div>
  );
}

// ---- Main component ----
interface Props {
  title: string;
}

type NetworkState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: CitationNetworkResponse }
  | { status: "not_found"; searchedTitle: string }
  | { status: "rate_limited" }
  | { status: "error"; message: string };

export default function CitationNetwork({ title }: Props) {
  const [state, setState] = useState<NetworkState>({ status: "idle" });
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    if (hasLoaded) return;
    setHasLoaded(true);
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/citations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await res.json();
      if (res.status === 404) {
        setState({ status: "not_found", searchedTitle: json.title ?? title });
      } else if (res.status === 429) {
        setState({ status: "rate_limited" });
      } else if (!res.ok) {
        setState({ status: "error", message: json.error ?? "Unknown error" });
      } else {
        setState({ status: "success", data: json });
      }
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [title, hasLoaded]);

  // Auto-load when component mounts (tab becomes active)
  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="flex items-center justify-center h-96 text-slate-500 text-sm">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Looking up citation network via Semantic Scholar…</p>
        </div>
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold mb-2">Paper not found on Semantic Scholar</p>
        <p className="text-amber-700">
          The title extracted from the PDF was:{" "}
          <span className="font-mono bg-amber-100 px-1 rounded">
            {state.searchedTitle}
          </span>
        </p>
        <p className="mt-3 text-amber-600">
          Try searching manually at{" "}
          <a
            href={`https://www.semanticscholar.org/search?q=${encodeURIComponent(state.searchedTitle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Semantic Scholar
          </a>
          .
        </p>
      </div>
    );
  }

  if (state.status === "rate_limited") {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-semibold mb-2">Rate limit reached</p>
        <p>Semantic Scholar rate-limited this request. Please wait ~60 seconds and reload the tab.</p>
        <button
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg font-medium transition-colors"
          onClick={() => { setHasLoaded(false); setState({ status: "idle" }); }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-semibold mb-2">Error loading citation network</p>
        <p className="font-mono text-xs">{state.message}</p>
      </div>
    );
  }

  // Success
  const { nodes, edges } = computeLayout(state.data);
  const refCount = state.data.references.length;
  const citeCount = state.data.citedBy.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-6 px-4 py-3 border-b bg-slate-50 text-sm text-slate-600">
        <span>
          <strong className="text-slate-800">{refCount}</strong> references
        </span>
        <span>
          <strong className="text-slate-800">{citeCount}</strong> citing papers
        </span>
        <span className="text-slate-400 text-xs">Click any node to open the paper</span>
      </div>
      <div style={{ height: "calc(100vh - 260px)", position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background color="#e2e8f0" gap={24} />
          <Controls />
        </ReactFlow>
        <Legend />
      </div>
    </div>
  );
}
