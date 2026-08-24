import { describe, expect, it } from "vitest";
import { getBand, getBandSummary, getLevel, getSuggestions, getWord } from "@/lib/bands";

// German carries display casing (nouns/names capitalized) while lookups stay
// case-insensitive; other languages are unaffected. See scripts/build-bands.ts.
describe("source-language casing", () => {
  // @spec BAND-5, FILTER-6
  it("shows a German noun capitalized, however it was queried", () => {
    expect(getWord("de", "wasser")?.word).toBe("Wasser");
    expect(getWord("de", "WASSER")?.word).toBe("Wasser");
  });

  // @spec FILTER-6
  it("keeps a German verb lowercase (homograph resolved by frequency)", () => {
    expect(getWord("de", "sein")?.word).toBe("sein");
  });

  // @spec BAND-5, BAND-10
  it("matches typeahead on a lowercase prefix but returns display casing", () => {
    const hits = getSuggestions("de", "wass");
    expect(hits).toContain("Wasser");
    expect(hits.every((w) => w.toLowerCase().startsWith("wass"))).toBe(true);
  });

  // @spec FILTER-7
  it("leaves languages without a casing source lowercase", () => {
    const w = getBand("en", "freq", "1")!.words[0]!;
    expect(w).toBe(w.toLowerCase());
  });
});

describe("case-homographs", () => {
  // @spec BAND-6
  it("returns both casings for a homograph, most frequent first", () => {
    expect(getWord("de", "essen")?.forms).toEqual(["Essen", "essen"]);
    expect(getWord("de", "ESSEN")?.forms).toEqual(["Essen", "essen"]);
  });

  // @spec BAND-6
  it("returns just the single word for a non-homograph", () => {
    expect(getWord("de", "wasser")?.forms).toEqual(["Wasser"]);
    expect(getWord("en", "the")?.forms).toEqual(["the"]);
  });
});

// The thresholds are the one number in the app a learner is told to trust. They are
// English-derived and reused unchanged, so a language that disagreed would be a build
// that had quietly diverged.
// @spec BAND-1, BAND-2
describe("band definitions", () => {
  const LANGS = ["en", "es", "fr", "de", "pt", "it"] as const;
  const TOPS = [
    ["A1", 1000],
    ["A2", 3000],
    ["B1", 6000],
    ["B2", 12000],
    ["C1", 25000],
  ] as const;

  // Asserted through the counts rather than the definitions, so this fails on a band
  // that is defined right and emitted wrong.
  const topsOf = (lang: (typeof LANGS)[number]) => {
    const counts = new Map(getBandSummary(lang, "cefr").map((b) => [b.key, b.count]));
    let top = 0;
    return TOPS.map(([key]) => [key, (top += counts.get(key) ?? 0)] as const);
  };

  it("tops each CEFR band at its calibrated rank", () => {
    expect(topsOf("en")).toEqual(TOPS.map(([k, r]) => [k, r]));
  });

  it("uses the same thresholds in every language", () => {
    for (const lang of LANGS) expect(topsOf(lang), lang).toEqual(topsOf("en"));
  });

  it("keeps the two views over one list, so the same word is in both", () => {
    for (const lang of LANGS) {
      const total = (view: "freq" | "cefr") =>
        getBandSummary(lang, view).reduce((n, b) => n + b.count, 0);
      expect(total("cefr"), lang).toBe(total("freq"));
    }
  });
});

// C2 ends at rank 50,000, and `dictGate` keeps every list well short of that, so the
// open-ended `rare` band past it exists only as a backstop and is emitted for no
// language today. See CEFR_BANDS and `dictGate` in scripts/build-bands.ts.
describe("CEFR tail", () => {
  // @spec BAND-1
  it("bounds C2 instead of letting it swallow the list", () => {
    const c2 = getBandSummary("es", "cefr").find((b) => b.key === "C2")!;
    expect(c2.count).toBeLessThan(25000);
  });

  // @spec BAND-4, FILTER-4
  it("ends every language at C2, with no tail band rendered", () => {
    for (const lang of ["en", "es", "fr", "de", "pt", "it"] as const) {
      const keys = getBandSummary(lang, "cefr").map((b) => b.key);
      expect(keys.at(-1)).toBe("C2");
      expect(keys).not.toContain("rare");
      expect(getBand(lang, "cefr", "rare")).toBeNull();
    }
  });

  // The dictionary gate's whole point: the deep tail was names and OCR debris, so the
  // last word of every list should now be something its own dictionary vouches for.
  it("keeps the deepest word inside C2", () => {
    for (const lang of ["fr", "it"] as const) {
      const c2 = getBand(lang, "cefr", "C2")!;
      const last = c2.words.at(-1)!;
      expect(getWord(lang, last)!.cefr.key).toBe("C2");
    }
  });

  // getWord asserts a band exists at every rank, so a gap would be a crash, not a miss.
  // @spec BAND-3
  it("leaves no rank uncovered by a band", () => {
    const sum = (bs: { count: number }[]) => bs.reduce((n, b) => n + b.count, 0);
    for (const lang of ["en", "es", "de"] as const) {
      const cefr = getBandSummary(lang, "cefr");
      expect(sum(cefr)).toBe(sum(getBandSummary(lang, "freq")));
      expect(cefr.every((b) => b.count > 0)).toBe(true);
    }
  });
});

// The level badges on the word card. Google orders the alternatives by confidence,
// not difficulty, so the level is what separates the word to learn from the one beside it.
describe("translation levels", () => {
  it("places a term at its CEFR band and rank", () => {
    const water = getLevel("en", "water")!;
    expect(water.key).toBe("A1");
    expect(water.rank).toBeGreaterThan(0);
    // Same meaning, far rarer alternative — the difference the badge exists to show.
    expect(getLevel("en", "aqua")!.rank).toBeGreaterThan(water.rank * 5);
  });

  // @spec BAND-7
  it("keys case-insensitively, so a capitalized term still resolves", () => {
    expect(getLevel("de", "wasser")).toEqual(getLevel("de", "Wasser"));
  });

  // A translated term is routinely something the list has no headword for; not an error.
  // @spec BAND-8
  it("returns nothing for a phrase or a word the language doesn't carry", () => {
    expect(getLevel("es", "usar naja")).toBeNull();
    expect(getLevel("en", "zzzzznotaword")).toBeNull();
  });
});

// Suggestions come from a prefix index bucketed on the first one or two characters;
// queries shorter than the bucket key still have to reach the right bucket.
describe("typeahead", () => {
  // @spec BAND-10
  it("suggests on a single character, most frequent first", () => {
    const hits = getSuggestions("en", "a");
    expect(hits.every((w) => w.startsWith("a"))).toBe(true);
    expect(hits).toHaveLength(8);
    expect(hits[0]).toBe("a");
  });

  it("returns nothing for a prefix no word starts with", () => {
    expect(getSuggestions("en", "zzq")).toEqual([]);
    expect(getSuggestions("en", "qx")).toEqual([]);
  });

  // @spec BAND-10
  it("honours the limit and keeps frequency order", () => {
    const hits = getSuggestions("en", "th", 3);
    expect(hits).toHaveLength(3);
    expect(hits[0]).toBe("the");
  });

  // The search box reads the head of the list to decide whether the typed text is
  // itself a word, so the exact match has to be there however crowded the prefix is.
  // @spec BAND-10
  it("leads with the exact match, ahead of commoner words sharing the prefix", () => {
    expect(getSuggestions("en", "ban", 3)).toEqual(["ban", "bank", "band"]);
  });
});
