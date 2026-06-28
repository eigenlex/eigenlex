import "server-only";
import { readFileSync } from "node:fs";
import { buildDefinitionGraph, type DefinitionGraph } from "@eigenlex/core";
import { websterAdapter, type WebsterSource } from "@eigenlex/adapters/webster";
import {
  compile,
  kernel,
  pageRank,
  shortestPath,
  stronglyConnectedComponents,
  type CompiledGraph,
} from "@eigenlex/analysis";
import type { EgoGraph, EgoNode, TopWord, WordInfo } from "@/lib/types";
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
  ranked: TopWord[];
}

/** The bundled sample, or the full Webster file if EIGENLEX_WEBSTER points at one. */
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

  const senses = new Map<string, string[]>(Object.entries(dict));
  return { graph, compiled, senses, defines, usedBy, pr, rankOf, kernelSet, componentSize, ranked };
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
  };
}

export function getEgo(word: string, max = 12): EgoGraph | null {
  if (!model.defines.has(word)) return null;
  const defines = (model.defines.get(word) ?? []).slice().sort(byRank).slice(0, max);
  const usedBy = (model.usedBy.get(word) ?? []).slice().sort(byRank).slice(0, max);

  const nodes = new Map<string, EgoNode>();
  nodes.set(word, { id: word, kind: "focus", score: model.pr[word] ?? 0 });
  const edges: EgoGraph["edges"] = [];
  for (const d of defines) {
    if (!nodes.has(d)) nodes.set(d, { id: d, kind: "defines", score: model.pr[d] ?? 0 });
    edges.push({ source: word, target: d });
  }
  for (const u of usedBy) {
    if (!nodes.has(u)) nodes.set(u, { id: u, kind: "usedBy", score: model.pr[u] ?? 0 });
    edges.push({ source: u, target: word });
  }
  return { focus: word, nodes: [...nodes.values()], edges };
}

export function getPath(from: string, to: string): string[] | null {
  return shortestPath(model.compiled, from, to);
}

export function getTop(k: number): TopWord[] {
  return model.ranked.slice(0, Math.max(0, k));
}
