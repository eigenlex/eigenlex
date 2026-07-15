// Shared API shapes — importable from both server (lib/bands) and client.

/** Which way to split the vocabulary into bands. */
export type BandView = "freq" | "cefr";

/** A band a word belongs to, as shown on the word card and browser tabs. */
export interface BandRef {
  key: string;
  label: string;
}

/** A single word's placement: its frequency rank and both band labelings. */
export interface WordBands {
  word: string;
  /** 1-based frequency rank (1 = most frequent). */
  rank: number;
  freq: BandRef;
  cefr: BandRef;
}

/** One band with its size — the browser's tabs/rail for a view. */
export interface BandSummary {
  key: string;
  label: string;
  /** Number of words in the band. */
  count: number;
}

/** A band's word list, in frequency order (most frequent first). */
export interface Band {
  key: string;
  label: string;
  words: string[];
}
