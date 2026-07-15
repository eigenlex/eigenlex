// Build the word-bands artifact backing the app: a pure-frequency, lemma-merged
// ranking of English words, plus the frequency- and CEFR-band definitions the UI
// browses by.
//
// One scalable data source — SUBTLEX-US word frequency — with a lemmatization
// list to merge inflections onto their base form (go/goes/going/went -> "go").
// Frequency ordering is the whole signal (it dominates AoA and the definition
// graph for learn-order; we measured it). CEFR bands are frequency-rank
// thresholds calibrated once against CEFR-J (median rank per level: A1≈635,
// A2≈2275, B1≈4692, B2≈8394) and baked in as constants below — so no CEFR list
// is needed at build time, and coverage is the full frequency vocabulary.
//
//   tsx scripts/build-bands.ts [subtlex.csv] [lemma-en.txt] [out.json]
//
// Sources: SUBTLEX-US (Brysbaert & New 2009); lemmatization list
// (github.com/michmech/lemmatization-lists).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const subtlexPath = process.argv[2] ?? resolve(here, "../data/subtlex.csv");
const lemmaPath = process.argv[3] ?? resolve(here, "../data/lemma-en.txt");
const outPath = process.argv[4] ?? resolve(here, "../data/word-bands.json");

interface BandDef {
  key: string;
  label: string;
  /** Inclusive 1-based rank range; `max: null` = open-ended top band. */
  min: number;
  max: number | null;
}

// Frequency view: rank bands, the standard vocabulary-pedagogy "K-bands".
const FREQ_BANDS: BandDef[] = [
  { key: "1", label: "Top 1,000", min: 1, max: 1000 },
  { key: "2", label: "1,001–2,000", min: 1001, max: 2000 },
  { key: "3", label: "2,001–3,000", min: 2001, max: 3000 },
  { key: "4", label: "3,001–5,000", min: 3001, max: 5000 },
  { key: "5", label: "5,001–10,000", min: 5001, max: 10000 },
  { key: "6", label: "10,001+", min: 10001, max: null },
];

// CEFR view: rank thresholds calibrated to CEFR-J medians; C1/C2 extrapolate the
// same frequency trend past CEFR-J's B2 cap, giving full-vocabulary coverage.
const CEFR_BANDS: BandDef[] = [
  { key: "A1", label: "A1 · Beginner", min: 1, max: 1000 },
  { key: "A2", label: "A2 · Elementary", min: 1001, max: 3000 },
  { key: "B1", label: "B1 · Intermediate", min: 3001, max: 6000 },
  { key: "B2", label: "B2 · Upper-intermediate", min: 6001, max: 12000 },
  { key: "C1", label: "C1 · Advanced", min: 12001, max: 25000 },
  { key: "C2", label: "C2 · Proficiency", min: 25001, max: null },
];

const WORD_OK = /^[a-z][a-z'-]*$/;
// Subtitle contraction remnants SUBTLEX lists as standalone "words".
const FRAGMENTS = new Set(["re", "ll", "ve", "em", "im", "n", "st", "nd", "rd", "th"]);
const clean = (w: string | undefined): string | null => {
  if (!w) return null;
  w = w.trim().toLowerCase();
  if (!WORD_OK.test(w) || FRAGMENTS.has(w)) return null;
  if (w.length === 1 && w !== "a" && w !== "i") return null;
  return w;
};

// Lemma map: inflected form -> base lemma (alphabetic lemmas only).
const form2lemma = new Map<string, string>();
for (const line of readFileSync(lemmaPath, "utf8").split(/\r?\n/)) {
  const [lemma, form] = line.replace(/^﻿/, "").split("\t");
  const l = clean(lemma), f = clean(form);
  if (l && f && !form2lemma.has(f)) form2lemma.set(f, l);
}
const lemmaOf = (w: string) => form2lemma.get(w) ?? w;

// Sum frequency per lemma across all its inflections.
const lines = readFileSync(subtlexPath, "utf8").split(/\r?\n/);
const head = lines[0].split(",");
const wCol = head.indexOf("Word"), wfCol = head.indexOf("SUBTLWF");
const freq = new Map<string, number>();
for (let i = 1; i < lines.length; i++) {
  const r = lines[i].split(",");
  const w = clean(r[wCol]); const wf = Number(r[wfCol]);
  if (!w || !(wf > 0)) continue;
  const L = lemmaOf(w);
  freq.set(L, (freq.get(L) ?? 0) + wf);
}

// Frequency order (desc); alphabetical tie-break keeps the artifact deterministic.
const ranked = [...freq.entries()]
  .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  .map(([w]) => w);

writeFileSync(
  outPath,
  JSON.stringify({ ranked, freqBands: FREQ_BANDS, cefrBands: CEFR_BANDS }),
);

// --- Report ---
const rankOf = new Map(ranked.map((w, i) => [w, i + 1]));
const bandCount = (d: BandDef) => (d.max === null ? ranked.length : Math.min(d.max, ranked.length)) - d.min + 1;
console.log(`ranked ${ranked.length.toLocaleString()} lemmas -> ${outPath}`);
console.log("freq bands:", FREQ_BANDS.map((d) => `${d.label}=${bandCount(d).toLocaleString()}`).join("  "));
console.log("CEFR bands:", CEFR_BANDS.map((d) => `${d.key}=${bandCount(d).toLocaleString()}`).join("  "));
console.log("spot-checks (word -> rank):");
for (const w of ["the", "be", "water", "government", "philosophy", "entropy", "photosynthesis"])
  console.log(`  ${w.padEnd(14)} ${(rankOf.get(w) ?? "—").toLocaleString()}`);
