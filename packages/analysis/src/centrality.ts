import type { DefinitionGraph } from "@eigenlex/core";
import { asCompiled, type CompiledGraph } from "./compile";

export interface PageRankOptions {
  /** Damping factor. Default 0.85. */
  damping?: number;
  /** Maximum power iterations. Default 100. */
  maxIterations?: number;
  /** Stop when the total change between iterations drops below this. Default 1e-6. */
  tolerance?: number;
}

/**
 * PageRank over the definition graph. An edge w -> v means "v helps define w",
 * so rank flows toward the words others are defined *in terms of*: PageRank
 * surfaces a language's most fundamental words. Returns word -> score (scores
 * sum to ~1).
 */
export function pageRank(
  graph: DefinitionGraph | CompiledGraph,
  options: PageRankOptions = {},
): Record<string, number> {
  const g = asCompiled(graph);
  const n = g.out.length;
  const result: Record<string, number> = Object.create(null);
  if (n === 0) return result;

  const damping = options.damping ?? 0.85;
  const maxIterations = options.maxIterations ?? 100;
  const tolerance = options.tolerance ?? 1e-6;

  let rank = new Float64Array(n).fill(1 / n);
  let next = new Float64Array(n);
  const outDegree = new Int32Array(n);
  for (let i = 0; i < n; i++) outDegree[i] = g.out[i].length;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Mass stranded on dangling nodes (no out-edges) is spread over everyone.
    let dangling = 0;
    for (let i = 0; i < n; i++) if (outDegree[i] === 0) dangling += rank[i];
    const base = (1 - damping) / n + (damping * dangling) / n;
    next.fill(base);

    for (let i = 0; i < n; i++) {
      const degree = outDegree[i];
      if (degree === 0) continue;
      const share = (damping * rank[i]) / degree;
      const row = g.out[i];
      for (let k = 0; k < row.length; k++) next[row[k]] += share;
    }

    let delta = 0;
    for (let i = 0; i < n; i++) delta += Math.abs(next[i] - rank[i]);
    const swap = rank;
    rank = next;
    next = swap;
    if (delta < tolerance) break;
  }

  for (let i = 0; i < n; i++) result[g.nodes[i]] = rank[i];
  return result;
}

/** The k highest-PageRank words, descending. */
export function topByPageRank(
  graph: DefinitionGraph | CompiledGraph,
  k: number,
  options?: PageRankOptions,
): Array<{ word: string; score: number }> {
  const scores = pageRank(graph, options);
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, k))
    .map(([word, score]) => ({ word, score }));
}
