// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordCard from "./WordCard";
import type { WordBands } from "@/lib/types";

const info: WordBands = {
  word: "water",
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
  it("defaults to the browser language (English in jsdom) and skips en→en translation", () => {
    render(<WordCard info={info} lang="en" />);
    // Fondue's Select shows the picked language's endonym in its trigger, not a value.
    expect(selector()).toHaveTextContent("English");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("always offers a Google Translate link opening in a new tab, even for English", () => {
    render(<WordCard info={info} lang="en" />);
    const link = screen.getByRole("link", { name: /google translate/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("href")).toContain("translate.google.com");
  });

  it("uses the stored language and translates the word into it", async () => {
    localStorage.setItem("eigenlex:lang", "es");
    render(<WordCard info={info} lang="en" />);
    expect(selector()).toHaveTextContent(/español/i);
    expect(await screen.findByText("agua")).toBeInTheDocument();
  });

  it("translates from a non-English source language, tagging the request with sl", async () => {
    localStorage.setItem("eigenlex:lang", "fr");
    render(<WordCard info={info} lang="es" />);
    expect(await screen.findByText("eau")).toBeInTheDocument();
    const call = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.find(([u]) =>
      String(u).includes("/api/translate/"),
    );
    expect(String(call![0])).toContain("sl=es");
  });

  it("persists a language change to localStorage and re-translates", async () => {
    localStorage.setItem("eigenlex:lang", "es");
    render(<WordCard info={info} lang="en" />);
    await screen.findByText("agua");

    // Open the Fondue Select and pick French from the listbox.
    await userEvent.click(selector());
    await userEvent.click(await screen.findByRole("option", { name: /français/i }));

    expect(localStorage.getItem("eigenlex:lang")).toBe("fr");
    expect(await screen.findByText("eau")).toBeInTheDocument();
  });
});
