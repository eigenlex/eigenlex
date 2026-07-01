import { describe, expect, it } from "vitest";
import { getTop } from "@/lib/graph";
import { GET as wordGET } from "./word/[word]/route";
import { GET as egoGET } from "./ego/[word]/route";
import { GET as pathGET } from "./path/route";
import { GET as topGET } from "./top/route";
import { GET as layerGET } from "./layer/[n]/route";
import { GET as layersGET } from "./layers/route";

// A guaranteed-present headword and a guaranteed-absent one.
const REAL = getTop(1)[0]!.word;
const MISSING = "zzzzznotaword";
const req = (url: string) => new Request(`http://test${url}`);
const promise = <T>(v: T) => Promise.resolve(v);

describe("GET /api/word/[word]", () => {
  it("returns the word info and lowercases the param", async () => {
    const res = await wordGET(req("/api/word/X"), { params: promise({ word: REAL.toUpperCase() }) });
    expect(res.status).toBe(200);
    expect((await res.json()).word).toBe(REAL);
  });

  it("404s for an unknown word", async () => {
    const res = await wordGET(req("/api/word/x"), { params: promise({ word: MISSING }) });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/ego/[word]", () => {
  it("honors the max query param", async () => {
    const res = await egoGET(req("/api/ego/x?max=3"), { params: promise({ word: REAL }) });
    expect(res.status).toBe(200);
    const ego = await res.json();
    expect(ego.focus).toBe(REAL);
    expect(ego.nodes.length).toBeLessThanOrEqual(7);
  });

  it("falls back to the default max when the param is not a number", async () => {
    const res = await egoGET(req("/api/ego/x?max=abc"), { params: promise({ word: REAL }) });
    expect(res.status).toBe(200);
  });

  it("404s for an unknown word", async () => {
    const res = await egoGET(req("/api/ego/x"), { params: promise({ word: MISSING }) });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/path", () => {
  it("echoes from/to and returns a single-node path to itself", async () => {
    const res = await pathGET(req(`/api/path?from=${REAL}&to=${REAL}`));
    expect(await res.json()).toEqual({ from: REAL, to: REAL, path: [REAL] });
  });

  it("defaults missing params to empty strings with a null path", async () => {
    expect(await (await pathGET(req("/api/path"))).json()).toEqual({
      from: "",
      to: "",
      path: null,
    });
  });
});

describe("GET /api/top", () => {
  it("returns k words", async () => {
    expect(await (await topGET(req("/api/top?k=5"))).json()).toHaveLength(5);
  });

  it("defaults k to 25 (also when non-numeric)", async () => {
    expect(await (await topGET(req("/api/top"))).json()).toHaveLength(25);
    expect(await (await topGET(req("/api/top?k=abc"))).json()).toHaveLength(25);
  });
});

describe("GET /api/layer/[n]", () => {
  it("returns the requested layer", async () => {
    const res = await layerGET(req("/api/layer/0"), { params: promise({ n: "0" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).depth).toBe(0);
  });

  it("404s for out-of-range or non-integer n", async () => {
    for (const n of ["999999", "1.5", "abc", "-1"]) {
      const res = await layerGET(req("/api/layer/x"), { params: promise({ n }) });
      expect(res.status).toBe(404);
    }
  });
});

describe("GET /api/layers", () => {
  it("returns the stratification summary", async () => {
    const summary = await (await layersGET()).json();
    expect(summary.layerCount).toBeGreaterThan(0);
    expect(summary.sizes).toHaveLength(summary.layerCount);
  });
});
