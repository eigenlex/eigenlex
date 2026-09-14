// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DefiningScatter, { tipStyle } from "./DefiningScatter";

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

// The label sat below-right of the cursor and the cursor covered it — a cursor's hotspot
// is its top-left corner, so the glyph occupies exactly the space below and right of the
// point it reports. Above by default, and only below where there is no room above.
describe("the hover label's placement", () => {
  const W = 900;

  it("sits above the cursor, clear of the glyph", () => {
    const st = tipStyle({ x: 100, y: 200 }, W);
    expect(st.transform).toContain("translateY(-100%)");
    expect(Number(st.top)).toBeLessThan(200);
  });

  it("flips below only in the top strip", () => {
    const st = tipStyle({ x: 100, y: 4 }, W);
    expect(st.transform ?? "").not.toContain("translateY");
    // Below the cursor's glyph, not overlapping it.
    expect(Number(st.top)).toBeGreaterThanOrEqual(4 + 22);
  });

  it("flips left near the right edge so it cannot run off", () => {
    expect(tipStyle({ x: 880, y: 200 }, W).transform).toContain("translateX(-100%)");
    expect(tipStyle({ x: 100, y: 200 }, W).transform ?? "").not.toContain("translateX");
  });

  it("can flip on both axes at once", () => {
    const st = tipStyle({ x: 880, y: 4 }, W);
    expect(st.transform).toContain("translateX(-100%)");
    expect(st.transform).not.toContain("translateY");
  });
});
