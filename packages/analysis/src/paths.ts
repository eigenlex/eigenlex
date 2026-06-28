import type { DefinitionGraph } from "@eigenlex/core";
import { asCompiled, type CompiledGraph } from "./compile";

/**
 * Shortest definitional path from `from` to `to`, following edges "is defined
 * using". Returns the word sequence (inclusive of both ends), or null if `to`
 * is unreachable or either word is absent. Breadth-first, so the path is of
 * minimum length.
 */
export function shortestPath(
  graph: DefinitionGraph | CompiledGraph,
  from: string,
  to: string,
): string[] | null {
  const g = asCompiled(graph);
  const source = g.index.get(from);
  const target = g.index.get(to);
  if (source === undefined || target === undefined) return null;
  if (source === target) return [from];

  const prev = new Int32Array(g.out.length).fill(-1);
  const seen = new Uint8Array(g.out.length);
  const queue: number[] = [source];
  seen[source] = 1;

  for (let head = 0; head < queue.length; head++) {
    const v = queue[head];
    for (const w of g.out[v]) {
      if (seen[w]) continue;
      seen[w] = 1;
      prev[w] = v;
      if (w === target) {
        const path: number[] = [];
        for (let cur = target; cur !== -1; cur = prev[cur]) path.push(cur);
        return path.reverse().map((i) => g.nodes[i]);
      }
      queue.push(w);
    }
  }
  return null;
}
