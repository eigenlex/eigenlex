// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { readScenario, writeScenario } from "./scenario";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("readScenario", () => {
  it("parses a full scenario from the query string", () => {
    window.history.replaceState(null, "", "/?lang=de&word=essen&tl=en&view=cefr&band=A2");
    expect(readScenario()).toEqual({
      lang: "de",
      word: "essen",
      tl: "en",
      view: "cefr",
      band: "A2",
    });
  });

  it("drops unknown source languages and views", () => {
    window.history.replaceState(null, "", "/?lang=xx&view=bogus&word=cat");
    expect(readScenario()).toEqual({ word: "cat" });
  });

  it("returns an empty scenario when nothing is set", () => {
    expect(readScenario()).toEqual({});
  });
});

describe("writeScenario", () => {
  it("round-trips through readScenario", () => {
    writeScenario({ lang: "fr", word: "eau", tl: "en", view: "freq", band: null });
    expect(readScenario()).toEqual({ lang: "fr", word: "eau", tl: "en", view: "freq" });
  });

  it("omits an unset band but always keeps lang and view", () => {
    writeScenario({ lang: "en", word: "water", tl: "en", view: "cefr", band: null });
    const p = new URLSearchParams(window.location.search);
    expect(p.has("band")).toBe(false);
    expect(p.get("lang")).toBe("en");
    expect(p.get("view")).toBe("cefr");
  });
});
