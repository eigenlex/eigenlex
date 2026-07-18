// Build the per-language word-bands artifacts backing the app: for each source
// language, a pure-frequency, lemma-merged word ranking plus the frequency- and
// CEFR-band definitions the UI browses by. One artifact per language,
// `data/word-bands.<code>.json`, all sharing the same band thresholds.
//
// One scalable data source per language — a subtitle word-frequency list — with a
// lemmatization list to merge inflections onto their base form (go/goes/going/went
// -> "go"). Frequency ordering is the whole signal (it dominates AoA and the
// definition graph for learn-order; we measured it on English). CEFR bands are
// frequency-rank thresholds calibrated once against CEFR-J (median rank per level:
// A1≈635, A2≈2275, B1≈4692, B2≈8394) and baked in below — an English-derived
// heuristic reused for every language, with no CEFR list needed at build time.
//
//   tsx scripts/build-bands.ts [lang]   # one language, or all when omitted
//
// Sources: en = SUBTLEX-US (Brysbaert & New 2009); es/fr/de/pt = OpenSubtitles
// frequency lists (hermitdave/FrequencyWords, 2018). Lemmatization lists from
// github.com/michmech/lemmatization-lists.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const data = (f: string) => resolve(here, "../data", f);

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

interface FreqSource {
  file: string;
  /** "csv" = comma-separated with a header row, columns by name;
   *  "list" = whitespace-separated `word count`, no header, columns by index. */
  format: "csv" | "list";
  wordCol: string | number;
  freqCol: string | number;
}

interface LangConfig {
  code: string;
  freq: FreqSource;
  lemmaFile: string;
  /** Single-grapheme tokens that are real words in this language (else dropped as noise). */
  singleLetterOk: Set<string>;
  /** Multi-letter subtitle/contraction remnants this corpus lists as standalone "words". */
  fragments: Set<string>;
  /** Sample words for the build report (word -> rank spot-check). */
  spotChecks: string[];
  /**
   * Optional casing oracle: a case-preserving Leipzig Corpora *sentences* file
   * (`id<TAB>sentence`). We measure how often each word is capitalized *mid-sentence*
   * (ignoring sentence-initial position, which capitalizes everything) and capitalize
   * the word when that share clears a threshold. So German nouns/names ("Wasser",
   * "Berlin") and proper nouns in any language come out capitalized while verbs,
   * pronouns, and sentence-initial-heavy words ("wer", "doch") stay lowercase — no
   * per-language rules. Absent = output stays lowercase.
   */
  casingFile?: string;
}

const LANGS: Record<string, LangConfig> = {
  en: {
    code: "en",
    freq: { file: "subtlex.csv", format: "csv", wordCol: "Word", freqCol: "SUBTLWF" },
    lemmaFile: "lemma-en.txt",
    singleLetterOk: new Set(["a", "i"]),
    fragments: new Set(["re", "ll", "ve", "em", "im", "n", "st", "nd", "rd", "th"]),
    spotChecks: ["the", "be", "water", "government", "philosophy", "entropy", "photosynthesis"],
  },
  es: {
    code: "es",
    freq: { file: "freq-es.txt", format: "list", wordCol: 0, freqCol: 1 },
    lemmaFile: "lemma-es.txt",
    singleLetterOk: new Set(["a", "y", "o", "e", "u"]),
    fragments: new Set(),
    spotChecks: ["de", "ser", "agua", "gobierno", "filosofía", "entropía"],
  },
  fr: {
    code: "fr",
    freq: { file: "freq-fr.txt", format: "list", wordCol: 0, freqCol: 1 },
    lemmaFile: "lemma-fr.txt",
    singleLetterOk: new Set(["à", "a", "y"]),
    fragments: new Set(),
    spotChecks: ["de", "être", "eau", "gouvernement", "philosophie", "entropie"],
  },
  de: {
    code: "de",
    freq: { file: "freq-de.txt", format: "list", wordCol: 0, freqCol: 1 },
    lemmaFile: "lemma-de.txt",
    singleLetterOk: new Set(),
    fragments: new Set(),
    spotChecks: ["ich", "sein", "wasser", "regierung", "philosophie", "entropie"],
    casingFile: "casing-de.txt",
  },
  pt: {
    code: "pt",
    freq: { file: "freq-pt.txt", format: "list", wordCol: 0, freqCol: 1 },
    lemmaFile: "lemma-pt.txt",
    singleLetterOk: new Set(["a", "o", "e", "é", "à", "á"]),
    fragments: new Set(),
    spotChecks: ["que", "ser", "água", "governo", "filosofia", "entropia"],
  },
};

// A token must start and end with a letter (any script), allowing internal
// apostrophes/hyphens — so clitic remnants like French "l'"/"qu'" are rejected while
// "aujourd'hui" survives.
const WORD_OK = /^\p{L}([\p{L}'-]*\p{L})?$/u;

function makeClean(cfg: LangConfig) {
  return (w: string | undefined): string | null => {
    if (!w) return null;
    w = w.trim().toLowerCase();
    if (!WORD_OK.test(w) || cfg.fragments.has(w)) return null;
    if ([...w].length === 1 && !cfg.singleLetterOk.has(w)) return null;
    return w;
  };
}

// --- Casing: lowercase key -> its capitalized display form (absent = stays lowercase).
//
// The core below is language-agnostic; a language supplies only data. Two signals
// combine:
//
//   1. Corpus (primary): mid-sentence capitalization share from a Leipzig sentences
//      file. We ignore each sentence's first token — sentence-initial position
//      capitalizes everything — so mid-sentence casing is the true signal. Wherever the
//      corpus has evidence it is decisive, which resolves case-homographs ("Essen" the
//      noun vs "essen" the verb, merged into one lemma) and captures proper nouns
//      (Berlin) with no per-language rules.
//   2. Dictionary (tail fallback): the michmech lemma list already carries each
//      language's own casing (German nouns capitalized, Romance all-lowercase). For the
//      rare tail the corpus barely sees, we trust it — but only when it is unambiguous
//      (a single, non-ALL-CAPS spelling), so verbs/nouns homographs still defer to the
//      corpus's frequency vote.
//
// Per language this is pure data: which corpus file (`casingFile`) plus the lemma list
// it already uses. One threshold serves all languages (proper nouns sit near 1.0;
// German nouns clear 0.7 too). Genuinely language-specific rules (e.g. Turkish dotless
// i) would slot in as a small hook here.
const CASING_MIN_SHARE = 0.7;
const CASING_MIN_COUNT = 5;
const CASING_TOKEN = /[^\W\d_]+(?:['’-][^\W\d_]+)*/gu;

// Case-homograph: a lemma whose two casings are genuinely both used (German "Essen"
// the noun vs "essen" the verb) — merged into one source entry, but worth translating
// in both casings. Flagged when the minority casing occurs enough mid-sentence to be
// real, not noise. The runtime backstops this: a casing whose gloss adds nothing is
// dropped from the card, so a loose gate here only costs a wasted lookup.
const HOMOGRAPH_MIN_COUNT = 100;
const HOMOGRAPH_MIN_SHARE = 0.1;

const isAllCaps = (w: string) => w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase();
const isCapped = (w: string) => w[0] !== w[0]!.toLowerCase();
const topKey = (counts: Map<string, number>) =>
  [...counts].sort((a, b) => b[1] - a[1])[0]![0];

interface CorpusStat {
  tot: number;
  cap: number;
  /** capitalized spelling -> count, to pick the dominant display form */
  forms: Map<string, number>;
}

function corpusCasing(file: string): Map<string, CorpusStat> {
  const stat = new Map<string, CorpusStat>();
  for (const line of readFileSync(data(file), "utf8").split(/\r?\n/)) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const toks = line.slice(tab + 1).match(CASING_TOKEN);
    if (!toks) continue;
    for (let i = 1; i < toks.length; i++) { // skip toks[0]: sentence-initial
      const w = toks[i]!;
      const key = w.toLowerCase();
      let s = stat.get(key);
      if (!s) stat.set(key, (s = { tot: 0, cap: 0, forms: new Map() }));
      s.tot++;
      if (isCapped(w) && !isAllCaps(w)) {
        s.cap++;
        s.forms.set(w, (s.forms.get(w) ?? 0) + 1);
      }
    }
  }
  return stat;
}

// The lemma list's own casings: lowercase key -> its (non-ALL-CAPS) spellings. German
// lists a capitalized spelling for nouns, so this is an authoritative "is there a noun
// with this spelling" signal.
function lemmaSpellings(lemmaFile: string): Map<string, Set<string>> {
  const spellings = new Map<string, Set<string>>();
  for (const line of readFileSync(data(lemmaFile), "utf8").split(/\r?\n/)) {
    const lemma = line.replace(/^﻿/, "").split("\t")[0];
    if (!lemma || isAllCaps(lemma)) continue;
    const key = lemma.toLowerCase();
    let s = spellings.get(key);
    if (!s) spellings.set(key, (s = new Set()));
    s.add(lemma);
  }
  return spellings;
}

// Unambiguous authoritative casing: key -> its single capitalized spelling.
function dictCasing(spellings: Map<string, Set<string>>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, forms] of spellings) {
    if (forms.size === 1 && isCapped([...forms][0]!)) out.set(key, [...forms][0]!);
  }
  return out;
}

// Casing display forms + case-homograph variants for a language.
function buildCasing(cfg: LangConfig): {
  casing: Map<string, string>;
  variants: Map<string, string[]>;
} {
  const corpus = cfg.casingFile ? corpusCasing(cfg.casingFile) : new Map<string, CorpusStat>();
  const spellings = lemmaSpellings(cfg.lemmaFile);
  const dict = dictCasing(spellings);
  const casing = new Map<string, string>();
  for (const key of new Set([...corpus.keys(), ...dict.keys()])) {
    const c = corpus.get(key);
    if (c && c.tot >= CASING_MIN_COUNT) {
      if (c.cap / c.tot >= CASING_MIN_SHARE) casing.set(key, topKey(c.forms)); // corpus decisive
    } else if (dict.has(key)) {
      casing.set(key, dict.get(key)!); // rare tail: authoritative dictionary
    }
  }

  // Case-homographs: both casings genuinely used mid-sentence AND the lemma list has a
  // capitalized spelling — i.e. the capitalized form is a real common noun, not a
  // surname ("Klein") or a sentence/quote-capitalized adjective ("schwarz"). Store both
  // spellings, more frequent casing first, for the card to translate separately.
  const hasNoun = (key: string) => [...(spellings.get(key) ?? [])].some(isCapped);
  const variants = new Map<string, string[]>();
  for (const [key, c] of corpus) {
    const low = c.tot - c.cap;
    const minority = Math.min(c.cap, low);
    if (c.cap === 0 || minority < HOMOGRAPH_MIN_COUNT || minority / c.tot < HOMOGRAPH_MIN_SHARE) continue;
    if (!hasNoun(key)) continue;
    const capForm = topKey(c.forms);
    variants.set(key, c.cap >= low ? [capForm, key] : [key, capForm]);
  }
  return { casing, variants };
}

function buildLang(cfg: LangConfig) {
  const clean = makeClean(cfg);

  // Lemma map: inflected form -> base lemma (michmech lists are `lemma<TAB>form`).
  const form2lemma = new Map<string, string>();
  for (const line of readFileSync(data(cfg.lemmaFile), "utf8").split(/\r?\n/)) {
    const [lemma, form] = line.replace(/^﻿/, "").split("\t");
    const l = clean(lemma), f = clean(form);
    if (l && f && !form2lemma.has(f)) form2lemma.set(f, l);
  }
  const lemmaOf = (w: string) => form2lemma.get(w) ?? w;

  // Sum frequency per lemma across all its inflections.
  const lines = readFileSync(data(cfg.freq.file), "utf8").split(/\r?\n/);
  let wCol: number, fCol: number, start: number;
  if (cfg.freq.format === "csv") {
    const head = lines[0].split(",");
    wCol = head.indexOf(cfg.freq.wordCol as string);
    fCol = head.indexOf(cfg.freq.freqCol as string);
    start = 1;
  } else {
    wCol = cfg.freq.wordCol as number;
    fCol = cfg.freq.freqCol as number;
    start = 0;
  }
  const split = (line: string) => (cfg.freq.format === "csv" ? line.split(",") : line.split(/\s+/));

  const freq = new Map<string, number>();
  for (let i = start; i < lines.length; i++) {
    const r = split(lines[i]);
    const w = clean(r[wCol]); const wf = Number(r[fCol]);
    if (!w || !(wf > 0)) continue;
    const L = lemmaOf(w);
    freq.set(L, (freq.get(L) ?? 0) + wf);
  }

  // Frequency order (desc); alphabetical tie-break keeps the artifact deterministic.
  // Merging/ranking is done on lowercase lemmas; display casing is applied last so
  // lookups (which lowercase their input) still match.
  const rankedKeys = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([w]) => w);

  const cased = cfg.casingFile ? buildCasing(cfg) : null;
  const ranked = cased ? rankedKeys.map((w) => cased.casing.get(w) ?? w) : rankedKeys;

  // Case-homographs among the ranked words: lowercase key -> both casings to translate.
  const variants: Record<string, string[]> = {};
  if (cased) for (const w of rankedKeys) if (cased.variants.has(w)) variants[w] = cased.variants.get(w)!;

  const outPath = data(`word-bands.${cfg.code}.json`);
  writeFileSync(
    outPath,
    JSON.stringify({ lang: cfg.code, ranked, variants, freqBands: FREQ_BANDS, cefrBands: CEFR_BANDS }),
  );

  // --- Report ---
  const rankOf = new Map(rankedKeys.map((w, i) => [w, i + 1]));
  const bandCount = (d: BandDef) =>
    (d.max === null ? ranked.length : Math.min(d.max, ranked.length)) - d.min + 1;
  console.log(`\n[${cfg.code}] ranked ${ranked.length.toLocaleString()} lemmas -> ${outPath}`);
  console.log("  freq:", FREQ_BANDS.map((d) => `${d.label}=${bandCount(d).toLocaleString()}`).join("  "));
  console.log("  CEFR:", CEFR_BANDS.map((d) => `${d.key}=${bandCount(d).toLocaleString()}`).join("  "));
  console.log("  spot-checks:", cfg.spotChecks.map((w) => `${w}→${(rankOf.get(w) ?? "—").toLocaleString()}`).join("  "));
  if (cased) {
    const capped = rankedKeys.filter((w) => cased.casing.has(w)).length;
    const pct = ((capped / rankedKeys.length) * 100).toFixed(0);
    const examples = ["wasser", "regierung", "mädchen", "gefängnis"].map((w) => cased.casing.get(w) ?? w);
    console.log(`  casing: ${capped.toLocaleString()} capitalized (${pct}%)`, "e.g.", examples.join(" "));
    console.log(`  homographs: ${Object.keys(variants).length}`, "e.g.",
      ["essen", "morgen", "recht"].map((w) => (variants[w] ?? []).join("/")).filter(Boolean).join(" "));
  }
}

const only = process.argv[2];
if (only && !LANGS[only]) {
  console.error(`unknown language "${only}" (have: ${Object.keys(LANGS).join(", ")})`);
  process.exit(1);
}
for (const cfg of Object.values(LANGS)) {
  if (!only || only === cfg.code) buildLang(cfg);
}
