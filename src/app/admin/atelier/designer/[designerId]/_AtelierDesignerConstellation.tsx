"use client";

import * as React from "react";

// Local type definitions (Atelier models not in Prisma schema)
type AtelierNodeType =
  | "STYLE"
  | "ROOM_TYPE"
  | "MATERIAL"
  | "VENDOR"
  | "PRODUCT_CATEGORY"
  | "COLOR_CLUSTER"
  | "BEHAVIOR";

type AtelierNode = {
  id: string;
  type: AtelierNodeType;
  label: string;
  weight: number;
};

type AtelierEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
};

type AtelierFingerprint = {
  id: string;
  designerId: string;
};

type FingerprintWithGraph = AtelierFingerprint & {
  nodes: AtelierNode[];
  edges: AtelierEdge[];
};

type Props = {
  fingerprint: FingerprintWithGraph;
};

type GraphNode = AtelierNode & {
  x?: number;
  y?: number;
};

type GraphEdge = AtelierEdge;

const nodeTypeColors: Record<AtelierNodeType, string> = {
  STYLE: "#ffffff",
  ROOM_TYPE: "#d0d0d0",
  MATERIAL: "#c0b39f",
  VENDOR: "#a0b4ff",
  PRODUCT_CATEGORY: "#ffc58f",
  COLOR_CLUSTER: "#f2e5d7",
  BEHAVIOR: "#bbbbbb",
};

export default function AtelierDesignerConstellation({ fingerprint }: Props) {
  const [minWeight, setMinWeight] = React.useState(0.15);

  const filteredNodes = React.useMemo(
    () => fingerprint.nodes.filter((n) => n.weight >= minWeight),
    [fingerprint.nodes, minWeight],
  );

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = React.useMemo(
    () => fingerprint.edges.filter((e) => filteredNodeIds.has(e.sourceNodeId) && filteredNodeIds.has(e.targetNodeId)),
    [fingerprint.edges, filteredNodeIds],
  );

  // Simple radial layout: center is implied designer; nodes positioned by type
  const layoutNodes: GraphNode[] = React.useMemo(() => {
    if (!filteredNodes.length) return [];

    const byType: Record<AtelierNodeType, GraphNode[]> = {
      STYLE: [],
      ROOM_TYPE: [],
      MATERIAL: [],
      VENDOR: [],
      PRODUCT_CATEGORY: [],
      COLOR_CLUSTER: [],
      BEHAVIOR: [],
    };

    filteredNodes.forEach((n) => {
      (byType[n.nodeType] as GraphNode[]).push({ ...n });
    });

    const centerX = 400;
    const centerY = 260;
    const radiusByType: Record<AtelierNodeType, number> = {
      STYLE: 120,
      ROOM_TYPE: 180,
      MATERIAL: 220,
      VENDOR: 260,
      PRODUCT_CATEGORY: 300,
      COLOR_CLUSTER: 340,
      BEHAVIOR: 380,
    };

    const result: GraphNode[] = [];

    (Object.keys(byType) as AtelierNodeType[]).forEach((type) => {
      const bucket = byType[type];
      if (!bucket.length) return;
      const radius = radiusByType[type];
      const step = (2 * Math.PI) / bucket.length;

      bucket.forEach((node, index) => {
        const angle = index * step;
        const jitter = (1 - node.weight) * 15;
        const x = centerX + (radius + jitter) * Math.cos(angle);
        const y = centerY + (radius + jitter) * Math.sin(angle);

        result.push({
          ...node,
          x,
          y,
        });
      });
    });

    return result;
  }, [filteredNodes]);

  const nodeMap = React.useMemo(() => {
    const map = new Map<string, GraphNode>();
    layoutNodes.forEach((n) => {
      if (!n.x || !n.y) return;
      map.set(n.id, n);
    });
    return map;
  }, [layoutNodes]);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="rounded-xl border bg-background/40 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium">Constellation</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Min node weight</span>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.05}
              value={minWeight}
              onChange={(e) => setMinWeight(parseFloat(e.target.value))}
            />
            <span>{minWeight.toFixed(2)}</span>
          </div>
        </div>

        <div className="relative h-[520px] w-full rounded-lg bg-gradient-to-b from-background to-muted/40 overflow-hidden border border-border/40">
          <svg viewBox="0 0 800 520" className="h-full w-full">
            {/* Optional subtle background grid */}
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="800" height="520" fill="url(#grid)" />

            {/* Edges */}
            {filteredEdges.map((edge) => {
              const source = nodeMap.get(edge.sourceNodeId);
              const target = nodeMap.get(edge.targetNodeId);
              if (!source || !target || source.id === target.id) return null;

              const strokeWidth = 0.5 + edge.weight * 3;
              const opacity = 0.1 + edge.weight * 0.6;

              return (
                <line
                  key={edge.id}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                />
              );
            })}

            {/* Center placeholder for designer (not a node; just a visual anchor) */}
            <g>
              <circle cx={400} cy={260} r={26} fill="rgba(15,15,15,0.9)" stroke="rgba(255,255,255,0.18)" />
              <text
                x={400}
                y={260}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fill="rgba(255,255,255,0.8)"
              >
                Designer
              </text>
            </g>

            {/* Nodes */}
            {layoutNodes.map((node) => {
              const color = nodeTypeColors[node.nodeType] ?? "#ffffff";
              const radius = 4 + node.weight * 10;
              const opacity = 0.2 + node.weight * 0.7;

              return (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill={color}
                    fillOpacity={opacity}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={node.x}
                    y={(node.y ?? 0) - radius - 2}
                    textAnchor="middle"
                    fontSize="8"
                    fill="rgba(255,255,255,0.7)"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Side panel with top nodes */}
      <div className="rounded-xl border bg-background/40 backdrop-blur-sm p-4 space-y-4">
        <h2 className="text-sm font-medium">Top Signals</h2>

        <AtelierNodeList
          title="Styles"
          nodes={filteredNodes.filter((n) => n.nodeType === "STYLE")}
        />
        <AtelierNodeList
          title="Room Types"
          nodes={filteredNodes.filter((n) => n.nodeType === "ROOM_TYPE")}
        />
        <AtelierNodeList
          title="Vendors"
          nodes={filteredNodes.filter((n) => n.nodeType === "VENDOR")}
        />
        <AtelierNodeList
          title="Materials"
          nodes={filteredNodes.filter((n) => n.nodeType === "MATERIAL")}
        />
        <AtelierNodeList
          title="Product Categories"
          nodes={filteredNodes.filter((n) => n.nodeType === "PRODUCT_CATEGORY")}
        />
      </div>
    </div>
  );
}

function AtelierNodeList({ title, nodes }: { title: string; nodes: AtelierNode[] }) {
  if (!nodes.length) return null;

  const sorted = [...nodes].sort((a, b) => b.weight - a.weight).slice(0, 6);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1">
        {sorted.map((node) => (
          <div
            key={node.id}
            className="flex items-center justify-between rounded-md border bg-background/60 px-2 py-1.5"
          >
            <span className="text-xs">{node.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {(node.weight * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}




