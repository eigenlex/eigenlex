// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Explorer from "./Explorer";
import type { EgoGraph, WordInfo } from "@/lib/types";

// next/dynamic would lazy-load the WebGL GraphView; swap it for a stub.
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="graphview" />,
}));

const wordInfo = (word: string): WordInfo => ({
  word,
  senses: [`the sense of ${word}`],
  defines: ["care"],
  usedBy: ["adore"],
  pageRank: 0.01,
  rank: 3,
  inKernel: false,
  componentSize: 1,
  depth: 2,
  layerCount: 5,
});

const ego = (word: string): EgoGraph => ({
  focus: word,
  nodes: [
    { id: word, kind: "focus", score: 1, depth: 2 },
    { id: "care", kind: "defines", score: 0.5, depth: 1 },
  ],
  edges: [{ source: word, target: "care" }],
});

function mockFetch() {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/api/word/")) {
      const term = decodeURIComponent(u.split("/api/word/")[1]!);
      if (term === "missing") return new Response("no", { status: 404 });
      return new Response(JSON.stringify(wordInfo(term)), { status: 200 });
    }
    if (u.includes("/api/ego/")) {
      const term = decodeURIComponent(u.split("/api/ego/")[1]!);
      return new Response(JSON.stringify(ego(term)), { status: 200 });
    }
    return new Response("no", { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Explorer", () => {
  it("gives the search input an accessible name and a search landmark", async () => {
    render(<Explorer initialWord="love" />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /look up a word/i })).toBeInTheDocument();
    await screen.findByRole("heading", { name: "love" }); // initial load settled
  });

  it("loads the initial word and renders its details and neighbor chips", async () => {
    render(<Explorer initialWord="love" />);
    expect(await screen.findByRole("heading", { name: "love" })).toBeInTheDocument();
    expect(screen.getByText("the sense of love")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "care" })).toBeInTheDocument(); // defined using
    expect(screen.getByRole("button", { name: "adore" })).toBeInTheDocument(); // used to define
  });

  it("announces an unknown word through an alert", async () => {
    render(<Explorer initialWord="missing" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not in this dictionary/i);
  });

  it("navigates to a neighbor when its chip is activated", async () => {
    const user = userEvent.setup();
    render(<Explorer initialWord="love" />);
    await screen.findByRole("heading", { name: "love" });

    await user.click(screen.getByRole("button", { name: "care" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/care")),
    );
    expect(await screen.findByRole("heading", { name: "care" })).toBeInTheDocument();
  });

  it("submitting the form looks up the typed word", async () => {
    const user = userEvent.setup();
    render(<Explorer initialWord="love" />);
    await screen.findByRole("heading", { name: "love" });

    const input = screen.getByRole("textbox", { name: /look up a word/i });
    await user.clear(input);
    await user.type(input, "care{Enter}");
    expect(await screen.findByRole("heading", { name: "care" })).toBeInTheDocument();
  });
});
