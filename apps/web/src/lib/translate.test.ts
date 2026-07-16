import { describe, expect, it } from "vitest";
import { baseLang, gtxUrl, parseGtx } from "./translate";

describe("baseLang", () => {
  it("strips region and lowercases, defaulting to en", () => {
    expect(baseLang("es-ES")).toBe("es");
    expect(baseLang("PT")).toBe("pt");
    expect(baseLang(null)).toBe("en");
    expect(baseLang("")).toBe("en");
  });
});

describe("gtxUrl", () => {
  it("builds an en→tl single-translation query", () => {
    const url = new URL(gtxUrl("serendipity", "es"));
    expect(url.searchParams.get("sl")).toBe("en");
    expect(url.searchParams.get("tl")).toBe("es");
    expect(url.searchParams.get("q")).toBe("serendipity");
    expect(url.searchParams.get("dt")).toBe("t");
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
