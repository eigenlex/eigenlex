import "server-only";
import { readFileSync } from "node:fs";
import { buildDefinitionGraph, type DefinitionGraph } from "@eigenlex/core";
import { websterAdapter, type WebsterSource } from "@eigenlex/adapters/webster";
import {
  compile,
  kernel,
  pageRank,
  shortestPath,
  stratify,
  stronglyConnectedComponents,
  type CompiledGraph,
} from "@eigenlex/analysis";
import type { EgoGraph, EgoNode, Layer, LayerSummary, TopWord, WordInfo } from "@/lib/types";
import sampleData from "../../data/webster-sample.json";

interface Model {
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
 * The bundled sample (the 10k most central Webster headwords; see
 * scripts/build-sample.mjs), or the full Webster file if EIGENLEX_WEBSTER
 * points at one.
 */
function loadSource(): WebsterSource {
  const path = process.env.EIGENLEX_WEBSTER;
  if (path) return JSON.parse(readFileSync(path, "utf8")) as WebsterSource;
  return sampleData as WebsterSource;
}

function buildModel(): Model {
  const dict = websterAdapter(loadSource());
  const graph = buildDefinitionGraph(dict);
  const compiled = compile(graph);
  const pr = pageRank(compiled);

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

  const kernelSet = new Set(kernel(graph).words);
  const componentSize = new Map<string, number>();
  for (const component of stronglyConnectedComponents(compiled)) {
    for (const word of component) componentSize.set(word, component.length);
  }

  // Stratify into advancement layers: depth 0 = most basic (the kernel), higher
  // depths are progressively more derived words.
  const strat = stratify(compiled);
  const depthOf = new Map<string, number>();
  let maxDepth = 0;
  compiled.nodes.forEach((word, i) => {
    const d = strat.depth[strat.sccOf[i]!]!;
    depthOf.set(word, d);
    if (d > maxDepth) maxDepth = d;
  });
  const layerCount = compiled.nodes.length > 0 ? maxDepth + 1 : 0;

  // Each layer, words ordered by PageRank so the most central surface first.
  const layerWords: string[][] = Array.from({ length: layerCount }, () => []);
  for (const [word, d] of depthOf) layerWords[d]!.push(word);
  const byRankIn = (a: string, b: string) =>
    (rankOf.get(a) ?? Infinity) - (rankOf.get(b) ?? Infinity);
  for (const words of layerWords) words.sort(byRankIn);

  const senses = new Map<string, string[]>(Object.entries(dict));
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

// Cache across dev hot-reloads (one build per server process).
const cache = globalThis as unknown as { __eigenlexModel?: Model };
const model: Model = cache.__eigenlexModel ?? (cache.__eigenlexModel = buildModel());

const byRank = (a: string, b: string) =>
  (model.rankOf.get(a) ?? Infinity) - (model.rankOf.get(b) ?? Infinity);

export function getWord(word: string): WordInfo | null {
  if (!model.defines.has(word)) return null;
  return {
    word,
    senses: model.senses.get(word) ?? [],
    defines: (model.defines.get(word) ?? []).slice().sort(byRank),
    usedBy: (model.usedBy.get(word) ?? []).slice().sort(byRank),
    pageRank: model.pr[word] ?? 0,
    rank: model.rankOf.get(word) ?? 0,
    inKernel: model.kernelSet.has(word),
    componentSize: model.componentSize.get(word) ?? 1,
    depth: model.depthOf.get(word) ?? 0,
    layerCount: model.layerCount,
  };
}

export function getEgo(word: string, max = 12): EgoGraph | null {
  if (!model.defines.has(word)) return null;
  const outAll = model.defines.get(word) ?? [];
  const inAll = model.usedBy.get(word) ?? [];
  const outSet = new Set(outAll);
  const inSet = new Set(inAll);

  // Top-ranked neighbors on each side; their union is what we show. A neighbor
  // in both sets is "mutual" — a circular definition with the focus word.
  const top = (arr: string[]) => arr.slice().sort(byRank).slice(0, max);
  const neighbors = new Set<string>([...top(outAll), ...top(inAll)]);

  const nodes: EgoNode[] = [
    { id: word, kind: "focus", score: model.pr[word] ?? 0, depth: model.depthOf.get(word) ?? 0 },
  ];
  const edges: EgoGraph["edges"] = [];
  for (const n of neighbors) {
    const out = outSet.has(n);
    const inc = inSet.has(n);
    const kind: EgoNode["kind"] = out && inc ? "mutual" : out ? "defines" : "usedBy";
    nodes.push({ id: n, kind, score: model.pr[n] ?? 0, depth: model.depthOf.get(n) ?? 0 });
    if (out) edges.push({ source: word, target: n });
    if (inc) edges.push({ source: n, target: word });
  }
  return { focus: word, nodes, edges };
}

export function getPath(from: string, to: string): string[] | null {
  return shortestPath(model.compiled, from, to);
}

export function getTop(k: number): TopWord[] {
  return model.ranked.slice(0, Math.max(0, k));
}

/** Every word sharing one advancement layer, most central first. */
export function getLayer(depth: number): Layer | null {
  if (!Number.isInteger(depth) || depth < 0 || depth >= model.layerCount) return null;
  return { depth, layerCount: model.layerCount, words: model.layerWords[depth] ?? [] };
}

/** Per-layer word counts — the whole stratification profile in a dozen ints. */
export function getLayerSummary(): LayerSummary {
  return { layerCount: model.layerCount, sizes: model.layerWords.map((w) => w.length) };
}
