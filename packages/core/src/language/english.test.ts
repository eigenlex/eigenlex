import { describe, expect, it } from "vitest";
import { english, englishStemmed, naiveEnglishLemmatize } from "./english";

describe("english profile", () => {
  it("tokenizes on word boundaries, keeping internal apostrophes and hyphens", () => {
    expect(english.tokenize("don't over-think it!")).toEqual(["don't", "over-think", "it"]);
  });

  it("returns no tokens for text without letters", () => {
    expect(english.tokenize("123 — 456")).toEqual([]);
  });

  it("normalizes: lowercases, strips accents and edge punctuation", () => {
    expect(english.normalize("Café")).toBe("cafe");
    expect(english.normalize("Zoöl")).toBe("zool");
    expect(english.normalize("'quoted-")).toBe("quoted");
    expect(english.normalize("’fancy’")).toBe("fancy");
  });

  it("exposes stopwords and has no lemmatizer by default", () => {
    expect(english.stopwords?.has("the")).toBe(true);
    expect(english.stopwords?.has("dog")).toBe(false);
    expect(english.lemmatize).toBeUndefined();
  });
});

describe("naiveEnglishLemmatize", () => {
  it("leaves short tokens untouched", () => {
    for (const w of ["is", "as", "gas", "ies"]) expect(naiveEnglishLemmatize(w)).toBe(w);
  });

  it("reduces consonant + -ies to -y", () => {
    expect(naiveEnglishLemmatize("bodies")).toBe("body");
    expect(naiveEnglishLemmatize("cities")).toBe("city");
  });

  it("reduces sibilant + -es", () => {
    expect(naiveEnglishLemmatize("boxes")).toBe("box");
    expect(naiveEnglishLemmatize("dishes")).toBe("dish");
    expect(naiveEnglishLemmatize("churches")).toBe("church");
  });

  it("drops a trailing plural -s but not -ss or -us", () => {
    expect(naiveEnglishLemmatize("dogs")).toBe("dog");
    expect(naiveEnglishLemmatize("glass")).toBe("glass");
    expect(naiveEnglishLemmatize("virus")).toBe("virus");
  });

  it("englishStemmed reuses the english profile with lemmatize wired in", () => {
    expect(englishStemmed.id).toBe("en-stem");
    expect(englishStemmed.tokenize).toBe(english.tokenize);
    expect(englishStemmed.lemmatize?.("dogs")).toBe("dog");
  });
});
