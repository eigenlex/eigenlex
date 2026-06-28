import type { DefinitionGraph } from "@eigenlex/core";
import { asCompiled, type CompiledGraph } from "./compile";

/**
 * Strongly connected components via an iterative Tarjan (iterative so a 100k-node
 * graph can't overflow the call stack). Returns component index-lists.
 */
export function sccIndices(g: CompiledGraph): number[][] {
  const n = g.out.length;
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const tarjanStack: number[] = [];
  const components: number[][] = [];
  let counter = 0;

  // Explicit DFS: each frame tracks a node and how far through its children we are.
  const work: Array<{ v: number; next: number }> = [];

  for (let s = 0; s < n; s++) {
    if (index[s] !== -1) continue;
    work.push({ v: s, next: 0 });

    while (work.length > 0) {
      const frame = work[work.length - 1];
      const v = frame.v;

      if (frame.next === 0) {
        index[v] = counter;
        low[v] = counter;
        counter++;
        tarjanStack.push(v);
        onStack[v] = 1;
      }

      const children = g.out[v];
      if (frame.next < children.length) {
        const w = children[frame.next];
        frame.next++;
        if (index[w] === -1) {
          work.push({ v: w, next: 0 });
        } else if (onStack[w] === 1 && index[w] < low[v]) {
          low[v] = index[w];
        }
        continue;
      }

      // All children done: v is an SCC root iff its low-link is itself.
      if (low[v] === index[v]) {
        const component: number[] = [];
        for (;;) {
          const w = tarjanStack.pop() as number;
          onStack[w] = 0;
          component.push(w);
          if (w === v) break;
        }
        components.push(component);
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1].v;
        if (low[v] < low[parent]) low[parent] = low[v];
      }
    }
  }
  return components;
}

/** Strongly connected components as word-lists. A component of size > 1 (or a
 * self-loop) is a set of mutually-defining words — a circular definition. */
export function stronglyConnectedComponents(
  graph: DefinitionGraph | CompiledGraph,
): string[][] {
  const g = asCompiled(graph);
  return sccIndices(g).map((component) => component.map((i) => g.nodes[i]));
}

/** The largest strongly connected component — the dictionary's mutually-defined
 * "core". */
export function largestComponent(graph: DefinitionGraph | CompiledGraph): string[] {
  const g = asCompiled(graph);
  let best: number[] = [];
  for (const component of sccIndices(g)) {
    if (component.length > best.length) best = component;
  }
  return best.map((i) => g.nodes[i]);
}
