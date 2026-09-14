// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DefiningScatter from "./DefiningScatter";

// jsdom has no 2d context, so `paint` bails at its `if (!ctx) return`. That is the point:
// everything outside the canvas — the label, the caption, the loading state — is what a
// screen reader and a text browser get, and it has to stand up without a drawing surface.
const points = {
  levels: "11-3" + "7".repeat(6),
  words: ["o", "que", "john", "água", "olá", "uau", "a", "b", "c", "d"],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(points), { status: 200 })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DefiningScatter", () => {
  it("names itself with the claim the picture makes, not just its axes", async () => {
    render(<DefiningScatter source="pt" anchorWord="água" onSelect={() => {}} />);
    const img = await screen.findByRole("img");
    const name = img.getAttribute("aria-label") ?? "";
    // 9 of the 10 fixture words carry a level; "john" is the "-".
    expect(name).toContain("9 words plotted");
    expect(name).toContain("spread across every level");
  });

  it("captions the figure without claiming height is difficulty", async () => {
    render(<DefiningScatter source="pt" anchorWord={null} onSelect={() => {}} />);
    const fig = await screen.findByRole("figure");
    expect(fig.textContent).toContain("Height is not difficulty");
    expect(fig.textContent).toContain("D1 at the top");
  });

  it("asks only the active language for its points", async () => {
    render(<DefiningScatter source="pt" anchorWord={null} onSelect={() => {}} />);
    await screen.findByRole("img");
    expect(fetch).toHaveBeenCalledWith("/api/defining?source=pt");
  });
});
