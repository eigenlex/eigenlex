import { describe, expect, it } from "vitest";
import { getBand, getBandSummary, getSuggestions, getWord } from "@/lib/bands";

// German carries display casing (nouns/names capitalized) while lookups stay
// case-insensitive; other languages are unaffected. See scripts/build-bands.ts.
describe("source-language casing", () => {
  it("shows a German noun capitalized, however it was queried", () => {
    expect(getWord("de", "wasser")?.word).toBe("Wasser");
    expect(getWord("de", "WASSER")?.word).toBe("Wasser");
  });

  it("keeps a German verb lowercase (homograph resolved by frequency)", () => {
    expect(getWord("de", "sein")?.word).toBe("sein");
  });

  it("matches typeahead on a lowercase prefix but returns display casing", () => {
    const hits = getSuggestions("de", "wass");
    expect(hits).toContain("Wasser");
    expect(hits.every((w) => w.toLowerCase().startsWith("wass"))).toBe(true);
  });

  it("leaves languages without a casing source lowercase", () => {
    const w = getBand("en", "freq", "1")!.words[0]!;
    expect(w).toBe(w.toLowerCase());
  });
});

describe("case-homographs", () => {
  it("returns both casings for a homograph, most frequent first", () => {
    expect(getWord("de", "essen")?.forms).toEqual(["Essen", "essen"]);
    expect(getWord("de", "ESSEN")?.forms).toEqual(["Essen", "essen"]);
  });

  it("returns just the single word for a non-homograph", () => {
    expect(getWord("de", "wasser")?.forms).toEqual(["Wasser"]);
    expect(getWord("en", "the")?.forms).toEqual(["the"]);
  });
});

// C2 ends at rank 50,000 and the tail past it is its own non-CEFR band, emitted only
// for languages whose list reaches that far. See CEFR_BANDS in scripts/build-bands.ts.
describe("CEFR tail", () => {
  it("bounds C2 instead of letting it swallow the list", () => {
    const c2 = getBandSummary("es", "cefr").find((b) => b.key === "C2")!;
    expect(c2.count).toBe(25000);
  });

  it("files the deep tail under `rare`, outside the CEFR scale", () => {
    const first = getBand("es", "cefr", "rare")!.words[0]!;
    const w = getWord("es", first)!;
    expect(w.rank).toBe(50001);
    expect(w.cefr.key).toBe("rare");
    expect(w.cefr.label).toBe("Rare · beyond C2");
  });

  it("omits the tail band for a language that never reaches it", () => {
    const keys = getBandSummary("en", "cefr").map((b) => b.key);
    expect(keys).not.toContain("rare");
    expect(keys.at(-1)).toBe("C2");
    expect(getBand("en", "cefr", "rare")).toBeNull();
  });

  // getWord asserts a band exists at every rank, so a gap would be a crash, not a miss.
  it("leaves no rank uncovered by a band", () => {
    const sum = (bs: { count: number }[]) => bs.reduce((n, b) => n + b.count, 0);
    for (const lang of ["en", "es", "de"] as const) {
      const cefr = getBandSummary(lang, "cefr");
      expect(sum(cefr)).toBe(sum(getBandSummary(lang, "freq")));
      expect(cefr.every((b) => b.count > 0)).toBe(true);
    }
  });
});

// Suggestions come from a prefix index bucketed on the first one or two characters;
// queries shorter than the bucket key still have to reach the right bucket.
describe("typeahead", () => {
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

  it("honours the limit and keeps frequency order", () => {
    const hits = getSuggestions("en", "th", 3);
    expect(hits).toHaveLength(3);
    expect(hits[0]).toBe("the");
  });
});
