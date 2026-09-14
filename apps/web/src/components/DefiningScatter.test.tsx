// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DefiningScatter, { tipStyle } from "./DefiningScatter";

// `paint` bails on the zero-size wrap that jsdom reports, before it reaches the context
// stub in test/setup.ts. That is the point: everything outside the canvas — the label, the
// caption, the fold — is what a screen reader and a text browser get, and it has to stand
// up without anything ever being drawn.
const points = {
  levels: "11-3" + "7".repeat(6),
  words: ["o", "que", "john", "água", "olá", "uau", "a", "b", "c", "d"],
};

/** jsdom has no layout, so the caption's width test has to be told the answer. */
const screenWidth = (wide: boolean) =>
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: wide,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));

beforeEach(() => {
  localStorage.clear();
  screenWidth(true);
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

  it("keeps the axes and the misreading out of the fold", async () => {
    render(<DefiningScatter source="pt" anchorWord={null} onSelect={() => {}} />);
    const fig = await screen.findByRole("figure");
    // Whatever else folds away, a reader must not be left thinking height is difficulty.
    const summary = fig.querySelector("summary")!;
    expect(summary.textContent).toContain("Frequency across, defining level up");
    expect(summary.textContent).toContain("not a difficulty scale");
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

// The caption is what teaches the figure, and dead weight once it has. It starts open
// where there is room, starts folded on a phone, and remembers either way.
describe("the caption's fold", () => {
  const openState = async () => (await screen.findByRole("figure")).querySelector("details")!;

  it("starts open on a wide screen", async () => {
    screenWidth(true);
    render(<DefiningScatter source="pt" anchorWord={null} onSelect={() => {}} />);
    expect((await openState()).open).toBe(true);
  });

  it("starts folded on a phone", async () => {
    screenWidth(false);
    render(<DefiningScatter source="pt" anchorWord={null} onSelect={() => {}} />);
    expect((await openState()).open).toBe(false);
  });

  it("lets a remembered choice beat the screen width", async () => {
    screenWidth(false);
    localStorage.setItem("word-bands:defining-caption", "open");
    render(<DefiningScatter source="pt" anchorWord={null} onSelect={() => {}} />);
    expect((await openState()).open).toBe(true);
  });

  it("writes nothing until the reader touches it", async () => {
    render(<DefiningScatter source="pt" anchorWord={null} onSelect={() => {}} />);
    await openState();
    expect(localStorage.getItem("word-bands:defining-caption")).toBeNull();
  });

  it("remembers a fold", async () => {
    const details = await (async () => {
      render(<DefiningScatter source="pt" anchorWord={null} onSelect={() => {}} />);
      return openState();
    })();
    details.open = false;
    fireEvent(details, new Event("toggle"));
    await waitFor(() =>
      expect(localStorage.getItem("word-bands:defining-caption")).toBe("closed"),
    );
  });
});
