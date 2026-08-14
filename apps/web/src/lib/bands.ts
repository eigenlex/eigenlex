import "server-only";
import type { Band, BandSummary, BandView, WordBands, WordLevel } from "@/lib/types";
import type { SourceLang } from "@/lib/languages";
// The per-language word-bands artifacts (built by scripts/build-bands.ts). Imported
// directly so Next bundles them into the API functions — each file is small.
import en from "../../data/word-bands.en.json";
import es from "../../data/word-bands.es.json";
import fr from "../../data/word-bands.fr.json";
import de from "../../data/word-bands.de.json";
import pt from "../../data/word-bands.pt.json";
import it from "../../data/word-bands.it.json";

export { isSourceLang } from "@/lib/languages";

interface BandDef {
  key: string;
  label: string;
  /** Inclusive 1-based rank range; `max: null` = open-ended top band. */
  min: number;
  max: number | null;
}

interface LangData {
  ranked: string[];
  freqBands: BandDef[];
  cefrBands: BandDef[];
  /** lowercased word -> 1-based frequency rank, built once per process. */
  rankOf: Map<string, number>;
  /** lowercased key -> both casings of a case-homograph ("essen" -> ["Essen","essen"]). */
  variants: Record<string, string[]>;
  /** lowercased 1- and 2-char prefix -> `ranked` indices, frequency order. */
  byPrefix: Map<string, number[]>;
}

// `ranked` may carry display casing (e.g. German "Wasser"); lookups key on lowercase.
function load(data: {
  ranked: string[];
  variants?: Record<string, string[]>;
  freqBands: BandDef[];
  cefrBands: BandDef[];
}): LangData {
  const rankOf = new Map<string, number>();
  const byPrefix = new Map<string, number[]>();
  const bucket = (key: string, i: number) => {
    const b = byPrefix.get(key);
    if (b) b.push(i);
    else byPrefix.set(key, [i]);
  };
  data.ranked.forEach((w, i) => {
    const l = w.toLowerCase();
    rankOf.set(l, i + 1);
    // Filled in frequency order, so a bucket already ranks its own candidates.
    bucket(l.slice(0, 1), i);
    if (l.length > 1) bucket(l.slice(0, 2), i);
  });
  return {
    ranked: data.ranked,
    freqBands: data.freqBands,
    cefrBands: data.cefrBands,
    rankOf,
    variants: data.variants ?? {},
    byPrefix,
  };
}

const REGISTRY: Record<SourceLang, LangData> = {
  en: load(en),
  es: load(es),
  fr: load(fr),
  de: load(de),
  pt: load(pt),
  it: load(it),
};

const defsFor = (d: LangData, view: BandView) => (view === "cefr" ? d.cefrBands : d.freqBands);
const bandAtRank = (defs: BandDef[], rank: number) =>
  defs.find((b) => rank >= b.min && (b.max === null || rank <= b.max));
const lastRank = (d: LangData, b: BandDef) =>
  b.max === null ? d.ranked.length : Math.min(b.max, d.ranked.length);

export function isView(v: string): v is BandView {
  return v === "freq" || v === "cefr";
}

export function getWord(source: SourceLang, word: string): WordBands | null {
  const d = REGISTRY[source];
  const rank = d.rankOf.get(word.toLowerCase());
  if (rank === undefined) return null;
  const freq = bandAtRank(d.freqBands, rank)!;
  const cefr = bandAtRank(d.cefrBands, rank)!;
  const display = d.ranked[rank - 1]!;
  return {
    // Show the corpus's display casing ("Wasser"), not the caller's lowercased query.
    word: display,
    // Case-homographs carry both casings so the card can translate each; else just the word.
    forms: d.variants[display.toLowerCase()] ?? [display],
    rank,
    freq: { key: freq.key, label: freq.label },
    cefr: { key: cefr.key, label: cefr.label },
  };
}

/**
 * A word's CEFR placement, keyed case-insensitively — what the word card's level badges
 * show. This is the one lookup taken against the *target* language, so the caller checks
 * `isSourceLang` first — only the six indexed languages have levels. Unlike `getWord` it
 * is asked about a translated term, which is often a phrase or a word the language doesn't
 * have; a miss is ordinary, and simply goes unbadged.
 */
export function getLevel(target: SourceLang, word: string): WordLevel | null {
  const d = REGISTRY[target];
  const rank = d.rankOf.get(word.toLowerCase());
  if (rank === undefined) return null;
  const b = bandAtRank(d.cefrBands, rank)!;
  return { key: b.key, label: b.label, rank };
}

/** Every band of a view with its word count — the browser's tabs. */
export function getBandSummary(source: SourceLang, view: BandView): BandSummary[] {
  const d = REGISTRY[source];
  return defsFor(d, view).map((b) => ({
    key: b.key,
    label: b.label,
    count: Math.max(0, lastRank(d, b) - b.min + 1),
  }));
}

/** One band's words, in frequency order. */
export function getBand(source: SourceLang, view: BandView, key: string): Band | null {
  const d = REGISTRY[source];
  const b = defsFor(d, view).find((x) => x.key === key);
  if (!b) return null;
  return { key: b.key, label: b.label, words: d.ranked.slice(b.min - 1, lastRank(d, b)) };
}

/**
 * Words starting with `prefix`, most frequent first, for typeahead. An exact match
 * leads, ahead of frequency: commoner words sharing the prefix would otherwise crowd
 * it past `limit` — "ban" trails bank, band, bang, banana, bandit and banker — and
 * the search box reads the head of this list to decide whether what was typed is
 * itself a word, and so worth looking up unasked.
 */
export function getSuggestions(source: SourceLang, prefix: string, limit = 8): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const d = REGISTRY[source];
  // Every candidate shares the query's first two characters, so one bucket holds them
  // all: a miss costs a failed lookup, and a hit never walks the rest of the list.
  const candidates = d.byPrefix.get(p.slice(0, 2));
  if (!candidates) return [];
  const exact = d.rankOf.get(p);
  const out: string[] = exact === undefined ? [] : [d.ranked[exact - 1]!];
  for (const i of candidates) {
    const word = d.ranked[i]!;
    const l = word.toLowerCase();
    if (l !== p && l.startsWith(p)) {
      out.push(word);
      if (out.length >= limit) break;
    }
  }
  return out;
}
