import { describe, expect, it } from "vitest";
import { DEFAULT_SOURCE, isSourceLang, SOURCE_LANGS, SOURCE_LANG_META } from "./languages";

describe("isSourceLang", () => {
  it("accepts every supported source language", () => {
    for (const l of SOURCE_LANGS) expect(isSourceLang(l)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const l of ["", "zz", "EN", "eng", "japanese"]) expect(isSourceLang(l)).toBe(false);
  });
});

describe("source-language metadata", () => {
  it("covers every source language with a name and default word", () => {
    for (const l of SOURCE_LANGS) {
      const meta = SOURCE_LANG_META[l];
      expect(meta.name).toBeTruthy();
      expect(meta.defaultWord).toBeTruthy();
      expect(meta.source.url).toMatch(/^https:\/\//);
    }
  });

  it("defaults to a supported language", () => {
    expect(isSourceLang(DEFAULT_SOURCE)).toBe(true);
  });
});
