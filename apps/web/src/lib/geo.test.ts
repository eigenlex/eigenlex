import { describe, expect, it } from "vitest";
import { glossLang, localLang } from "./geo";
import { isSourceLang, SOURCE_LANGS } from "./languages";

describe("localLang", () => {
  it("maps a country to the language spoken there", () => {
    expect(localLang("ES", "en")).toBe("es");
    expect(localLang("MX", "en")).toBe("es");
    expect(localLang("BR", "en")).toBe("pt");
    expect(localLang("DE", "en")).toBe("de");
    expect(localLang("IT", "en")).toBe("it");
    expect(localLang("SN", "en")).toBe("fr");
  });

  it("accepts the header's casing and stray whitespace", () => {
    expect(localLang(" es ", "en")).toBe("es");
    expect(localLang("de", "en")).toBe("de");
  });

  it("has nothing to say without a country", () => {
    for (const c of [null, undefined, "", "   "]) expect(localLang(c, "en")).toBeNull();
  });

  it("has nothing to say where no language of ours is local", () => {
    for (const c of ["JP", "PL", "NL", "CN", "ZZ"]) expect(localLang(c, "en")).toBeNull();
  });

  // Anglophone countries are deliberately unlisted — the caller's own default is English.
  it("leaves anglophone countries to the caller's default", () => {
    for (const c of ["US", "GB", "AU", "IE"]) expect(localLang(c, "en")).toBeNull();
  });

  it("lets the browser locale pick among a country's languages", () => {
    expect(localLang("CH", "fr")).toBe("fr");
    expect(localLang("CH", "it")).toBe("it");
    expect(localLang("BE", "de")).toBe("de");
    expect(localLang("CA", "fr")).toBe("fr");
  });

  it("falls back to a multilingual country's first language", () => {
    expect(localLang("CH", "en")).toBe("de");
    expect(localLang("BE", "nl")).toBe("fr");
    expect(localLang("CA", "en")).toBe("en");
  });

  it("only ever names a language we index", () => {
    const codes = ["ES", "PT", "FR", "DE", "IT", "CH", "BE", "CA", "LU", "BR", "MX"];
    for (const c of codes) {
      const l = localLang(c, "en");
      expect(l && isSourceLang(l)).toBe(true);
    }
  });
});

describe("glossLang", () => {
  it("glosses into the reader's own language", () => {
    expect(glossLang("es", "en")).toBe("en");
    expect(glossLang("de", "ja")).toBe("ja");
    expect(glossLang("en", "pl")).toBe("pl");
  });

  it("steps aside rather than gloss a word into itself", () => {
    expect(glossLang("es", "es")).toBe("en");
    expect(glossLang("de", "de")).toBe("en");
    expect(glossLang("en", "en")).toBe("es");
  });

  it("never returns the language being studied", () => {
    for (const lang of SOURCE_LANGS) {
      for (const browser of [...SOURCE_LANGS, "ja", "pl"]) {
        expect(glossLang(lang, browser)).not.toBe(lang);
      }
    }
  });
});

// The pairs a first-time visitor lands on, per country and browser locale.
describe("the seeded pair", () => {
  const seed = (country: string | null, browser: string) => {
    const lang = localLang(country, browser) ?? "en";
    return `${lang}→${glossLang(lang, browser)}`;
  };

  it("studies the local language, glossed into the reader's", () => {
    expect(seed("ES", "en")).toBe("es→en"); // corporate en-US laptop in Spain
    expect(seed("DE", "en")).toBe("de→en");
    expect(seed("BR", "en")).toBe("pt→en");
  });

  it("glosses into English for a local reading their own vocabulary", () => {
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
