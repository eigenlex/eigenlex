import { describe, expect, it } from "vitest";
import type { DefinitionGraph } from "@eigenlex/core";
import {
  asCompiled,
  compile,
  kernel,
  largestComponent,
  layers,
  pageRank,
  shortestPath,
  stratify,
  stronglyConnectedComponents,
  topByPageRank,
} from "./index";

/** A minimal DefinitionGraph from an adjacency map (keys are the nodes). */
function graphOf(edges: Record<string, string[]>): DefinitionGraph {
  return {
    language: "test",
    edges,
    labels: {},
    stats: { nodes: Object.keys(edges).length, edges: 0, sinks: 0, sources: 0 },
  };
}

const empty = graphOf({});

describe("compile", () => {
  it("indexes nodes and builds forward and reverse adjacency", () => {
    const g = compile(graphOf({ a: ["b"], b: [], c: ["b"] }));
    expect(g.nodes).toEqual(["a", "b", "c"]);
    expect(g.index.get("b")).toBe(1);
    expect(g.out[g.index.get("a")!]).toEqual([1]);
    expect(g.in[g.index.get("b")!].sort()).toEqual([0, 2]); // a and c point at b
  });

  it("drops edges to targets that are not nodes", () => {
    const g = compile(graphOf({ a: ["ghost"] }));
    expect(g.out[0]).toEqual([]);
  });

  it("asCompiled passes an already-compiled graph through untouched", () => {
    const c = compile(graphOf({ a: [] }));
    expect(asCompiled(c)).toBe(c);
    expect(asCompiled(graphOf({ a: [] }))).not.toBe(c); // compiles fresh
  });
});

describe("pageRank options", () => {
  const g = graphOf({ a: ["b"], b: [] });

  it("distributes dangling mass and sums to ~1", () => {
    const pr = pageRank(g);
    expect(Object.values(pr).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 6);
    expect(pr["b"]).toBeGreaterThan(pr["a"]); // a points to b
  });

  it("with damping 0 every score is uniform 1/n", () => {
    const pr = pageRank(graphOf({ a: ["b"], b: ["a"], c: [] }), { damping: 0 });
    for (const v of Object.values(pr)) expect(v).toBeCloseTo(1 / 3, 10);
  });

  it("respects a capped iteration count without throwing", () => {
    const pr = pageRank(g, { maxIterations: 1, tolerance: 0 });
    expect(Object.values(pr).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 6);
  });

  it("returns an empty map for an empty graph", () => {
    expect(pageRank(empty)).toEqual({});
  });
});

describe("topByPageRank bounds", () => {
  const g = graphOf({ a: ["b"], b: ["c"], c: [] });

  it("clamps k to the node count", () => {
    expect(topByPageRank(g, 99)).toHaveLength(3);
  });

  it("returns nothing for k <= 0", () => {
    expect(topByPageRank(g, 0)).toEqual([]);
    expect(topByPageRank(g, -5)).toEqual([]);
  });
});

describe("empty graph is handled everywhere", () => {
  it("scc / kernel / strata all degrade to empty", () => {
    expect(stronglyConnectedComponents(empty)).toEqual([]);
    expect(largestComponent(empty)).toEqual([]);
    expect(kernel(empty)).toEqual({ components: [], words: [] });
    expect(layers(empty)).toEqual([]);
    const s = stratify(empty);
    expect(s.members).toEqual([]);
    expect(s.order).toHaveLength(0);
    expect(s.sccOf).toHaveLength(0);
  });

  it("shortestPath returns null when a word is absent", () => {
    expect(shortestPath(empty, "a", "b")).toBeNull();
    expect(shortestPath(graphOf({ a: [] }), "a", "missing")).toBeNull();
  });
});
