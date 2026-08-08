import { afterEach, describe, expect, it, vi } from "vitest";
import { getBand } from "@/lib/bands";
import { GET as wordGET } from "./word/[word]/route";
import { GET as suggestGET } from "./suggest/route";
import { GET as bandsGET } from "./bands/[view]/route";
import { GET as bandGET } from "./band/[view]/[key]/route";
import { GET as translateGET } from "./translate/[word]/route";

// A guaranteed-present headword (the single most frequent) and an absent one.
const REAL = getBand("en", "freq", "1")!.words[0]!;
const REAL_ES = getBand("es", "freq", "1")!.words[0]!;
const MISSING = "zzzzznotaword";
const req = (url: string) => new Request(`http://test${url}`);
const promise = <T>(v: T) => Promise.resolve(v);

describe("GET /api/word/[word]", () => {
  it("returns the word's bands and lowercases the param", async () => {
    const res = await wordGET(req("/api/word/X"), { params: promise({ word: REAL.toUpperCase() }) });
    expect(res.status).toBe(200);
    const info = await res.json();
    expect(info.word).toBe(REAL);
    expect(info.rank).toBe(1);
    expect(info.freq.key).toBe("1");
    expect(info.cefr.key).toBe("A1");
  });

  it("404s for an unknown word", async () => {
    const res = await wordGET(req("/api/word/x"), { params: promise({ word: MISSING }) });
    expect(res.status).toBe(404);
  });

  it("looks the word up in the requested source language", async () => {
    const res = await wordGET(req(`/api/word/x?lang=es`), { params: promise({ word: REAL_ES }) });
    expect(res.status).toBe(200);
    expect((await res.json()).word).toBe(REAL_ES);
  });

  it("404s for an unknown source language", async () => {
    const res = await wordGET(req("/api/word/x?lang=zz"), { params: promise({ word: REAL }) });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/suggest", () => {
  it("returns prefix matches, honoring the limit", async () => {
    const res = await suggestGET(req("/api/suggest?q=th&limit=3"));
    const words = (await res.json()) as string[];
    expect(words.length).toBeLessThanOrEqual(3);
    expect(words.every((w) => w.startsWith("th"))).toBe(true);
  });
});

describe("GET /api/bands/[view]", () => {
  it("returns a summary for each view", async () => {
    for (const view of ["freq", "cefr"]) {
      const res = await bandsGET(req("/api/bands/x"), { params: promise({ view }) });
      expect(res.status).toBe(200);
      const summary = await res.json();
      expect(summary.length).toBe(6);
      expect(summary.every((b: { count: number }) => b.count > 0)).toBe(true);
    }
  });

  it("404s for an unknown view", async () => {
    const res = await bandsGET(req("/api/bands/x"), { params: promise({ view: "nope" }) });
    expect(res.status).toBe(404);
  });
});

// A gtx dt=bd response: translation segments, then dictionary groups of scored entries.
function mockGtx(translation: string, pos: string, entries: [string, number][]) {
  const body = [
    [[translation, "x", null, null, 1]],
    [[pos, entries.map(([t]) => t), entries.map(([t, s]) => [t, [], null, s])]],
  ];
  return vi.fn(async () => new Response(JSON.stringify(body)));
}

const translate = (word: string, qs: string) =>
  translateGET(req(`/api/translate/x?${qs}`), { params: promise({ word }) });

afterEach(() => vi.unstubAllGlobals());

// Google ranks a gloss's alternatives by confidence, not difficulty, so the card badges
// each with its level in the language it's written in — "agua" A1 beside "orina" B1.
describe("GET /api/translate/[word] levels", () => {
  it("levels every dictionary term in the gloss language", async () => {
    vi.stubGlobal("fetch", mockGtx("agua", "noun", [["agua", 0.6], ["orina", 0.02]]));
    const { levels } = await (await translate("water", "sl=en&tl=es&dict=1")).json();
    expect(levels.agua.key).toBe("A1");
    expect(levels.agua.rank).toBeGreaterThan(0);
    expect(levels.orina.key).not.toBe("A1");
  });

  it("levels the plain translation too, which is the gloss when there is no dictionary", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([[["casa", "x"]]]))));
    const { levels } = await (await translate("house", "sl=en&tl=es")).json();
    expect(levels.casa.key).toBe("A1");
  });

  // Only the six indexed languages have a word list to place a term in.
  it("leaves the terms unlevelled for a language we don't index", async () => {
    vi.stubGlobal("fetch", mockGtx("水", "noun", [["水", 0.6]]));
    const { levels } = await (await translate("water", "sl=en&tl=ja&dict=1")).json();
    expect(levels).toEqual({});
  });

  // Phrases and words the list has no headword for are ordinary, and go unbadged.
  it("skips a term the gloss language has no entry for", async () => {
    vi.stubGlobal("fetch", mockGtx("naja", "noun", [["naja", 0.6], ["cuchillo", 0.5]]));
    const { levels } = await (await translate("knife", "sl=en&tl=es&dict=1")).json();
    expect(levels.cuchillo).toBeDefined();
    expect(levels.naja).toBeUndefined();
  });
});

describe("GET /api/band/[view]/[key]", () => {
  it("returns a band's words in frequency order", async () => {
    const res = await bandGET(req("/api/band/x/x"), { params: promise({ view: "cefr", key: "A1" }) });
    expect(res.status).toBe(200);
    const band = await res.json();
    expect(band.key).toBe("A1");
    expect(band.words.length).toBe(1000);
  });

  it("404s for an unknown band or view", async () => {
    const bad = await bandGET(req("/api/band/x/x"), { params: promise({ view: "cefr", key: "Z9" }) });
    expect(bad.status).toBe(404);
    const badView = await bandGET(req("/api/band/x/x"), { params: promise({ view: "nope", key: "A1" }) });
    expect(badView.status).toBe(404);
  });
});
