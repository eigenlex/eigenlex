// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import GraphView from "./GraphView";
import type { EgoGraph } from "@/lib/types";

// Sigma needs WebGL; capture a fake renderer so we can drive its events. graphology
// is left real — it runs fine without a GPU.
const holder = vi.hoisted(() => ({ handlers: {} as Record<string, (p: { node: string }) => void> }));
vi.mock("sigma", () => ({
  default: class {
    constructor() {
      holder.handlers = {};
    }
    setSetting() {}
    on(event: string, cb: (p: { node: string }) => void) {
      holder.handlers[event] = cb;
    }
    refresh() {}
    kill() {}
  },
}));
vi.mock("sigma/rendering", () => ({ EdgeArrowProgram: class {} }));

const ego: EgoGraph = {
  focus: "love",
  nodes: [
    { id: "love", kind: "focus", score: 1, depth: 3 },
    { id: "care", kind: "defines", score: 0.6, depth: 2 },
    { id: "desire", kind: "defines", score: 0.5, depth: 2 },
    { id: "adore", kind: "usedBy", score: 0.4, depth: 4 },
  ],
  edges: [
    { source: "love", target: "care" },
    { source: "love", target: "desire" },
    { source: "adore", target: "love" },
  ],
};

afterEach(cleanup);

describe("GraphView", () => {
  it("exposes the canvas as an image with a summarizing label", () => {
    render(<GraphView ego={ego} onSelect={() => {}} />);
    const img = screen.getByRole("img");
    const label = img.getAttribute("aria-label")!;
    expect(label).toContain('"love"');
    expect(label).toContain("2 words it is defined from"); // care, desire
    expect(label).toContain("1 words it helps define"); // adore
    expect(label).toMatch(/listed as buttons/i); // points to the accessible equivalent
  });

  it("selects a neighbor on click but ignores the focus node", () => {
    const onSelect = vi.fn();
    render(<GraphView ego={ego} onSelect={onSelect} />);
    holder.handlers.clickNode!({ node: "care" });
    expect(onSelect).toHaveBeenCalledWith("care");
    holder.handlers.clickNode!({ node: "love" });
    expect(onSelect).toHaveBeenCalledTimes(1); // focus click did nothing
  });
});
