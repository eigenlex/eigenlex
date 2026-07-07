// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LayersView from "./LayersView";
import type { WordInfo } from "@/lib/types";

// "love" sits in layer depth 1 of a 3-layer world.
const love: WordInfo = {
  word: "love",
  senses: [],
  defines: [],
  usedBy: [],
  pageRank: 0,
  rank: 1,
  inKernel: false,
  componentSize: 1,
  depth: 1,
  layerCount: 3,
};

function mockFetch() {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.endsWith("/api/layers")) {
      return new Response(JSON.stringify({ layerCount: 3, sizes: [5, 3, 2] }), { status: 200 });
    }
    if (u.includes("/api/layer/")) {
      const n = Number(u.split("/api/layer/")[1]);
      const words = n === 1 ? ["love", "other"] : [`w${n}a`, `w${n}b`];
      return new Response(JSON.stringify({ depth: n, layerCount: 3, words }), { status: 200 });
    }
    return new Response("no", { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch());
  // jsdom has no layout; the spotlight scroll needs a stub to be observable.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LayersView", () => {
  it("marks the searched word as the current chip in its layer", async () => {
    render(<LayersView info={love} onSelect={() => {}} />);
    const anchor = await screen.findByRole("button", { name: "love" });
    expect(anchor).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "other" })).not.toHaveAttribute("aria-current");
  });

  it("looks up a word when its chip in the layer is picked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<LayersView info={love} onSelect={onSelect} />);
    await user.click(await screen.findByRole("button", { name: "other" }));
    expect(onSelect).toHaveBeenCalledWith("other");
  });

  it("scrolls the searched word into view within its layer", async () => {
    render(<LayersView info={love} onSelect={() => {}} />);
    const anchor = await screen.findByRole("button", { name: "love" });
    await waitFor(() => expect(anchor.scrollIntoView).toHaveBeenCalled());
  });

  it("renders the rail as a listbox with the active layer selected", async () => {
    render(<LayersView info={love} onSelect={() => {}} />);
    const listbox = await screen.findByRole("listbox", { name: /layers/i });
    expect(screen.getAllByRole("option")).toHaveLength(3);
    // depth 1 is active -> aria-activedescendant and the selected option agree.
    expect(listbox).toHaveAttribute("aria-activedescendant", "rung-1");
    expect(screen.getByRole("option", { selected: true })).toHaveAttribute("id", "rung-1");
  });

  it("shows a spinner while the first word is being looked up", () => {
    render(<LayersView info={null} onSelect={() => {}} loading />);
    expect(screen.getByText(/Loading layers/)).toBeInTheDocument();
  });

  it("walks layers with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<LayersView info={love} onSelect={() => {}} />);
    const listbox = await screen.findByRole("listbox", { name: /layers/i });

    listbox.focus();
    await user.keyboard("{ArrowUp}"); // toward more advanced -> depth 2
    await waitFor(() =>
      expect(screen.getByRole("listbox", { name: /layers/i })).toHaveAttribute(
        "aria-activedescendant",
        "rung-2",
      ),
    );
    expect(await screen.findByRole("button", { name: "w2a" })).toBeInTheDocument();

    await user.keyboard("{End}"); // jump to the most basic layer, depth 0
    await waitFor(() =>
      expect(screen.getByRole("listbox", { name: /layers/i })).toHaveAttribute(
        "aria-activedescendant",
        "rung-0",
      ),
    );
  });
});
