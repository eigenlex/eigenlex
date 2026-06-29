import type { DefinitionGraph } from "@eigenlex/core";
import { asCompiled, type CompiledGraph } from "./compile";
import { sccIndices } from "./scc";

/**
 * The dictionary collapsed onto its acyclic skeleton. Each strongly connected
 * component — a single word, or a cluster of mutually-defining words — becomes
 * one node placed at a `depth`: the longest definitional chain from it down to a
 * primitive. Depth 0 is the irreducible bottom (the kernel and the circular
 * cores); higher depths are progressively more derived ("advanced") words.
 *
 * Pure integer arrays, so it caches and crosses the wire like the graph itself.
 */
export interface Stratified {
  /** node index -> scc id */
  sccOf: Int32Array;
  /** scc id -> node indices: the words that mutually define each other */
  members: number[][];
  /** scc id -> stack layer; 0 = most basic, max = most advanced */
  depth: Int32Array;
  /** scc ids ordered bottom (most basic) -> top (most advanced) */
  order: Int32Array;
}

export function stratify(graph: DefinitionGraph | CompiledGraph): Stratified {
  const g = asCompiled(graph);
  const members = sccIndices(g);
  const sccCount = members.length;

  const sccOf = new Int32Array(g.out.length);
  for (let c = 0; c < sccCount; c++) {
    for (const v of members[c]) sccOf[v] = c;
  }

  // Longest "uses" path from each component down to a primitive. sccIndices
  // returns components in reverse topological order (every component a word
  // references is emitted before it), so one forward pass suffices: by the time
  // we reach c, each successor's depth is already final.
  const depth = new Int32Array(sccCount);
  for (let c = 0; c < sccCount; c++) {
    let d = 0;
    for (const v of members[c]) {
      for (const w of g.out[v]) {
        const s = sccOf[w];
        if (s !== c && depth[s] + 1 > d) d = depth[s] + 1;
      }
    }
    depth[c] = d;
  }

  const order = Int32Array.from({ length: sccCount }, (_, c) => c).sort(
    (a, b) => depth[a] - depth[b],
  );

  return { sccOf, members, depth, order };
}

/**
 * The dictionary as a line of word-sets, most basic to most advanced. Each set
 * holds every word at one definitional depth: equally advanced, though not
 * necessarily related (a layer is the union of all SCCs at that depth, so two
 * words can share a layer without defining each other). `layers[0]` is exactly
 * the kernel.
 */
export function layers(graph: DefinitionGraph | CompiledGraph): string[][] {
  const g = asCompiled(graph);
  const { members, depth } = stratify(g);
  if (members.length === 0) return [];

  let maxDepth = 0;
  for (let c = 0; c < depth.length; c++) {
    if (depth[c] > maxDepth) maxDepth = depth[c];
  }

  const result: string[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (let c = 0; c < members.length; c++) {
    const layer = result[depth[c]];
    for (const v of members[c]) layer.push(g.nodes[v]);
  }
  for (const layer of result) layer.sort();
  return result;
}
