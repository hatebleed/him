"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { layoutGraph, type GraphEdge, type GraphNode } from "./projection";

export type { GraphEdge, GraphNode };

const TYPE_STYLE: Record<string, { fill: string; stroke: string; glyph: string }> = {
  person: { fill: "hsl(var(--primary) / 0.18)", stroke: "hsl(var(--primary))", glyph: "P" },
  vehicle: { fill: "hsl(var(--info) / 0.18)", stroke: "hsl(var(--info))", glyph: "V" },
  incident: { fill: "hsl(var(--signal-warn) / 0.16)", stroke: "hsl(var(--signal-warn))", glyph: "I" },
  case: { fill: "hsl(var(--accent) / 0.18)", stroke: "hsl(var(--accent))", glyph: "C" },
  location: { fill: "hsl(var(--signal-ok) / 0.16)", stroke: "hsl(var(--signal-ok))", glyph: "L" },
  evidence: { fill: "hsl(var(--signal-hot) / 0.14)", stroke: "hsl(var(--signal-hot))", glyph: "E" },
};

const styleFor = (type: string) => TYPE_STYLE[type] ?? { fill: "hsl(var(--muted) / 0.4)", stroke: "hsl(var(--muted-foreground))", glyph: "?" };

/**
 * Association graph.
 *
 * Nodes are records, edges are real links (participation, vehicle involvement,
 * case membership, recorded relationships). Laid out deterministically and
 * clickable through to the record itself.
 */
export function LinkGraph({
  nodes,
  edges,
  className,
  height = 560,
  onNodeClick,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  className?: string;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
}) {
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 900, height });
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [height]);

  const { nodes: placed, edges: placedEdges } = React.useMemo(
    () => layoutGraph(nodes, edges, size),
    // Layout depends on the graph and the viewport only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges, size.width, size.height],
  );

  const byId = React.useMemo(() => new Map(placed.map((node) => [node.id, node])), [placed]);
  const neighbours = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of placedEdges) {
      const set = map.get(edge.source) ?? new Set<string>();
      set.add(edge.target);
      map.set(edge.source, set);
      const reverse = map.get(edge.target) ?? new Set<string>();
      reverse.add(edge.source);
      map.set(edge.target, reverse);
    }
    return map;
  }, [placedEdges]);

  const focus = hovered ?? selected;
  const related = focus ? neighbours.get(focus) ?? new Set<string>() : null;

  const open = (node: GraphNode) => {
    if (onNodeClick) {
      onNodeClick(node);
      return;
    }
    const href =
      node.type === "person"
        ? `/people/${node.id}`
        : node.type === "vehicle"
          ? `/vehicles/${node.id}`
          : node.type === "incident"
            ? `/incidents/${node.id}`
            : node.type === "case"
              ? `/cases/${node.id}`
              : node.type === "evidence"
                ? `/evidence/${node.id}`
                : null;
    if (href) router.push(href);
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label="Association graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--border))" />
          </marker>
        </defs>

        {placedEdges.map((edge, index) => {
          const a = byId.get(edge.source);
          const b = byId.get(edge.target);
          if (!a || !b) return null;
          const active = !focus || focus === edge.source || focus === edge.target;
          return (
            <line
              key={`${edge.source}-${edge.target}-${edge.relation}-${index}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={active ? "hsl(var(--hud-line) / 0.65)" : "hsl(var(--border))"}
              strokeWidth={active ? 1.4 : 1}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {placed.map((node) => {
          const style = styleFor(node.type);
          const isFocus = focus === node.id;
          const dimmed = Boolean(related && !related.has(node.id) && !isFocus);
          const radius = node.depth === 0 ? 26 : 19;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              className="cursor-pointer"
              opacity={dimmed ? 0.32 : 1}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => {
                setSelected(node.id);
                open(node);
              }}
            >
              <title>{`${node.type}: ${node.label}`}</title>
              {isFocus ? <circle r={radius + 8} fill="none" stroke={style.stroke} strokeWidth={1} strokeDasharray="3 3" opacity={0.8} /> : null}
              <circle r={radius} fill={style.fill} stroke={style.stroke} strokeWidth={node.depth === 0 ? 2 : 1.2} />
              <text textAnchor="middle" y={4} fontSize={node.depth === 0 ? 13 : 11} fontWeight={700} fill={style.stroke}>
                {style.glyph}
              </text>
              <text textAnchor="middle" y={radius + 13} fontSize={10} fill="hsl(var(--foreground))">
                {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Legend for the node types shown in the graph. */
const LEGEND_TYPES = ["person", "vehicle", "incident", "case", "evidence"];

export function LinkGraphLegend({ types = LEGEND_TYPES }: { types?: string[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {types.map((type) => {
        const style = styleFor(type);
        return (
          <li key={type} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full border" style={{ borderColor: style.stroke, background: style.fill }} />
            <span className="capitalize">{type}</span>
          </li>
        );
      })}
    </ul>
  );
}
