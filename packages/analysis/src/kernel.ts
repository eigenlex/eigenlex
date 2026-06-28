import type { DefinitionGraph } from "@eigenlex/core";
import { asCompiled } from "./compile";
import { sccIndices } from "./scc";

export interface Kernel {
  /**
   * The sink components of the SCC condensation: groups of words whose
   * definitions reference *only* words within the same group. You cannot define
   * your way out of them — the irreducible bottom of the dictionary (the
   * axiomatic / circular horn of the Münchhausen trilemma). A singleton here is
   * a word defined using no other headword; a larger one is a cluster of words
   * that, in the end, only define each other.
   */
  components: string[][];
  /** Every kernel word, flattened and sorted. */
  words: string[];
}

export function kernel(graph: DefinitionGraph): Kernel {
  const g = asCompiled(graph);
  const comps = sccIndices(g);

  const componentOf = new Int32Array(g.out.length);
  for (let c = 0; c < comps.length; c++) {
    for (const v of comps[c]) componentOf[v] = c;
  }

  // A component is a sink iff none of its edges leave it.
  const leaves = new Uint8Array(comps.length);
  for (let v = 0; v < g.out.length; v++) {
    const cv = componentOf[v];
    for (const w of g.out[v]) {
      if (componentOf[w] !== cv) {
        leaves[cv] = 1;
        break;
      }
    }
  }

  const components: string[][] = [];
  for (let c = 0; c < comps.length; c++) {
    if (leaves[c] === 0) components.push(comps[c].map((i) => g.nodes[i]).sort());
  }
  const words = components.flat().sort();
  return { components, words };
}
