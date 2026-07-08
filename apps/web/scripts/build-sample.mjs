// Regenerate the bundled demo dictionary from a full Webster 1913 source.
//
// Picks the N most central headwords by PageRank over the whole dictionary —
// the dense, mutually-defining core that makes both the graph and the layers
// view interesting — and trims each definition to its first sentence or two so
// the file stays light enough to bundle and read.
//
// Usage:
//   node scripts/build-sample.mjs <full-webster.json> [count] [out.json]
//
// The full GCIDE-derived Webster 1913 JSON (lowercase headword -> definition
// blob) is at github.com/matthewreagan/WebstersEnglishDictionary.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildDefinitionGraph } from "@eigenlex/core";
import { isObsoleteSense, splitWebsterSenses, websterAdapter } from "@eigenlex/adapters/webster";
import { compile, pageRank } from "@eigenlex/analysis";

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = process.argv[2] ?? process.env.EIGENLEX_WEBSTER;
const count = Number(process.argv[3] ?? 10000);
const outPath = process.argv[4] ?? resolve(here, "../data/webster-sample.json");

if (!srcPath) {
  console.error("usage: node scripts/build-sample.mjs <full-webster.json> [count] [out.json]");
  process.exit(1);
}

/** Keep whole sentences up to ~`target` chars; never cut a word mid-stream. */
function trim(def, target = 500) {
  if (!def || def.length <= target) return def;
  const head = def.slice(0, target);
  const stop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("; "));
  return stop > target * 0.4 ? def.slice(0, stop + 1) : head;
}

/** A word whose every (cleaned) sense is obsolete — see websterAdapter's dropObsolete. */
function isObsoleteWord(def) {
  const senses = splitWebsterSenses(def ?? "");
  return senses.length > 0 && senses.every(isObsoleteSense);
}

const source = JSON.parse(readFileSync(srcPath, "utf8"));
// Rank over the whole graph so the surviving words keep their familiar centrality,
// then drop obsolete words during selection (on full defs) and backfill from the
// next-most-central real words. Dropping them pre-ranking instead would reshuffle
// the cutoff and evict unrelated words like "jump" or "laboratory".
const graph = buildDefinitionGraph(websterAdapter(source));
const pr = pageRank(compile(graph));

const top = Object.entries(pr)
  .sort((a, b) => b[1] - a[1])
  .map(([canonical]) => graph.labels[canonical]) // back to a source headword
  .filter((word) => word && source[word] !== undefined && !isObsoleteWord(source[word]))
  .slice(0, count);

const sample = {};
for (const word of top) sample[word] = trim(source[word]);

writeFileSync(outPath, JSON.stringify(sample) + "\n");
console.log(`wrote ${Object.keys(sample).length} entries to ${outPath}`);
