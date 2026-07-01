import { describe, expect, it } from "vitest";
import { getEgo, getLayer, getLayerSummary, getPath, getTop, getWord } from "./graph";

// Draw real vocabulary from the bundled sample rather than hard-coding words.
const words = getTop(200).map((t) => t.word);
const MISSING = "zzzzznotaword";

describe("getWord", () => {
  it("returns null for a word not in the dictionary", () => {
    expect(getWord(MISSING)).toBeNull();
  });

  it("sorts neighbor lists by rank (most fundamental first)", () => {
    const info = words.map(getWord).find((i) => i && i.defines.length > 1)!;
    const ranks = info.defines.map((w) => getWord(w)?.rank ?? Infinity);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe("getTop", () => {
  it("returns exactly k words, ranked by descending score", () => {
    const top = getTop(20);
    expect(top).toHaveLength(20);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1]!.score).toBeGreaterThanOrEqual(top[i]!.score);
    }
  });

  it("clamps non-positive k to an empty list", () => {
    expect(getTop(0)).toEqual([]);
    expect(getTop(-3)).toEqual([]);
  });
});

describe("getPath", () => {
  it("returns the single node for a word to itself", () => {
    expect(getPath(words[0]!, words[0]!)).toEqual([words[0]]);
  });

  it("returns null when a word is absent", () => {
    expect(getPath(MISSING, words[0]!)).toBeNull();
    expect(getPath(words[0]!, MISSING)).toBeNull();
  });

  it("reaches a direct out-neighbor in two steps", () => {
    const info = words.map(getWord).find((i) => i && i.defines.length > 0)!;
    const target = info.defines[0]!;
    expect(getPath(info.word, target)).toEqual([info.word, target]);
  });
});

describe("getEgo", () => {
  it("returns null for a word not in the dictionary", () => {
    expect(getEgo(MISSING)).toBeNull();
  });

  const focus = words.find((w) => (getEgo(w)?.nodes.length ?? 0) > 1)!;

  it("classifies each neighbor's kind consistently with its edges", () => {
    const ego = getEgo(focus)!;
    const info = getWord(focus)!;
    expect(ego.focus).toBe(focus);
    expect(ego.nodes[0]!.kind).toBe("focus");

    for (const node of ego.nodes.filter((n) => n.id !== focus)) {
      const out = info.defines.includes(node.id);
      const inc = info.usedBy.includes(node.id);
      if (node.kind === "mutual") expect(out && inc).toBe(true);
      else if (node.kind === "defines") expect([out, inc]).toEqual([true, false]);
      else expect([node.kind, out, inc]).toEqual(["usedBy", false, true]);
    }
  });

  it("orients every edge through the focus", () => {
    const ego = getEgo(focus)!;
    for (const e of ego.edges) {
      expect(e.source === focus || e.target === focus).toBe(true);
    }
  });

  it("caps neighbors per side by the max argument", () => {
    // 1 focus + at most `max` defines + at most `max` usedBy.
    expect(getEgo(focus, 3)!.nodes.length).toBeLessThanOrEqual(7);
  });
});

describe("getLayer", () => {
  it("returns null for out-of-range or non-integer depths", () => {
    expect(getLayer(-1)).toBeNull();
    expect(getLayer(1.5)).toBeNull();
    expect(getLayer(1e9)).toBeNull();
  });

  it("returns depth 0 as the kernel, every word tagged with that depth", () => {
    const layer = getLayer(0)!;
    expect(layer.depth).toBe(0);
    expect(layer.words.length).toBeGreaterThan(0);
    for (const w of layer.words.slice(0, 50)) {
      const info = getWord(w)!;
      expect(info.depth).toBe(0);
      expect(info.inKernel).toBe(true);
    }
  });

  it("orders a layer's words by rank", () => {
    const layer = getLayer(0)!;
    const ranks = layer.words.slice(0, 40).map((w) => getWord(w)!.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe("getLayerSummary", () => {
  it("has one size per layer, summing to the whole vocabulary", () => {
    const summary = getLayerSummary();
    expect(summary.sizes).toHaveLength(summary.layerCount);
    expect(summary.sizes[0]).toBe(getLayer(0)!.words.length);
    const total = summary.sizes.reduce((a, b) => a + b, 0);
    expect(total).toBe(getTop(1e9).length);
  });
});
