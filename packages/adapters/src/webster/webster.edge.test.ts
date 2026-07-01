import { describe, expect, it } from "vitest";
import { splitWebsterSenses, websterAdapter, type WebsterSource } from "./index";

describe("splitWebsterSenses options", () => {
  it("drops senses shorter than minSenseLength", () => {
    expect(
      splitWebsterSenses("1. Ab. 2. A longer, real sense.", { minSenseLength: 5 }),
    ).toEqual(["A longer, real sense."]);
  });

  it("keeps cross-references when only keepCrossRefs is set", () => {
    expect(splitWebsterSenses("A fox. See Reynard.", { keepCrossRefs: true })).toEqual([
      "A fox. See Reynard.",
    ]);
  });

  it("collapses to nothing when the whole gloss is a cross-reference", () => {
    expect(splitWebsterSenses("See Elsewhere.")).toEqual([]);
  });

  it("strips a Defn: marker", () => {
    expect(splitWebsterSenses("Defn: A small stream.")).toEqual(["A small stream."]);
  });
});

describe("websterAdapter", () => {
  it("merges entries whose headwords collide after trimming", () => {
    const source: WebsterSource = { dog: "1. A pet.", "dog ": "2. A cad." };
    expect(websterAdapter(source)["dog"]).toEqual(["A pet.", "A cad."]);
  });

  it("skips blank headwords", () => {
    const dict = websterAdapter({ "   ": "1. Nothing.", real: "A thing." });
    expect("" in dict).toBe(false);
    expect(dict["real"]).toEqual(["A thing."]);
  });

  it("keeps a headword whose definition cleans to nothing", () => {
    const dict = websterAdapter({ ghost: "See Elsewhere.", elsewhere: "A place." });
    expect(dict["ghost"]).toEqual([]); // still a node, so links to it survive
  });

  it("stores headwords on a null-prototype object", () => {
    const dict = websterAdapter({ constructor: "A builder." });
    expect(Object.getPrototypeOf(dict)).toBeNull();
    expect(dict["constructor"]).toEqual(["A builder."]);
  });

  it("tolerates a missing definition value", () => {
    // Malformed source with an undefined blob must not throw.
    const dict = websterAdapter({ x: undefined as unknown as string });
    expect(dict["x"]).toEqual([]);
  });
});
