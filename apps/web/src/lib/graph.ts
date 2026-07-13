import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { shortestPath } from "@eigenlex/analysis";
import type { WebsterSource } from "@eigenlex/adapters/webster";
import { assembleModel, computeModelData, type Model, type ModelData } from "@/lib/model";
import type { EgoGraph, EgoNode, Layer, LayerSummary, TopWord, WordInfo } from "@/lib/types";
import sampleData from "../../data/webster-sample.json";

/**
 * The model backing every query, in order of preference:
 *
 *  1. a precomputed model JSON — `EIGENLEX_MODEL`, else `data/webster-model.json`.
 *     Built at deploy time (see scripts/build-model.ts) so a cold start loads a
 *     ready model instead of running the graph pipeline. This is how production
 *     serves the full dictionary without a multi-second first request.
 *  2. a full Webster source — `EIGENLEX_WEBSTER` — built on first request. The
 *     dev workflow for the whole dictionary.
 *  3. the bundled 10k sample.
 *
 * `dropObsolete` needs full definitions, so it applies only to the full source:
 * the sample is already obsolete-trimmed, and its trimmed definitions would trip
 * the wholly-obsolete check if re-scanned here.
 */
function loadModel(): Model {
  const modelPath = process.env.EIGENLEX_MODEL ?? join(process.cwd(), "data/webster-model.json");
  if (existsSync(modelPath)) {
    return assembleModel(JSON.parse(readFileSync(modelPath, "utf8")) as ModelData);
  }
  const sourcePath = process.env.EIGENLEX_WEBSTER;
  if (sourcePath) {
    return assembleModel(
      computeModelData(JSON.parse(readFileSync(sourcePath, "utf8")) as WebsterSource, true),
    );
  }
  return assembleModel(computeModelData(sampleData as WebsterSource, false));
}

// Cache across dev hot-reloads (one build per server process).
const cache = globalThis as unknown as { __eigenlexModel?: Model };
const model: Model = cache.__eigenlexModel ?? (cache.__eigenlexModel = loadModel());

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

/** Headwords starting with `prefix`, most central (PageRank) first, for typeahead. */
export function getSuggestions(prefix: string, limit = 8): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const out: string[] = [];
  // `ranked` is already PageRank-descending, so the first matches are the most
  // central. Only surface real headwords so a pick always resolves in getWord.
  for (const { word } of model.ranked) {
    if (word.startsWith(p) && model.defines.has(word)) {
      out.push(word);
      if (out.length >= limit) break;
    }
  }
  return out;
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
