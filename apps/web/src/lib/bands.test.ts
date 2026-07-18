import { describe, expect, it } from "vitest";
import { getBand, getSuggestions, getWord } from "@/lib/bands";

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
