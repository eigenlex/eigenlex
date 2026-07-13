import { buildDefinitionGraph, type DefinitionGraph } from "@eigenlex/core";
import { websterAdapter, type WebsterSource } from "@eigenlex/adapters/webster";
import {
  compile,
  kernel,
  pageRank,
  stratify,
  stronglyConnectedComponents,
  type CompiledGraph,
} from "@eigenlex/analysis";
import type { TopWord } from "./types";

/** The in-memory model every query runs against, built once per server process. */
export interface Model {
  graph: DefinitionGraph;
  compiled: CompiledGraph;
  senses: Map<string, string[]>;
  defines: Map<string, string[]>;
  usedBy: Map<string, string[]>;
  pr: Record<string, number>;
  rankOf: Map<string, number>;
  kernelSet: Set<string>;
  componentSize: Map<string, number>;
  depthOf: Map<string, number>;
  layerCount: number;
  /** depth -> words at that depth, most central first. */
  layerWords: string[][];
  ranked: TopWord[];
}

/**
 * The serializable core of a {@link Model}: just the pieces that are expensive to
 * derive (PageRank, SCCs, stratification) plus the raw graph and senses. Plain
 * JSON — no Maps or Sets — so it can be precomputed at build time, written to
 * disk, and re-hydrated by {@link assembleModel} without recomputing anything.
 */
export interface ModelData {
  graph: DefinitionGraph;
  /** headword -> its sense texts (the whole dictionary). */
  senses: Record<string, string[]>;
  pr: Record<string, number>;
  /** The kernel headwords. */
  kernel: string[];
  /** headword -> size of its strongly connected component. */
  componentSize: Record<string, number>;
  /** headword -> advancement layer (0 = most basic). */
  depth: Record<string, number>;
  layerCount: number;
}

/**
 * Run the whole analysis pipeline over a Webster source. This is the costly
 * step — graph construction, PageRank, SCCs, stratification — so it runs at
 * build time for production (see scripts/build-model.ts) and only at request
 * time in dev. `dropObsolete` needs full definitions; pass it only for an
 * untrimmed source (never the pre-trimmed sample — see `websterAdapter`).
 */
export function computeModelData(source: WebsterSource, dropObsolete: boolean): ModelData {
  const dict = websterAdapter(source, { dropObsolete });
  // Drop dead headwords (archaic spelling stubs like "alledge" that reference
  // nothing and that nothing references) so they don't surface as unconnected
  // depth-0 nodes.
  const graph = buildDefinitionGraph(dict, { dropIsolated: true });
  const compiled = compile(graph);
  const pr = pageRank(compiled);

  const componentSize: Record<string, number> = Object.create(null);
  for (const component of stronglyConnectedComponents(compiled)) {
    for (const word of component) componentSize[word] = component.length;
  }

  // Stratify into advancement layers: depth 0 = most basic (the kernel), higher
  // depths are progressively more derived words.
  const strat = stratify(compiled);
  const depth: Record<string, number> = Object.create(null);
  let maxDepth = 0;
  compiled.nodes.forEach((word, i) => {
    const d = strat.depth[strat.sccOf[i]!]!;
    depth[word] = d;
    if (d > maxDepth) maxDepth = d;
  });
  const layerCount = compiled.nodes.length > 0 ? maxDepth + 1 : 0;

  return { graph, senses: dict, pr, kernel: kernel(graph).words, componentSize, depth, layerCount };
}

/**
 * Re-hydrate a {@link ModelData} into the query-ready {@link Model}: rebuild the
 * Maps/Sets and the derived views (reverse edges, ranks, per-layer word lists,
 * the compiled index) that are cheap to recompute and needn't be serialized.
 */
export function assembleModel(data: ModelData): Model {
  const { graph, pr, layerCount } = data;
  const compiled = compile(graph);

  const ranked: TopWord[] = Object.entries(pr)
    .map(([word, score]) => ({ word, score }))
    .sort((a, b) => b.score - a.score);
  const rankOf = new Map<string, number>();
  ranked.forEach((entry, i) => rankOf.set(entry.word, i + 1));

  const defines = new Map<string, string[]>(Object.entries(graph.edges));
  const usedBy = new Map<string, string[]>();
  for (const [word, targets] of defines) {
    for (const target of targets) {
      const list = usedBy.get(target);
      if (list) list.push(word);
      else usedBy.set(target, [word]);
    }
  }

  const senses = new Map<string, string[]>(Object.entries(data.senses));
  const kernelSet = new Set(data.kernel);
  const componentSize = new Map<string, number>(Object.entries(data.componentSize));
  const depthOf = new Map<string, number>(Object.entries(data.depth));

  // Each layer, words ordered by PageRank so the most central surface first.
  const layerWords: string[][] = Array.from({ length: layerCount }, () => []);
  for (const [word, d] of depthOf) layerWords[d]!.push(word);
  const byRankIn = (a: string, b: string) =>
    (rankOf.get(a) ?? Infinity) - (rankOf.get(b) ?? Infinity);
  for (const words of layerWords) words.sort(byRankIn);

  return {
    graph,
    compiled,
    senses,
    defines,
    usedBy,
    pr,
    rankOf,
    kernelSet,
    componentSize,
    depthOf,
    layerCount,
    layerWords,
    ranked,
  };
}
