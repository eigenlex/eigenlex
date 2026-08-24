import { describe, expect, it } from "vitest";
import { getWord } from "@/lib/bands";

// The committed data/word-bands.<code>.json files are the build's output and the app's
// only corpus, so these hold whether or not anyone re-runs the build. Nothing else looks
// at what the filters in scripts/build-bands.ts actually did.

const held = (lang: Parameters<typeof getWord>[0], word: string) => getWord(lang, word) !== null;
const cased = (lang: Parameters<typeof getWord>[0], word: string) => getWord(lang, word)?.word;

// pt and fr hyphenate pronouns onto verbs, so every verb x pronoun pair spells its own
// surface form. None of them is vocabulary.
// @spec FILTER-1
describe("clitics", () => {
  it("holds no clitic surface form in Portuguese", () => {
    for (const w of ["deixa-me", "fazê-lo", "contar-te-ia"]) expect(held("pt", w), w).toBe(false);
  });

  it("holds no clitic surface form in French", () => {
    for (const w of ["donne-moi", "a-t-il", "avez-vous", "dis-moi"]) expect(held("fr", w), w).toBe(false);
  });
});

// The load-bearing detail is that segments match whole: "guarda-chuva" ends in "chuva",
// not "a", and "arc-en-ciel" in "ciel", not "en".
// @spec FILTER-2
describe("hyphenated vocabulary", () => {
  it("keeps a compound whose last segment merely ends in a clitic", () => {
    expect(held("pt", "guarda-chuva")).toBe(true);
    expect(held("fr", "arc-en-ciel")).toBe(true);
  });

  it("keeps the hyphenated words that are not clitic forms at all", () => {
    for (const w of ["rendez-vous", "garde-à-vous", "peut-être", "celui-là", "là-bas"]) {
      expect(held("fr", w), w).toBe(true);
    }
  });
});

// The lists are lemma-sorted, so first-wins hands a shared surface form to whichever
// lemma is alphabetically first — which deletes common words and floats the absorber
// into the beginner bands.
// @spec FILTER-3
describe("own-entry", () => {
  it("keeps a word that heads its own lemma entry, alongside the lemma that claims it", () => {
    expect(held("it", "governo")).toBe(true);
    expect(held("it", "governare")).toBe(true);
    expect(held("fr", "tu")).toBe(true);
    expect(held("fr", "il")).toBe(true);
  });
});

// A word is dropped as a name only when the gazetteer, the lemma list, mid-sentence
// casing and the determiner test all agree. These are what the last two tests spare.
// @spec FILTER-5
describe("personal names", () => {
  it("keeps a surname that is also an ordinary German noun", () => {
    for (const w of ["Koch", "Berg", "Kuss", "Fass", "Geduld"]) expect(cased("de", w), w).toBe(w);
  });
});

// Measured, not ruled: no per-language list of what is a proper noun is involved.
// @spec FILTER-6
describe("display casing", () => {
  it("capitalizes German nouns and proper nouns anywhere", () => {
    expect(cased("de", "wasser")).toBe("Wasser");
    expect(cased("es", "dios")).toBe("Dios");
    expect(cased("pt", "lisboa")).toBe("Lisboa");
  });

  it("leaves weekdays and months lowercase, which is where a rule would get it wrong", () => {
    expect(cased("es", "lunes")).toBe("lunes");
    expect(cased("es", "enero")).toBe("enero");
    expect(cased("es", "español")).toBe("español");
    expect(cased("it", "lunedì")).toBe("lunedì");
    expect(cased("it", "gennaio")).toBe("gennaio");
  });
});
