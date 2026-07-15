import "server-only";
import type { Band, BandSummary, BandView, WordBands } from "@/lib/types";
// The word-bands artifact (built by scripts/build-bands.ts). Imported directly so
// Next bundles it into the API functions — the file is small and always present.
import data from "../../data/word-bands.json";

interface BandDef {
  key: string;
  label: string;
  /** Inclusive 1-based rank range; `max: null` = open-ended top band. */
  min: number;
  max: number | null;
}

const ranked: string[] = data.ranked;
const freqBands: BandDef[] = data.freqBands;
const cefrBands: BandDef[] = data.cefrBands;

// word -> 1-based frequency rank, built once per server process.
const rankOf = new Map<string, number>();
ranked.forEach((w, i) => rankOf.set(w, i + 1));

const defsFor = (view: BandView) => (view === "cefr" ? cefrBands : freqBands);
const bandAtRank = (defs: BandDef[], rank: number) =>
  defs.find((d) => rank >= d.min && (d.max === null || rank <= d.max));
const lastRank = (d: BandDef) => (d.max === null ? ranked.length : Math.min(d.max, ranked.length));

export function isView(v: string): v is BandView {
  return v === "freq" || v === "cefr";
}

export function getWord(word: string): WordBands | null {
  const rank = rankOf.get(word);
  if (rank === undefined) return null;
  const freq = bandAtRank(freqBands, rank)!;
  const cefr = bandAtRank(cefrBands, rank)!;
  return {
    word,
    rank,
    freq: { key: freq.key, label: freq.label },
    cefr: { key: cefr.key, label: cefr.label },
  };
}

/** Every band of a view with its word count — the browser's tabs. */
export function getBandSummary(view: BandView): BandSummary[] {
  return defsFor(view).map((d) => ({
    key: d.key,
    label: d.label,
    count: Math.max(0, lastRank(d) - d.min + 1),
  }));
}

/** One band's words, in frequency order. */
export function getBand(view: BandView, key: string): Band | null {
  const d = defsFor(view).find((b) => b.key === key);
  if (!d) return null;
  return { key: d.key, label: d.label, words: ranked.slice(d.min - 1, lastRank(d)) };
}

/** Words starting with `prefix`, most frequent first, for typeahead. */
export function getSuggestions(prefix: string, limit = 8): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const out: string[] = [];
  // `ranked` is frequency-descending, so the first matches are the most useful.
  for (const word of ranked) {
    if (word.startsWith(p)) {
      out.push(word);
      if (out.length >= limit) break;
    }
  }
  return out;
}
