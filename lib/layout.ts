import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";
import type { CitationNetworkResponse, PaperNode, PaperNodeData } from "@/types";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 90;
const COLUMN_GAP = 400;

function layoutCluster(
  papers: PaperNode[],
  xCenter: number
): { id: string; x: number; y: number }[] {
  if (papers.length === 0) return [];

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 30, nodesep: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  papers.forEach((p) => {
    g.setNode(p.paperId, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  dagre.layout(g);

  return papers.map((p) => {
    const pos = g.node(p.paperId);
    return {
      id: p.paperId,
      x: xCenter - NODE_WIDTH / 2 + pos.x - NODE_WIDTH / 2,
      y: pos.y,
    };
  });
}

export function computeLayout(data: CitationNetworkResponse): {
  nodes: Node<PaperNodeData>[];
  edges: Edge[];
} {
  const refX = 0;
  const centerX = COLUMN_GAP;
  const citedByX = COLUMN_GAP * 2;

  const refPositions = layoutCluster(data.references, refX);
  const citePositions = layoutCluster(data.citedBy, citedByX);

  // Vertical center for center node: median y of both clusters
  const allYs = [
    ...refPositions.map((p) => p.y),
    ...citePositions.map((p) => p.y),
  ];
  const centerY =
    allYs.length > 0
      ? allYs.reduce((a, b) => a + b, 0) / allYs.length
      : 0;

  const nodes: Node<PaperNodeData>[] = [];
  const edges: Edge[] = [];

  // Center node
  nodes.push({
    id: "center",
    type: "paperNode",
    position: { x: centerX, y: centerY },
    data: {
      label: data.paperTitle,
      year: data.paperYear,
      authors: data.paperAuthors,
      url: `https://www.semanticscholar.org/paper/${data.paperId}`,
      nodeType: "center",
    },
  });

  // Reference nodes (left column)
  for (const pos of refPositions) {
    const paper = data.references.find((p) => p.paperId === pos.id)!;
    nodes.push({
      id: `ref-${paper.paperId}`,
      type: "paperNode",
      position: { x: pos.x, y: pos.y },
      data: {
        label: paper.title,
        year: paper.year,
        authors: paper.authors,
        url: paper.url,
        nodeType: "reference",
      },
    });
    edges.push({
      id: `e-ref-${paper.paperId}`,
      source: `ref-${paper.paperId}`,
      target: "center",
      animated: false,
      style: { stroke: "#94a3b8", strokeWidth: 1.5 },
    });
  }

  // CitedBy nodes (right column)
  for (const pos of citePositions) {
    const paper = data.citedBy.find((p) => p.paperId === pos.id)!;
    nodes.push({
      id: `cite-${paper.paperId}`,
      type: "paperNode",
      position: { x: pos.x, y: pos.y },
      data: {
        label: paper.title,
        year: paper.year,
        authors: paper.authors,
        url: paper.url,
        nodeType: "citedBy",
      },
    });
    edges.push({
      id: `e-cite-${paper.paperId}`,
      source: "center",
      target: `cite-${paper.paperId}`,
      animated: false,
      style: { stroke: "#6366f1", strokeWidth: 1.5 },
    });
  }

  return { nodes, edges };
}
