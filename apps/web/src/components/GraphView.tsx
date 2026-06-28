"use client";

import { useEffect, useRef } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import type { EgoGraph, EgoKind } from "@/lib/types";

const COLOR: Record<EgoKind, string> = {
  focus: "#f5c542",
  defines: "#4f9dff",
  usedBy: "#56c271",
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

    const graph = new Graph();
    graph.addNode(ego.focus, { x: 0, y: 0, size: 16, label: ego.focus, color: COLOR.focus });

    // Words this one is defined from fan out to the right; words that use it, left.
    const place = (kind: Exclude<EgoKind, "focus">, side: 1 | -1) => {
      const list = ego.nodes.filter((n) => n.kind === kind);
      list.forEach((node, i) => {
        const t = list.length <= 1 ? 0.5 : i / (list.length - 1);
        const angle = (t - 0.5) * Math.PI * 0.9;
        if (!graph.hasNode(node.id)) {
          graph.addNode(node.id, {
            x: side * (1 + Math.cos(angle)),
            y: Math.sin(angle) * 1.7,
            size: 9,
            label: node.id,
            color: COLOR[kind],
          });
        }
      });
    };
    place("defines", 1);
    place("usedBy", -1);

    for (const edge of ego.edges) {
      if (
        graph.hasNode(edge.source) &&
        graph.hasNode(edge.target) &&
        !graph.hasEdge(edge.source, edge.target)
      ) {
        graph.addDirectedEdge(edge.source, edge.target, { size: 1.4, color: "#39404e" });
      }
    }

    const renderer = new Sigma(graph, el, {
      renderEdgeLabels: false,
      labelRenderedSizeThreshold: 0,
      labelColor: { color: "#cdd3df" },
      labelFont: "ui-sans-serif, system-ui, sans-serif",
    });
    renderer.on("clickNode", ({ node }) => {
      if (node !== ego.focus) onSelect(node);
    });

    return () => renderer.kill();
  }, [ego, onSelect]);

  return <div ref={containerRef} className="graph" />;
}
