import "server-only";
import type { Band, BandSummary, BandView, WordBands } from "@/lib/types";
import type { SourceLang } from "@/lib/languages";
// The per-language word-bands artifacts (built by scripts/build-bands.ts). Imported
// directly so Next bundles them into the API functions — each file is small.
import en from "../../data/word-bands.en.json";
import es from "../../data/word-bands.es.json";
import fr from "../../data/word-bands.fr.json";
import de from "../../data/word-bands.de.json";
import pt from "../../data/word-bands.pt.json";

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
  /** word -> 1-based frequency rank, built once per process. */
  rankOf: Map<string, number>;
}

function load(data: { ranked: string[]; freqBands: BandDef[]; cefrBands: BandDef[] }): LangData {
  const rankOf = new Map<string, number>();
  data.ranked.forEach((w, i) => rankOf.set(w, i + 1));
  return { ranked: data.ranked, freqBands: data.freqBands, cefrBands: data.cefrBands, rankOf };
}

const REGISTRY: Record<SourceLang, LangData> = {
  en: load(en),
  es: load(es),
  fr: load(fr),
  de: load(de),
  pt: load(pt),
};

const defsFor = (d: LangData, view: BandView) => (view === "cefr" ? d.cefrBands : d.freqBands);
const bandAtRank = (defs: BandDef[], rank: number) =>
  defs.find((b) => rank >= b.min && (b.max === null || rank <= b.max));
const lastRank = (d: LangData, b: BandDef) =>
  b.max === null ? d.ranked.length : Math.min(b.max, d.ranked.length);

export function isView(v: string): v is BandView {
  return v === "freq" || v === "cefr";
}

export function getWord(lang: SourceLang, word: string): WordBands | null {
  const d = REGISTRY[lang];
  const rank = d.rankOf.get(word);
  if (rank === undefined) return null;
  const freq = bandAtRank(d.freqBands, rank)!;
  const cefr = bandAtRank(d.cefrBands, rank)!;
  return {
    word,
    rank,
    freq: { key: freq.key, label: freq.label },
    cefr: { key: cefr.key, label: cefr.label },
  };
}

/** Every band of a view with its word count — the browser's tabs. */
export function getBandSummary(lang: SourceLang, view: BandView): BandSummary[] {
  const d = REGISTRY[lang];
  return defsFor(d, view).map((b) => ({
    key: b.key,
    label: b.label,
    count: Math.max(0, lastRank(d, b) - b.min + 1),
  }));
}

/** One band's words, in frequency order. */
export function getBand(lang: SourceLang, view: BandView, key: string): Band | null {
  const d = REGISTRY[lang];
  const b = defsFor(d, view).find((x) => x.key === key);
  if (!b) return null;
  return { key: b.key, label: b.label, words: d.ranked.slice(b.min - 1, lastRank(d, b)) };
}

/** Words starting with `prefix`, most frequent first, for typeahead. */
export function getSuggestions(lang: SourceLang, prefix: string, limit = 8): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const out: string[] = [];
  // `ranked` is frequency-descending, so the first matches are the most useful.
  for (const word of REGISTRY[lang].ranked) {
    if (word.startsWith(p)) {
      out.push(word);
      if (out.length >= limit) break;
    }
  }
  return out;
}
