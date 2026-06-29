import { describe, expect, it } from "vitest";
import { buildDefinitionGraph, type Dictionary } from "@eigenlex/core";
import {
  compile,
  kernel,
  largestComponent,
  layers,
  pageRank,
  shortestPath,
  stratify,
  stronglyConnectedComponents,
  topByPageRank,
} from "./index";

// Hand-built so the structure is known:
//   cat <-> feline           (a 2-cycle)
//   animal <-> vertebrate    (a 2-cycle, but leaks to spine)
//   mammal -> {animal, vertebrate}
//   vertebrate -> spine      (spine: sink, references no headword)
//   tic <-> tac              (a closed 2-cycle: a kernel)
const dict: Dictionary = {
  cat: ["a feline mammal"],
  feline: ["a cat"],
  mammal: ["a vertebrate animal"],
  animal: ["a living vertebrate"],
  vertebrate: ["an animal with a spine"],
  spine: ["a backbone"],
  tic: ["a tac"],
  tac: ["a tic"],
};
const graph = buildDefinitionGraph(dict);

const componentOf = (components: string[][], word: string) =>
  components.find((c) => c.includes(word))?.slice().sort();

describe("stronglyConnectedComponents", () => {
  it("finds mutually-defining groups", () => {
    const comps = stronglyConnectedComponents(graph);
    expect(comps).toHaveLength(5);
    expect(componentOf(comps, "animal")).toEqual(["animal", "vertebrate"]);
    expect(componentOf(comps, "tic")).toEqual(["tac", "tic"]);
    expect(componentOf(comps, "mammal")).toEqual(["mammal"]);
  });

  it("largestComponent returns a maximal cycle", () => {
    expect(largestComponent(graph)).toHaveLength(2);
  });
});

describe("kernel", () => {
  it("returns the components you cannot define your way out of", () => {
    const k = kernel(graph);
    expect(k.words).toEqual(["spine", "tac", "tic"]);
    expect(k.components).toContainEqual(["tac", "tic"]); // closed cycle
    expect(k.components).toContainEqual(["spine"]); // definitionless sink
    // cat/feline leak out to mammal, so they are NOT in the kernel.
    expect(k.words).not.toContain("cat");
  });
});

describe("pageRank", () => {
  it("scores sum to ~1 and favor depended-upon words", () => {
    const pr = pageRank(graph);
    const total = Object.values(pr).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
    // nobody references "mammal"; "animal" is referenced repeatedly.
    expect(pr["animal"]).toBeGreaterThan(pr["mammal"]);
  });

  it("topByPageRank is ranked and bounded", () => {
    const top = topByPageRank(graph, 3);
    expect(top).toHaveLength(3);
    expect(top[0].score).toBeGreaterThanOrEqual(top[1].score);
    expect(top[1].score).toBeGreaterThanOrEqual(top[2].score);
  });
});

describe("shortestPath", () => {
  it("walks the definitional chain", () => {
    expect(shortestPath(graph, "cat", "spine")).toEqual([
      "cat",
      "mammal",
      "vertebrate",
      "spine",
    ]);
  });

  it("handles same node, unreachable, and unknown words", () => {
    expect(shortestPath(graph, "cat", "cat")).toEqual(["cat"]);
    expect(shortestPath(graph, "spine", "cat")).toBeNull(); // spine is a sink
    expect(shortestPath(graph, "nonesuch", "cat")).toBeNull();
  });
});

describe("stratify / layers", () => {
  it("orders word-sets from most basic to most advanced", () => {
    const ls = layers(graph);
    expect(ls).toHaveLength(4);
    expect(ls[0]).toEqual(["spine", "tac", "tic"]); // primitives & closed cycle
    expect(ls[1]).toEqual(["animal", "vertebrate"]);
    expect(ls[2]).toEqual(["mammal"]);
    expect(ls[3]).toEqual(["cat", "feline"]); // most derived
  });

  it("the most basic layer is exactly the kernel", () => {
    expect(layers(graph)[0]).toEqual(kernel(graph).words);
  });

  it("places mutually-defining words in one SCC at one depth", () => {
    const g = compile(graph);
    const s = stratify(g);
    const idx = (w: string) => g.index.get(w) as number;
    const sccOf = (w: string) => s.sccOf[idx(w)];
    const depthOf = (w: string) => s.depth[sccOf(w)];

    expect(sccOf("animal")).toBe(sccOf("vertebrate"));
    expect(depthOf("spine")).toBe(0);
    expect(depthOf("animal")).toBe(1);
    expect(depthOf("mammal")).toBe(2);
    expect(depthOf("cat")).toBe(3);

    // order runs bottom -> top.
    for (let k = 1; k < s.order.length; k++) {
      expect(s.depth[s.order[k]]).toBeGreaterThanOrEqual(s.depth[s.order[k - 1]]);
    }
  });

  it("reverse adjacency records which words define a given word", () => {
    const g = compile(graph);
    const definedBy = (w: string) =>
      g.in[g.index.get(w) as number].map((i) => g.nodes[i]).sort();
    expect(definedBy("animal")).toEqual(["mammal", "vertebrate"]);
  });
});
