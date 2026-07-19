// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordCard from "./WordCard";
import type { WordBands } from "@/lib/types";

// The workspace owns the target language now; a tiny stateful host stands in for it so
// picking a language in the card re-renders with the new value, as it does in the app.
function Host({ info, lang, tl: initial }: { info: WordBands; lang: string; tl: string }) {
  const [tl, setTl] = useState(initial);
  return <WordCard info={info} lang={lang} tl={tl} onTlChange={setTl} />;
}

const info: WordBands = {
  word: "water",
  forms: ["water"],
  rank: 384,
  freq: { key: "1", label: "Top 1,000" },
  cefr: { key: "A1", label: "A1 · Beginner" },
};

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
    render(<WordCard info={info} lang="en" tl="en" onTlChange={() => {}} />);
    // Fondue's Select shows the picked language's endonym in its trigger, not a value.
    expect(selector()).toHaveTextContent("English");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("always offers a Google Translate link opening in a new tab, even for English", () => {
    render(<WordCard info={info} lang="en" tl="en" onTlChange={() => {}} />);
    const link = screen.getByRole("link", { name: /google translate/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("href")).toContain("translate.google.com");
  });

  it("translates the word into the target language", async () => {
    render(<WordCard info={info} lang="en" tl="es" onTlChange={() => {}} />);
    expect(selector()).toHaveTextContent(/español/i);
    expect(await screen.findByText("agua")).toBeInTheDocument();
  });

  it("translates from a non-English source language, tagging the request with sl", async () => {
    render(<WordCard info={info} lang="es" tl="fr" onTlChange={() => {}} />);
    expect(await screen.findByText("eau")).toBeInTheDocument();
    const call = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.find(([u]) =>
      String(u).includes("/api/translate/"),
    );
    expect(String(call![0])).toContain("sl=es");
  });

  it("re-translates and reports the pick when the language changes", async () => {
    const onTlChange = vi.fn();
    render(<WordCard info={info} lang="en" tl="es" onTlChange={onTlChange} />);
    await screen.findByText("agua");

    // Open the Fondue Select and pick French from the listbox.
    await userEvent.click(selector());
    await userEvent.click(await screen.findByRole("option", { name: /français/i }));

    expect(onTlChange).toHaveBeenCalledWith("fr");
  });

  it("re-translates through a stateful host when the language changes", async () => {
    render(<Host info={info} lang="en" tl="es" />);
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

describe("WordCard case-homographs", () => {
  const homo = (word: string, forms: string[]): WordBands => ({
    word,
    forms,
    rank: 500,
    freq: { key: "2", label: "1,001–2,000" },
    cefr: { key: "A2", label: "A2 · Elementary" },
  });

  it("shows a distinct gloss for each casing", async () => {
    vi.stubGlobal("fetch", mockDict({ Essen: ["food", "meal"], essen: ["to eat", "dine"] }));
    render(<WordCard info={homo("Essen", ["Essen", "essen"])} lang="de" tl="en" onTlChange={() => {}} />);
    // Both glosses and the lowercase casing label appear (the noun label doubles the hero).
    expect(await screen.findByText("food, meal")).toBeInTheDocument();
    expect(await screen.findByText("to eat, dine")).toBeInTheDocument();
    expect(screen.getByText("essen")).toBeInTheDocument();
  });

  it("collapses to one gloss when the casings mean the same thing", async () => {
    // "wer"/"Wer" both gloss to "who" — no distinct sense, so only one line shows.
    vi.stubGlobal("fetch", mockDict({ Wer: ["who"], wer: ["who"] }));
    render(<WordCard info={homo("Wer", ["Wer", "wer"])} lang="de" tl="en" onTlChange={() => {}} />);
    expect(await screen.findByText("who")).toBeInTheDocument();
    expect(screen.getAllByText("who")).toHaveLength(1);
    expect(screen.queryByText("wer")).not.toBeInTheDocument();
  });
});
