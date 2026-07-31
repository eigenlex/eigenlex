import { describe, expect, it } from "vitest";
import { baseLang, gtxUrl, parseGtx, parseSenseGroups, parseSenses } from "./translate";

describe("baseLang", () => {
  it("strips region and lowercases, defaulting to en", () => {
    expect(baseLang("es-ES")).toBe("es");
    expect(baseLang("PT")).toBe("pt");
    expect(baseLang(null)).toBe("en");
    expect(baseLang("")).toBe("en");
  });
});

describe("gtxUrl", () => {
  it("builds an sl→tl single-translation query", () => {
    const url = new URL(gtxUrl("serendipity", "en", "es"));
    expect(url.searchParams.get("sl")).toBe("en");
    expect(url.searchParams.get("tl")).toBe("es");
    expect(url.searchParams.get("q")).toBe("serendipity");
    expect(url.searchParams.get("dt")).toBe("t");
  });

  it("carries a non-English source language", () => {
    const url = new URL(gtxUrl("agua", "es", "en"));
    expect(url.searchParams.get("sl")).toBe("es");
    expect(url.searchParams.get("tl")).toBe("en");
  });

  it("adds the dictionary block only when asked", () => {
    expect(new URL(gtxUrl("Essen", "de", "en")).searchParams.getAll("dt")).toEqual(["t"]);
    expect(new URL(gtxUrl("Essen", "de", "en", true)).searchParams.getAll("dt")).toEqual(["t", "bd"]);
  });
});

describe("parseSenses", () => {
  // Shape of a dt=bd response: [ [translation…], [ [pos, [terms…], [[term,…],…]], … ] ].
  const essen = [
    [["Eat", "Essen"]],
    [["noun", ["food", "meal"], [["food", [], 0.9], ["meal", [], 0.5], ["food", [], 0.1]]]],
  ];

  it("flattens dictionary terms, de-duplicated and capped", () => {
    expect(parseSenses(essen)).toEqual(["food", "meal"]);
    expect(parseSenses(essen, 1)).toEqual(["food"]);
  });

  it("returns [] when there is no dictionary block", () => {
    expect(parseSenses([[["who"]]])).toEqual([]);
    expect(parseSenses(null)).toEqual([]);
    expect(parseSenses([[["x"]], null])).toEqual([]);
  });

  it("flattens across parts of speech, so a casing gloss stays one line", () => {
    expect(parseSenses(nada)).toEqual(["nothing", "none", "nothingness", "nil"]);
  });
});

// A word reading as several parts of speech — Spanish "nada": pronoun, noun, adverb.
const nada = [
  [["nothing", "nada"]],
  [
    ["pronoun", ["nothing"], [["nothing", [], 0.9], ["none", [], 0.4]]],
    ["noun", ["nothingness"], [["nothingness", [], 0.5], ["nil", [], 0.2]]],
    ["adverb", ["not at all"], [["not at all", [], 0.3]]],
  ],
];

describe("parseSenseGroups", () => {
  it("keeps Google's part-of-speech grouping", () => {
    expect(parseSenseGroups(nada)).toEqual([
      { pos: "pronoun", terms: ["nothing", "none"] },
      { pos: "noun", terms: ["nothingness", "nil"] },
      { pos: "adverb", terms: ["not at all"] },
    ]);
  });

  it("caps terms per group, not across all of them", () => {
    expect(parseSenseGroups(nada, 1)).toEqual([
      { pos: "pronoun", terms: ["nothing"] },
      { pos: "noun", terms: ["nothingness"] },
      { pos: "adverb", terms: ["not at all"] },
    ]);
  });

  it("drops groups carrying no terms, and tolerates a missing pos label", () => {
    const odd = [[["x"]], [["verb", ["y"], []], [null, ["z"], [["z", [], 0.5]]]]];
    expect(parseSenseGroups(odd)).toEqual([{ pos: "", terms: ["z"] }]);
  });

  it("returns [] when there is no dictionary block", () => {
    expect(parseSenseGroups([[["who"]]])).toEqual([]);
    expect(parseSenseGroups(null)).toEqual([]);
  });
});

describe("parseGtx", () => {
  it("joins the first-column segments", () => {
    const data = [[["casualidad", "serendipity", null, null, 10]], null, "en"];
    expect(parseGtx(data)).toBe("casualidad");
  });

  it("concatenates multi-segment responses", () => {
    const data = [[["foo ", "…"], ["bar", "…"]]];
    expect(parseGtx(data)).toBe("foo bar");
  });

  it("returns empty string for unexpected shapes", () => {
    expect(parseGtx(null)).toBe("");
    expect(parseGtx([])).toBe("");
    expect(parseGtx([null])).toBe("");
    expect(parseGtx("nope")).toBe("");
  });
});
