// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WordChips, { packRows } from "./WordChips";

describe("packRows", () => {
  it("packs as many chips per row as fit the width", () => {
    // widths 30 each, gap 4, container 100 -> 30,34,34 = 98 <= 100: 3 per row.
    const starts = packRows(Array(7).fill(30), 100, 4);
    expect(starts).toEqual([0, 3, 6]);
  });

  it("always places at least one chip, even if it overflows the row", () => {
    const starts = packRows([200, 10, 10], 50, 4);
    expect(starts).toEqual([0, 1]); // 200 alone, then 10 + 4 + 10 together
  });

  it("returns no rows for an empty list", () => {
    expect(packRows([], 100, 4)).toEqual([]);
  });

  it("accounts for the inter-chip gap when deciding a break", () => {
    // Two 48-wide chips: 48 + 4 + 48 = 100 fits exactly; a third breaks.
    expect(packRows([48, 48, 48], 100, 4)).toEqual([0, 2]);
  });
});

// jsdom has no layout, so WordChips renders in its fallback (all-chips) mode —
// keyboard moves still flow through the same debounced-select path.
const WORDS = ["the", "be", "water", "mountain", "engine"];

function setup() {
  const onPick = vi.fn();
  render(
    <WordChips
      words={WORDS}
      anchor={null}
      chipClass="chip"
      anchorClass="anchor"
      onPick={onPick}
      label="Words"
    />,
  );
  return { onPick, group: screen.getByRole("group", { name: "Words" }) };
}

afterEach(cleanup);

describe("keyboard selection", () => {
  it("looks the focused word up after a 300ms debounce", () => {
    vi.useFakeTimers();
    try {
      const { onPick, group } = setup();
      fireEvent.keyDown(group, { key: "ArrowRight" }); // active 0 -> 1 ("be")
      vi.advanceTimersByTime(299);
      expect(onPick).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick).toHaveBeenCalledWith("be");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fires once for the settled word when arrows sweep several chips", () => {
    vi.useFakeTimers();
    try {
      const { onPick, group } = setup();
      fireEvent.keyDown(group, { key: "ArrowRight" }); // -> "be"
      vi.advanceTimersByTime(200);
      fireEvent.keyDown(group, { key: "ArrowRight" }); // -> "water", debounce resets
      vi.advanceTimersByTime(200);
      fireEvent.keyDown(group, { key: "ArrowRight" }); // -> "mountain", resets again
      vi.advanceTimersByTime(200);
      expect(onPick).not.toHaveBeenCalled(); // never settled long enough
      vi.advanceTimersByTime(100);
      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick).toHaveBeenCalledWith("mountain");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a pending keyboard select when a chip is clicked", () => {
    vi.useFakeTimers();
    try {
      const { onPick, group } = setup();
      fireEvent.keyDown(group, { key: "ArrowRight" }); // queues "be"
      fireEvent.click(screen.getByRole("button", { name: "water" }));
      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick).toHaveBeenCalledWith("water");
      vi.advanceTimersByTime(300); // the queued "be" must not fire
      expect(onPick).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
