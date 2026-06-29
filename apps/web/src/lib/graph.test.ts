import { describe, expect, it } from "vitest";
import { getEgo, getTop, getWord } from "./graph";

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
