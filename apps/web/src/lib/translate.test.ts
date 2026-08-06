import { describe, expect, it } from "vitest";
import {
  alignGroup,
  baseLang,
  flattenSenses,
  gtxUrl,
  needsPivot,
  parseGtx,
  parseSenseGroups,
  pivotTerm,
} from "./translate";

describe("baseLang", () => {
  it("strips region and lowercases, defaulting to en", () => {
    expect(baseLang("es-ES")).toBe("es");
    expect(baseLang("PT")).toBe("pt");
    expect(baseLang(null)).toBe("en");
    expect(baseLang("")).toBe("en");
  });
});

describe("gtxUrl", () => {
  it("builds an sl→tl single-translation query", () => {
    const url = new URL(gtxUrl("serendipity", "en", "es"));
    expect(url.searchParams.get("sl")).toBe("en");
    expect(url.searchParams.get("tl")).toBe("es");
    expect(url.searchParams.get("q")).toBe("serendipity");
    expect(url.searchParams.get("dt")).toBe("t");
  });

  it("carries a non-English source language", () => {
    const url = new URL(gtxUrl("agua", "es", "en"));
    expect(url.searchParams.get("sl")).toBe("es");
    expect(url.searchParams.get("tl")).toBe("en");
  });

  it("adds the dictionary block only when asked", () => {
    expect(new URL(gtxUrl("Essen", "de", "en")).searchParams.getAll("dt")).toEqual(["t"]);
    expect(new URL(gtxUrl("Essen", "de", "en", true)).searchParams.getAll("dt")).toEqual(["t", "bd"]);
  });
});

describe("flattenSenses", () => {
  // Shape of a dt=bd response:
  // [ [translation…], [ [pos, [terms…], [[term, [reverse…], null, score],…]], … ] ].
  const essen = [
    [["Eat", "Essen"]],
    [
      [
        "noun",
        ["food", "meal"],
        [["food", [], null, 0.9], ["meal", [], null, 0.5], ["food", [], null, 0.1]],
      ],
    ],
  ];

  it("flattens dictionary terms, de-duplicated and capped", () => {
    expect(flattenSenses(parseSenseGroups(essen))).toEqual(["food", "meal"]);
    expect(flattenSenses(parseSenseGroups(essen), 1)).toEqual(["food"]);
  });

  it("returns [] when there is no dictionary block", () => {
    expect(flattenSenses(parseSenseGroups([[["who"]]]))).toEqual([]);
    expect(flattenSenses(parseSenseGroups(null))).toEqual([]);
    expect(flattenSenses(parseSenseGroups([[["x"]], null]))).toEqual([]);
  });

  it("flattens across parts of speech, so a casing gloss stays one line", () => {
    expect(flattenSenses(parseSenseGroups(nada))).toEqual([
      "nothing", "none", "nothingness", "nil",
    ]);
  });
});

// A word reading as several parts of speech — Spanish "nada": pronoun, noun, adverb.
const nada = [
  [["nothing", "nada"]],
  [
    ["pronoun", ["nothing"], [["nothing", [], null, 0.9], ["none", [], null, 0.4]]],
    ["noun", ["nothingness"], [["nothingness", [], null, 0.5], ["nil", [], null, 0.2]]],
    ["adverb", ["not at all"], [["not at all", [], null, 0.3]]],
  ],
];

// es→de "agua": an unscored block, carrying gender where the score would be — and no
// "Wasser", which only the plain translation has.
const agua = [
  [["Wasser", "agua", null, null, 10]],
  [
    [
      "noun",
      ["Gänsewein", "Urin"],
      [["Gänsewein", ["agua"], null, null, "der"], ["Urin", ["orina", "agua"], null, null, "der"]],
    ],
  ],
];

describe("parseSenseGroups", () => {
  it("keeps Google's part-of-speech grouping", () => {
    expect(parseSenseGroups(nada)).toEqual([
      { pos: "pronoun", terms: ["nothing", "none"] },
      { pos: "noun", terms: ["nothingness", "nil"] },
      { pos: "adverb", terms: ["not at all"] },
    ]);
  });

  it("caps terms per group, not across all of them", () => {
    expect(parseSenseGroups(nada, 1)).toEqual([
      { pos: "pronoun", terms: ["nothing"] },
      { pos: "noun", terms: ["nothingness"] },
      { pos: "adverb", terms: ["not at all"] },
    ]);
  });

  it("drops groups carrying no terms, and tolerates a missing pos label", () => {
    const odd = [[["x"]], [["verb", ["y"], []], [null, ["z"], [["z", [], null, 0.5]]]]];
    expect(parseSenseGroups(odd)).toEqual([{ pos: "", terms: ["z"] }]);
  });

  it("returns [] when there is no dictionary block", () => {
    expect(parseSenseGroups([[["who"]]])).toEqual([]);
    expect(parseSenseGroups(null)).toEqual([]);
  });

  // Otherwise the card glosses "agua" as "Gänsewein, Urin" and drops "Wasser" entirely.
  it("discards a wholly unscored block, which is a reverse lookup, not a dictionary", () => {
    expect(parseSenseGroups(agua)).toEqual([]);
    expect(flattenSenses(parseSenseGroups(agua))).toEqual([]);
  });

  // "dog" runs Hund .51, Rüde .0018, Schreckschraube 3e-6 — a rank cap keeps the noise.
  it("drops senses scoring far under the group's best", () => {
    const dog = [
      [["Hund", "dog"]],
      [[
        "noun",
        ["Hund"],
        [["Hund", [], null, 0.51], ["Rüde", [], null, 0.0018], ["Schreckschraube", [], null, 3e-6]],
      ]],
    ];
    expect(parseSenseGroups(dog)).toEqual([{ pos: "noun", terms: ["Hund"] }]);
  });

  it("treats an unscored entry in a scored block as no-confidence", () => {
    const mixed = [
      [["eau", "water"]],
      [["noun", ["eau", "mer"], [["eau", [], null, 0.9], ["mer", []]]]],
    ];
    expect(parseSenseGroups(mixed)).toEqual([{ pos: "noun", terms: ["eau"] }]);
  });
});

describe("needsPivot", () => {
  it("is true only when Google has neither side in English", () => {
    expect(needsPivot("es", "de")).toBe(true);
    expect(needsPivot("es", "en")).toBe(false);
    expect(needsPivot("en", "de")).toBe(false);
  });
});

describe("pivotTerm", () => {
  // "verde" scores adjective "green" and noun "green" alike; the noun reading glosses it
  // as a lawn, so the pivot follows Google's group order rather than the score.
  const verde = [
    [["Grün", "verde"]],
    [
      ["adjective", ["green"], [["green", [], null, 0.645], ["verdant", [], null, 0.0015]]],
      ["noun", ["green"], [["green", [], null, 0.645]]],
    ],
  ];

  it("takes the best sense of the first group, with its part of speech", () => {
    expect(pivotTerm(verde)).toEqual({ term: "green", pos: "adjective" });
  });

  // Google's "amigo" block tops out at .004 and has no "friend" — nothing worth pivoting on.
  it("declines when Google is not confident it has the word", () => {
    const amigo = [[["friend", "amigo"]], [["noun", ["buddy"], [["buddy", [], null, 0.004]]]]];
    expect(pivotTerm(amigo)).toBeNull();
    expect(pivotTerm([[["x"]]])).toBeNull();
    expect(pivotTerm(null)).toBeNull();
  });
});

describe("alignGroup", () => {
  const groups = [
    { pos: "noun", terms: ["Schule"] },
    { pos: "verb", terms: ["schulen"] },
  ];

  it("keeps the reading the source word had", () => {
    expect(alignGroup(groups, "noun")).toEqual([{ pos: "noun", terms: ["Schule"] }]);
  });

  // "escuela" is never the verb "to school", so glossing it as one would be worse than nothing.
  it("yields nothing when the English word's readings don't include it", () => {
    expect(alignGroup(groups, "adjective")).toEqual([]);
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
