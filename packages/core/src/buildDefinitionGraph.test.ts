import { describe, expect, it } from "vitest";
import { buildDefinitionGraph } from "./buildDefinitionGraph";
import { englishStemmed } from "./language/english";
import type { Dictionary } from "./types";

const dict: Dictionary = {
  cat: ["a small domesticated carnivorous mammal"],
  dog: ["a domesticated carnivorous mammal"],
  mammal: ["a warm animal that feeds its young with milk"],
  animal: ["a living organism that feeds on organic matter"],
  small: ["of little size"],
  milk: ["a white liquid produced by a mammal"],
};

describe("buildDefinitionGraph", () => {
  it("links a word to the headwords its definition uses", () => {
    const { edges } = buildDefinitionGraph(dict);
    expect(edges["cat"]).toEqual(["mammal", "small"]);
    expect(edges["mammal"]).toEqual(["animal", "milk"]);
  });

  it("ignores words that are not themselves headwords", () => {
    const { edges } = buildDefinitionGraph(dict);
    // "carnivorous", "domesticated" appear but have no entry of their own.
    expect(edges["dog"]).toEqual(["mammal"]);
  });

  it("drops stopwords by default but keeps them when asked", () => {
    const tiny: Dictionary = {
      a: ["the first letter"],
      the: ["a definite article"],
      article: ["a the thing"],
    };
    expect(buildDefinitionGraph(tiny).edges["article"]).toEqual([]);
    expect(
      buildDefinitionGraph(tiny, { includeStopwords: true }).edges["article"],
    ).toEqual(["a", "the"]);
  });

  it("excludes self-loops unless includeSelfLoops is set", () => {
    const tiny: Dictionary = { thing: ["a thing of some kind"] };
    expect(buildDefinitionGraph(tiny).edges["thing"]).toEqual([]);
    expect(
      buildDefinitionGraph(tiny, { includeSelfLoops: true }).edges["thing"],
    ).toEqual(["thing"]);
  });

  it("matches multi-word headwords by longest match", () => {
    const phrases: Dictionary = {
      "ice cream": ["a sweet frozen food"],
      sweet: ["ice cream is sweet"],
    };
    expect(buildDefinitionGraph(phrases).edges["sweet"]).toEqual(["ice cream"]);
    // With phrase matching off, "ice cream" is still a node but unmatchable.
    const off = buildDefinitionGraph(phrases, { matchPhrases: false });
    expect(off.edges["sweet"]).toEqual([]);
    expect(off.edges["ice cream"]).toEqual(["sweet"]);
  });

  it("connects inflected forms when a lemmatizing profile is used", () => {
    const inflected: Dictionary = {
      dog: ["an animal with paws"],
      animal: ["a thing with legs"],
      paw: ["a foot"],
      leg: ["a limb"],
    };
    // "paws" and "legs" only link to "paw"/"leg" once lemmatized.
    const { edges } = buildDefinitionGraph(inflected, { language: englishStemmed });
    expect(edges["dog"]).toContain("paw");
    expect(edges["animal"]).toContain("leg");
  });

  it("reports degree-based stats", () => {
    const { stats } = buildDefinitionGraph(dict);
    expect(stats.nodes).toBe(6);
    expect(stats.edges).toBeGreaterThan(0);
    // "cat" and "dog" are referenced by nobody -> sources.
    expect(stats.sources).toBeGreaterThanOrEqual(2);
  });
});
