// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordCard from "./WordCard";

// The workspace owns the target language now; a tiny stateful host stands in for it so
// picking a language in the card re-renders with the new value, as it does in the app.
function Host({ word, lang, tl: initial }: { word: string; lang: string; tl: string }) {
  const [tl, setTl] = useState(initial);
  return <WordCard word={word} forms={[word]} lang={lang} tl={tl} onTlChange={setTl} />;
}

// Translate stub: returns a per-language gloss so we can assert re-translation.
const GLOSS: Record<string, string> = { es: "agua", fr: "eau" };
function mockFetch() {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/api/translate/")) {
      const tl = new URL(u, "http://localhost").searchParams.get("tl") ?? "";
      return new Response(JSON.stringify({ word: "water", tl, translation: GLOSS[tl] ?? "" }));
    }
    return new Response("no", { status: 404 });
  });
}

const selector = () => screen.getByRole("combobox", { name: /translation language/i });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WordCard language selector", () => {
  it("shows the target language and skips translating a word into its own language", () => {
    render(<WordCard word="water" forms={["water"]} lang="en" tl="en" onTlChange={() => {}} />);
    // Fondue's Select shows the picked language's endonym in its trigger, not a value.
    expect(selector()).toHaveTextContent("English");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("always offers a Google Translate link opening in a new tab, even for English", () => {
    render(<WordCard word="water" forms={["water"]} lang="en" tl="en" onTlChange={() => {}} />);
    const link = screen.getByRole("link", { name: /google translate/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("href")).toContain("translate.google.com");
  });

  it("translates the word into the target language", async () => {
    render(<WordCard word="water" forms={["water"]} lang="en" tl="es" onTlChange={() => {}} />);
    expect(selector()).toHaveTextContent(/español/i);
    expect(await screen.findByText("agua")).toBeInTheDocument();
  });

  it("translates from a non-English source language, tagging the request with sl", async () => {
    render(<WordCard word="water" forms={["water"]} lang="es" tl="fr" onTlChange={() => {}} />);
    expect(await screen.findByText("eau")).toBeInTheDocument();
    const call = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.find(([u]) =>
      String(u).includes("/api/translate/"),
    );
    expect(String(call![0])).toContain("sl=es");
  });

  it("re-translates and reports the pick when the language changes", async () => {
    const onTlChange = vi.fn();
    render(<WordCard word="water" forms={["water"]} lang="en" tl="es" onTlChange={onTlChange} />);
    await screen.findByText("agua");

    // Open the Fondue Select and pick French from the listbox.
    await userEvent.click(selector());
    await userEvent.click(await screen.findByRole("option", { name: /français/i }));

    expect(onTlChange).toHaveBeenCalledWith("fr");
  });

  it("re-translates through a stateful host when the language changes", async () => {
    render(<Host word="water" lang="en" tl="es" />);
    await screen.findByText("agua");

    await userEvent.click(selector());
    await userEvent.click(await screen.findByRole("option", { name: /français/i }));

    expect(await screen.findByText("eau")).toBeInTheDocument();
  });
});

// A dt=1 fetch stub that glosses each casing from a lookup table of senses.
function mockDict(senses: Record<string, string[]>) {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(String(url), "http://localhost");
    const form = decodeURIComponent(u.pathname.split("/api/translate/")[1] ?? "");
    const s = senses[form] ?? [];
    return new Response(JSON.stringify({ word: form, tl: "en", translation: form, senses: s }));
  });
}

// The workspace renders this frame before the lookup lands, so the hero row is
// already its settled height and the browser below it never gets shoved down.
describe("WordCard pending", () => {
  it("holds the whole frame, glossing nothing, until the forms arrive", () => {
    const { rerender } = render(
      <WordCard word="water" forms={null} lang="es" tl="en" onTlChange={() => {}} />,
    );
    expect(screen.getByRole("region", { name: /meaning of water/i })).toBeInTheDocument();
    expect(selector()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /google translate/i })).toBeInTheDocument();
    expect(screen.getByText("Translating…")).toBeInTheDocument();
    // Nothing is known to be translatable yet — the word may not even be a word.
    expect(fetch).not.toHaveBeenCalled();

    rerender(<WordCard word="water" forms={["water"]} lang="es" tl="en" onTlChange={() => {}} />);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/translate/water"), expect.anything());
  });
});

describe("WordCard case-homographs", () => {
  it("shows a distinct gloss for each casing", async () => {
    vi.stubGlobal("fetch", mockDict({ Essen: ["food", "meal"], essen: ["to eat", "dine"] }));
    render(<WordCard word="Essen" forms={["Essen", "essen"]} lang="de" tl="en" onTlChange={() => {}} />);
    // Both glosses and the lowercase casing label appear (the noun label doubles the hero).
    expect(await screen.findByText("food, meal")).toBeInTheDocument();
    expect(await screen.findByText("to eat, dine")).toBeInTheDocument();
    expect(screen.getByText("essen")).toBeInTheDocument();
  });

  it("collapses to one gloss when the casings mean the same thing", async () => {
    // "wer"/"Wer" both gloss to "who" — no distinct sense, so only one line shows.
    vi.stubGlobal("fetch", mockDict({ Wer: ["who"], wer: ["who"] }));
    render(<WordCard word="Wer" forms={["Wer", "wer"]} lang="de" tl="en" onTlChange={() => {}} />);
    expect(await screen.findByText("who")).toBeInTheDocument();
    expect(screen.getAllByText("who")).toHaveLength(1);
    expect(screen.queryByText("wer")).not.toBeInTheDocument();
  });
});

// A dict-mode stub returning Google's part-of-speech groups for a single-casing word.
function mockGroups(groups: { pos: string; terms: string[] }[], translation: string) {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(String(url), "http://localhost");
    const word = decodeURIComponent(u.pathname.split("/api/translate/")[1] ?? "");
    return new Response(JSON.stringify({ word, tl: "en", translation, senses: [], groups }));
  });
}

describe("WordCard multi-sense words", () => {
  // Italian "solo": adjective "only/alone" and adverb "just" — one word, two readings.
  it("lists a gloss per part of speech when a word reads as more than one", async () => {
    vi.stubGlobal(
      "fetch",
      mockGroups(
        [
          { pos: "adjective", terms: ["only", "alone"] },
          { pos: "adverb", terms: ["just"] },
        ],
        "Alone",
      ),
    );
    render(<WordCard word="solo" forms={["solo"]} lang="it" tl="en" onTlChange={() => {}} />);
    expect(await screen.findByText("only, alone")).toBeInTheDocument();
    expect(screen.getByText("just")).toBeInTheDocument();
    expect(screen.getByText("adjective")).toBeInTheDocument();
    expect(screen.getByText("adverb")).toBeInTheDocument();
  });

  it("keeps a single reading as one unlabelled gloss", async () => {
    vi.stubGlobal("fetch", mockGroups([{ pos: "noun", terms: ["water"] }], "water"));
    render(
      <WordCard word="acqua" forms={["acqua"]} lang="it" tl="en" onTlChange={() => {}} />,
    );
    expect(await screen.findByText("water")).toBeInTheDocument();
    expect(screen.queryByText("noun")).not.toBeInTheDocument();
  });

  it("prefers the dictionary terms over a poor plain translation", async () => {
    // Real case: "acqua" plainly translates to "waterfall", but the dictionary is right.
    vi.stubGlobal("fetch", mockGroups([{ pos: "noun", terms: ["water", "aqua"] }], "waterfall"));
    render(
      <WordCard word="acquario" forms={["acquario"]} lang="it" tl="en" onTlChange={() => {}} />,
    );
    expect(await screen.findByText("water, aqua")).toBeInTheDocument();
    expect(screen.queryByText("waterfall")).not.toBeInTheDocument();
  });

  it("falls back to the plain gloss when there is no dictionary entry", async () => {
    vi.stubGlobal("fetch", mockGroups([], "Milan"));
    render(
      <WordCard word="Milano" forms={["Milano"]} lang="it" tl="en" onTlChange={() => {}} />,
    );
    expect(await screen.findByText("Milan")).toBeInTheDocument();
  });

  // The spinner row is shorter than the gloss, so without a reserved line box the card
  // shrinks the moment a translation lands and jolts everything below it.
  it("reserves the gloss's line box while translating", async () => {
    vi.stubGlobal("fetch", mockGroups([{ pos: "noun", terms: ["sky"] }], "sky"));
    render(
      <WordCard word="cielo" forms={["cielo"]} lang="it" tl="en" onTlChange={() => {}} />,
    );
    const spinner = screen.getByText("Translating…").closest("div.Loading");
    expect(spinner).toHaveClass("tw-min-h-[var(--typography-line-height-loose)]");
    // Not a nested live region: the card's own wrapper announces this already.
    expect(spinner).not.toHaveAttribute("role");
    expect((await screen.findByText("sky")).style.lineHeight).toBe(
      "var(--typography-line-height-loose)",
    );
  });

  it("asks for the dictionary block, which is what carries the readings", async () => {
    vi.stubGlobal("fetch", mockGroups([{ pos: "noun", terms: ["need"] }], "need"));
    // A word no other test looks up — the gloss cache is module-level, by design.
    render(
      <WordCard word="bisogno" forms={["bisogno"]} lang="it" tl="en" onTlChange={() => {}} />,
    );
    await screen.findByText("need");
    const call = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls[0]!;
    expect(String(call[0])).toContain("dict=1");
  });
});
