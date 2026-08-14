// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { readScenario, writeScenario } from "./scenario";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("readScenario", () => {
  it("parses a full scenario from the query string", () => {
    window.history.replaceState(null, "", "/?source=de&word=essen&target=en&view=cefr&band=A2");
    expect(readScenario()).toEqual({
      source: "de",
      word: "essen",
      target: "en",
      view: "cefr",
      band: "A2",
    });
  });

  it("drops unknown source languages and views", () => {
    window.history.replaceState(null, "", "/?source=xx&view=bogus&word=cat");
    expect(readScenario()).toEqual({ word: "cat" });
  });

  // A link shared under the older spellings still opens on the pair it names.
  it("also accepts lang and tl", () => {
    window.history.replaceState(null, "", "/?lang=de&word=essen&tl=en");
    expect(readScenario()).toEqual({ source: "de", word: "essen", target: "en" });
  });

  it("prefers the canonical spelling when both are present", () => {
    window.history.replaceState(null, "", "/?source=fr&lang=de&target=it&tl=en");
    expect(readScenario()).toEqual({ source: "fr", target: "it" });
  });

  it("returns an empty scenario when nothing is set", () => {
    expect(readScenario()).toEqual({});
  });
});

describe("writeScenario", () => {
  it("round-trips through readScenario", () => {
    writeScenario({ source: "fr", word: "eau", target: "en", view: "freq", band: null });
    expect(readScenario()).toEqual({ source: "fr", word: "eau", target: "en", view: "freq" });
  });

  it("omits an unset band but always keeps the source and view", () => {
    writeScenario({ source: "en", word: "water", target: "en", view: "cefr", band: null });
    const p = new URLSearchParams(window.location.search);
    expect(p.has("band")).toBe(false);
    expect(p.get("source")).toBe("en");
    expect(p.get("view")).toBe("cefr");
  });
});
