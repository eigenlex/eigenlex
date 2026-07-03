import { describe, expect, it } from "vitest";
import { getEgo, getLayer, getSuggestions, getTop, getWord } from "./graph";

// Real headwords from the bundled sample, so we don't hard-code a vocabulary.
const words = getTop(50).map((t) => t.word);
const sample = words[0]!;

describe("layer wiring (web)", () => {
  it("getWord reports a depth inside the layer range", () => {
    for (const w of words) {
      const info = getWord(w)!;
      expect(info).not.toBeNull();
      expect(info.layerCount).toBeGreaterThan(0);
      expect(info.depth).toBeGreaterThanOrEqual(0);
      expect(info.depth).toBeLessThan(info.layerCount);
    }
  });

  it("layerCount is global — the same for every word", () => {
    const counts = new Set(words.map((w) => getWord(w)!.layerCount));
    expect(counts.size).toBe(1);
  });

  it("the most basic layer is exactly the kernel", () => {
    // depth 0 <=> sink component <=> kernel; the two data sources must agree.
    for (const w of words) {
      const info = getWord(w)!;
      expect(info.depth === 0).toBe(info.inKernel);
    }
  });

  it("getLayer collects exactly the words at that depth", () => {
    const count = getWord(sample)!.layerCount;
    expect(getLayer(-1)).toBeNull();
    expect(getLayer(count)).toBeNull();
    for (let d = 0; d < count; d++) {
      const layer = getLayer(d)!;
      expect(layer).not.toBeNull();
      expect(layer.depth).toBe(d);
      expect(layer.layerCount).toBe(count);
      expect(layer.words.length).toBeGreaterThan(0);
      for (const w of layer.words) expect(getWord(w)!.depth).toBe(d);
    }
  });

  it("a searched word sits in its own layer", () => {
    const info = getWord(sample)!;
    expect(getLayer(info.depth)!.words).toContain(sample);
  });

  it("getSuggestions returns prefix matches that always resolve, honoring the limit", () => {
    expect(getSuggestions("")).toEqual([]);
    expect(getSuggestions("   ")).toEqual([]);

    const prefix = sample.slice(0, 2);
    const hits = getSuggestions(prefix, 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(5);
    expect(new Set(hits).size).toBe(hits.length); // no duplicates
    for (const w of hits) {
      expect(w.startsWith(prefix)).toBe(true);
      expect(getWord(w)).not.toBeNull(); // a pick is always loadable
    }
  });

  it("getSuggestions orders matches by centrality (PageRank)", () => {
    const prefix = sample.slice(0, 2);
    const ranks = getSuggestions(prefix, 8).map((w) => getWord(w)!.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("getEgo stamps every node with a depth that matches getWord", () => {
    const ego = getEgo(sample)!;
    expect(ego).not.toBeNull();
    expect(ego.nodes.length).toBeGreaterThan(1);
    for (const node of ego.nodes) {
      expect(Number.isInteger(node.depth)).toBe(true);
      expect(node.depth).toBeGreaterThanOrEqual(0);
      expect(node.depth).toBe(getWord(node.id)!.depth);
    }
  });
});
