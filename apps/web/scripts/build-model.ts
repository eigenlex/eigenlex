// Precompute the query-ready model from a full Webster 1913 source and write it
// as JSON, so the deployed app loads a finished model instead of running the
// graph pipeline (PageRank, SCCs, stratification) on a cold start.
//
// Usage:
//   tsx scripts/build-model.ts [source.json] [out.json]
//
// Defaults: source data/webster-full.json (or $EIGENLEX_WEBSTER), out
// data/webster-model.json (or $EIGENLEX_MODEL). Get the GCIDE-derived source
// from github.com/matthewreagan/WebstersEnglishDictionary.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { WebsterSource } from "@eigenlex/adapters/webster";
import { computeModelData } from "../src/lib/model";

const here = dirname(fileURLToPath(import.meta.url));
const srcPath =
  process.argv[2] ?? process.env.EIGENLEX_WEBSTER ?? resolve(here, "../data/webster-full.json");
const outPath =
  process.argv[3] ?? process.env.EIGENLEX_MODEL ?? resolve(here, "../data/webster-model.json");

const source = JSON.parse(readFileSync(srcPath, "utf8")) as WebsterSource;
const data = computeModelData(source, true);
writeFileSync(outPath, JSON.stringify(data));

const bytes = Buffer.byteLength(JSON.stringify(data));
console.log(
  `wrote ${outPath} — ${Object.keys(data.graph.edges).length.toLocaleString()} nodes, ` +
    `${data.layerCount} layers, ${(bytes / 1e6).toFixed(1)} MB`,
);
