import { describe, expect, it } from "vitest";
import { baseLang, gtxUrl, parseGtx, parseSenses } from "./translate";

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
