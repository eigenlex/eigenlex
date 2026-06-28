"use client";

import { useEffect, useRef } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { EdgeArrowProgram } from "sigma/rendering";
import type { EgoGraph, EgoKind, EgoNode } from "@/lib/types";

const COLOR: Record<EgoKind, string> = {
  focus: "#f5c542",
  defines: "#4f9dff",
  usedBy: "#56c271",
  mutual: "#c478ff",
};

// The angle (radians) each group fans toward, and how wide an arc it spans.
const PLACEMENT: Record<Exclude<EgoKind, "focus">, { base: number; spread: number; radius: number }> = {
  defines: { base: 0, spread: 2.2, radius: 3 }, //  east: words this one is built from
  usedBy: { base: Math.PI, spread: 2.2, radius: 3 }, // west: words built from this one
  mutual: { base: -Math.PI / 2, spread: 1.4, radius: 2.2 }, // north: circular pairs
};

export default function GraphView({
  ego,
  onSelect,
}: {
  ego: EgoGraph;
  onSelect: (word: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scores = ego.nodes.map((n) => n.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const sizeOf = (n: EgoNode) => {
      const t = max > min ? (n.score - min) / (max - min) : 0.5;
      const base = 6 + 14 * Math.sqrt(t); // PageRank -> radius
      return n.kind === "focus" ? Math.max(base, 16) : base;
    };

    const graph = new Graph();
    const focus = ego.nodes.find((n) => n.id === ego.focus);
    graph.addNode(ego.focus, {
      x: 0,
      y: 0,
      size: focus ? sizeOf(focus) : 16,
      label: ego.focus,
      color: COLOR.focus,
    });

    (["defines", "usedBy", "mutual"] as const).forEach((kind) => {
      const list = ego.nodes.filter((n) => n.kind === kind);
      const { base, spread, radius } = PLACEMENT[kind];
      list.forEach((node, i) => {
        const t = list.length <= 1 ? 0 : i / (list.length - 1) - 0.5;
        const angle = base + t * spread;
        if (!graph.hasNode(node.id)) {
          graph.addNode(node.id, {
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle),
            size: sizeOf(node),
            label: node.id,
            color: COLOR[kind],
          });
        }
      });
    });

    for (const edge of ego.edges) {
      if (
        graph.hasNode(edge.source) &&
        graph.hasNode(edge.target) &&
        !graph.hasEdge(edge.source, edge.target)
      ) {
        graph.addDirectedEdge(edge.source, edge.target, { size: 1.6 });
      }
    }

    const renderer = new Sigma(graph, el, {
      defaultEdgeType: "arrow",
      edgeProgramClasses: { arrow: EdgeArrowProgram },
      defaultEdgeColor: "#39404e",
      renderEdgeLabels: false,
      labelRenderedSizeThreshold: 0,
      labelColor: { color: "#cdd3df" },
      labelFont: "ui-sans-serif, system-ui, sans-serif",
    });

    // Hover spotlight: emphasize a node and its neighbors, fade the rest.
    let hovered: string | null = null;
    renderer.setSetting("nodeReducer", (node, data) => {
      if (!hovered || node === hovered || graph.areNeighbors(hovered, node)) return data;
      return { ...data, color: "#2b3038", label: "" };
    });
    renderer.setSetting("edgeReducer", (edge, data) => {
      if (!hovered) return data;
      return graph.extremities(edge).includes(hovered)
        ? { ...data, color: "#5b6477" }
        : { ...data, hidden: true };
    });

    renderer.on("enterNode", ({ node }) => {
      hovered = node;
      el.style.cursor = "pointer";
      renderer.refresh();
    });
    renderer.on("leaveNode", () => {
      hovered = null;
      el.style.cursor = "default";
      renderer.refresh();
    });
    renderer.on("clickNode", ({ node }) => {
      if (node !== ego.focus) onSelect(node);
    });

    return () => renderer.kill();
  }, [ego, onSelect]);

  return <div ref={containerRef} className="graph" />;
}
