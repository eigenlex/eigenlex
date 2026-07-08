import { describe, expect, it } from "vitest";
import { buildDefinitionGraph } from "@eigenlex/core";
import {
  isObsoleteSense,
  splitWebsterSenses,
  websterAdapter,
  type WebsterSource,
} from "./index";

// Webster-style entries: numbered senses, a "(Zoöl.)" field label, a "Note:".
const source: WebsterSource = {
  dog: "1. (Zoöl.)  A domesticated carnivorous mammal. Note: kept as a pet. 2. A mean fellow.",
  mammal: "1. (Zoöl.) A warm-blooded animal that feeds its young with milk.",
  animal: "An organized living being; a living organism.",
  cat: "(Zoöl.) A small domesticated carnivorous mammal.",
  the: "",
};

describe("splitWebsterSenses", () => {
  it("splits numbered senses and strips field labels and notes", () => {
    expect(splitWebsterSenses(source["dog"]!)).toEqual([
      "A domesticated carnivorous mammal.",
      "A mean fellow.",
    ]);
  });

  it("keeps a single unnumbered sense intact", () => {
    expect(splitWebsterSenses(source["animal"]!)).toEqual([
      "An organized living being; a living organism.",
    ]);
  });

  it("can retain notes and field labels on request", () => {
    const [first] = splitWebsterSenses(source["dog"]!, {
      keepNotes: true,
      keepFieldLabels: true,
    });
    expect(first).toBe("(Zoöl.) A domesticated carnivorous mammal. Note: kept as a pet.");
  });

  it("strips Syn. synonym sections", () => {
    expect(
      splitWebsterSenses("A present; a gift. Syn. -- Present, donation, boon."),
    ).toEqual(["A present; a gift."]);
  });

  it("strips See cross-references", () => {
    expect(splitWebsterSenses("A fox. See Reynard, n.")).toEqual(["A fox."]);
  });

  it("strips POS abbreviations, initials, and sub-sense markers", () => {
    expect(
      splitWebsterSenses("n. (a) A loud cry. v. t. (b) To cry out. T. Brown."),
    ).toEqual(["A loud cry. To cry out. Brown."]);
  });

  it("can retain abbreviations and cross-refs on request", () => {
    expect(
      splitWebsterSenses("n. A cat. See Feline.", {
        keepAbbreviations: true,
        keepCrossRefs: true,
      }),
    ).toEqual(["n. A cat. See Feline."]);
  });

  it("returns no senses for empty text", () => {
    expect(splitWebsterSenses("")).toEqual([]);
  });
});

describe("websterAdapter", () => {
  it("produces a Dictionary, keeping definitionless headwords as nodes", () => {
    const dict = websterAdapter(source);
    expect(dict["mammal"]).toEqual([
      "A warm-blooded animal that feeds its young with milk.",
    ]);
    expect(dict["the"]).toEqual([]); // kept so other entries can link to it
  });

  it("feeds straight into the core graph builder", () => {
    const graph = buildDefinitionGraph(websterAdapter(source));
    expect(graph.edges["dog"]).toEqual(["mammal"]);
    expect(graph.edges["cat"]).toEqual(["mammal"]);
    expect(graph.edges["mammal"]).toEqual(["animal"]);
  });
});

describe("isObsoleteSense", () => {
  it("flags bracketed obsolete tags and their compounds", () => {
    for (const tag of ["[Obs.]", "[Obs]", "[obs.]", "[Obs. or R.]", "[R. & Obs.]"]) {
      expect(isObsoleteSense(`A gloss. ${tag}`)).toBe(true);
    }
  });

  it("does not flag obsolescent or untagged senses", () => {
    expect(isObsoleteSense("A becoming-rare word. [Obsoles.]")).toBe(false);
    expect(isObsoleteSense("A word about observations.")).toBe(false);
  });
});

describe("websterAdapter dropObsolete", () => {
  const obs: WebsterSource = {
    // Every sense obsolete -> the word itself is obsolete.
    sopite: "To lay asleep; to put to rest; to quiet. [Obs.]",
    // Obsolete sense sits beside a current one -> keep the word.
    sir: "1. A man of social authority; a lord. [Obs.] 2. A respectful address.",
    // No obsolete tag at all.
    dog: "A domesticated carnivorous mammal.",
  };

  it("drops words whose every sense is obsolete", () => {
    const dict = websterAdapter(obs, { dropObsolete: true });
    expect("sopite" in dict).toBe(false);
    expect(dict["sir"]).toEqual([
      "A man of social authority; a lord. [Obs.]",
      "A respectful address.",
    ]);
    expect(dict["dog"]).toEqual(["A domesticated carnivorous mammal."]);
  });

  it("keeps every word when the flag is off (default)", () => {
    expect("sopite" in websterAdapter(obs)).toBe(true);
  });
});
