import type { DefinitionGraph } from "@eigenlex/core";

/**
 * An index-based view of a {@link DefinitionGraph}: words become integers and
 * the adjacency becomes integer arrays. Every algorithm here runs over this,
 * so build it once and reuse it across calls.
 */
export interface CompiledGraph {
  /** index -> word */
  nodes: string[];
  /** word -> index */
  index: Map<string, number>;
  /** out[i] = indices of words that word i references in its definition */
  out: number[][];
  /** in[i] = indices of words that reference word i in their definition */
  in: number[][];
}

export function compile(graph: DefinitionGraph): CompiledGraph {
  const nodes = Object.keys(graph.edges);
  const index = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) index.set(nodes[i], i);

  const out: number[][] = new Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const targets = graph.edges[nodes[i]] ?? [];
    const row: number[] = [];
    for (const target of targets) {
      const j = index.get(target);
      if (j !== undefined) row.push(j);
    }
    out[i] = row;
  }

  // Reverse adjacency: who references whom. Lets callers ask "what words are
  // used to define this one?" as cheaply as the forward question.
  const incoming: number[][] = new Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) incoming[i] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (const j of out[i]) incoming[j].push(i);
  }

  return { nodes, index, out, in: incoming };
}

/** Accept either a graph or an already-compiled view. */
export function asCompiled(graph: DefinitionGraph | CompiledGraph): CompiledGraph {
  return "out" in graph ? graph : compile(graph);
}
