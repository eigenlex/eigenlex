import { describe, expect, it } from "vitest";
import { sourceLang, targetLang } from "./geo";
import { isSourceLang, SOURCE_LANGS } from "./languages";

describe("sourceLang", () => {
  it("maps a country to the language spoken there", () => {
    expect(sourceLang("ES", "en")).toBe("es");
    expect(sourceLang("MX", "en")).toBe("es");
    expect(sourceLang("BR", "en")).toBe("pt");
    expect(sourceLang("DE", "en")).toBe("de");
    expect(sourceLang("IT", "en")).toBe("it");
    expect(sourceLang("SN", "en")).toBe("fr");
  });

  it("accepts the header's casing and stray whitespace", () => {
    expect(sourceLang(" es ", "en")).toBe("es");
    expect(sourceLang("de", "en")).toBe("de");
  });

  it("has nothing to say without a country", () => {
    for (const c of [null, undefined, "", "   "]) expect(sourceLang(c, "en")).toBeNull();
  });

  it("has nothing to say where no language of ours is local", () => {
    for (const c of ["JP", "PL", "NL", "CN", "ZZ"]) expect(sourceLang(c, "en")).toBeNull();
  });

  // Anglophone countries are deliberately unlisted — the caller's own default is English.
  it("leaves anglophone countries to the caller's default", () => {
    for (const c of ["US", "GB", "AU", "IE"]) expect(sourceLang(c, "en")).toBeNull();
  });

  it("lets the browser locale pick among a country's languages", () => {
    expect(sourceLang("CH", "fr")).toBe("fr");
    expect(sourceLang("CH", "it")).toBe("it");
    expect(sourceLang("BE", "de")).toBe("de");
    expect(sourceLang("CA", "fr")).toBe("fr");
  });

  it("falls back to a multilingual country's first language", () => {
    expect(sourceLang("CH", "en")).toBe("de");
    expect(sourceLang("BE", "nl")).toBe("fr");
    expect(sourceLang("CA", "en")).toBe("en");
  });

  it("only ever names a language we index", () => {
    const codes = ["ES", "PT", "FR", "DE", "IT", "CH", "BE", "CA", "LU", "BR", "MX"];
    for (const c of codes) {
      const l = sourceLang(c, "en");
      expect(l && isSourceLang(l)).toBe(true);
    }
  });
});

describe("targetLang", () => {
  it("translates into the reader's own language", () => {
    expect(targetLang("es", "en")).toBe("en");
    expect(targetLang("de", "ja")).toBe("ja");
    expect(targetLang("en", "pl")).toBe("pl");
  });

  it("steps aside rather than translate a word into itself", () => {
    expect(targetLang("es", "es")).toBe("en");
    expect(targetLang("de", "de")).toBe("en");
    expect(targetLang("en", "en")).toBe("es");
  });

  it("never returns the language being studied", () => {
    for (const source of SOURCE_LANGS) {
      for (const browser of [...SOURCE_LANGS, "ja", "pl"]) {
        expect(targetLang(source, browser)).not.toBe(source);
      }
    }
  });
});

// The pairs a first-time visitor lands on, per country and browser locale.
describe("the seeded pair", () => {
  const seed = (country: string | null, browser: string) => {
    const source = sourceLang(country, browser) ?? "en";
    return `${source}→${targetLang(source, browser)}`;
  };

  it("studies the local language, translated into the reader's", () => {
    expect(seed("ES", "en")).toBe("es→en"); // corporate en-US laptop in Spain
    expect(seed("DE", "en")).toBe("de→en");
    expect(seed("BR", "en")).toBe("pt→en");
  });

  it("translates into English for a local reading their own vocabulary", () => {
    expect(seed("ES", "es")).toBe("es→en");
    expect(seed("IT", "it")).toBe("it→en");
  });

  it("studies English where no language of ours is local", () => {
    expect(seed("JP", "ja")).toBe("en→ja");
    expect(seed("PL", "pl")).toBe("en→pl");
    expect(seed(null, "nl")).toBe("en→nl");
  });

  it("falls back to Spanish for an anglophone", () => {
    expect(seed("US", "en")).toBe("en→es");
    expect(seed(null, "en")).toBe("en→es");
  });
});
