import { describe, expect, it } from "vitest";
import { packRows } from "./WordChips";

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
