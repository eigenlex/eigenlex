// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes("/api/ego/")) {
        const term = decodeURIComponent(u.split("/api/ego/")[1]!);
        return new Response(JSON.stringify(ego(term)), { status: 200 });
      }
      return new Response("no", { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Explorer", () => {
  it("renders the word's details and neighbor chips", async () => {
    render(<Explorer info={wordInfo("love")} onSelect={() => {}} />);
    expect(screen.getByRole("heading", { name: "love" })).toBeInTheDocument();
    expect(screen.getByText("the sense of love")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "care" })).toBeInTheDocument(); // defined using
    expect(screen.getByRole("button", { name: "adore" })).toBeInTheDocument(); // used to define
    await screen.findByTestId("graphview"); // the neighborhood fetch settles
  });

  it("draws the ego graph once its neighborhood loads", async () => {
    render(<Explorer info={wordInfo("love")} onSelect={() => {}} />);
    expect(await screen.findByTestId("graphview")).toBeInTheDocument();
  });

  it("selects a neighbor when its chip is activated", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Explorer info={wordInfo("love")} onSelect={onSelect} />);
    await screen.findByTestId("graphview");
    await user.click(screen.getByRole("button", { name: "care" }));
    expect(onSelect).toHaveBeenCalledWith("care");
  });

  it("shows nothing to explore before a word is chosen", () => {
    render(<Explorer info={null} onSelect={() => {}} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
