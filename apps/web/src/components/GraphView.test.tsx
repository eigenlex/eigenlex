// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GraphView from "./GraphView";
import type { EgoGraph } from "@/lib/types";

// The subset of graphology the fake renderer reads back.
type FakeGraph = {
  hasNode(node: string): boolean;
  getNodeAttributes(node: string): { x: number; y: number; size: number; label: string };
};

// Sigma needs a GPU; stand in a fake renderer whose geometry helpers are
// consistent enough to drive the component's own DOM hit-testing. graphology is
// left real — it runs fine without one. `toViewport` spreads nodes far apart so
// their discs never overlap, letting a click resolve to exactly one node.
const holder = vi.hoisted(() => ({
  graph: null as FakeGraph | null,
  toViewport: (x: number, y: number) => ({ x: 500 + x * 100, y: 500 + y * 100 }),
}));
vi.mock("sigma", () => ({
  default: class {
    graph: FakeGraph;
    constructor(graph: FakeGraph) {
      this.graph = graph;
      holder.graph = graph;
    }
    setSetting() {}
    getSetting(key: string) {
      return ({ labelSize: 14, labelWeight: "400", labelFont: "sans-serif" } as Record<
        string,
        unknown
      >)[key];
    }
    getNodeDisplayData(node: string) {
      return this.graph.hasNode(node) ? { ...this.graph.getNodeAttributes(node) } : undefined;
    }
    framedGraphToViewport(data: { x: number; y: number }) {
      return holder.toViewport(data.x, data.y);
    }
    scaleSize(size: number) {
      return size;
    }
    setCustomBBox() {
      return this;
    }
    refresh() {}
    kill() {}
  },
}));
vi.mock("sigma/rendering", () => ({ EdgeArrowProgram: class {}, drawDiscNodeLabel: () => {} }));

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
    const el = screen.getByRole("img");

    // Click at a node's viewport position (jsdom's getBoundingClientRect is all
    // zeros, so client coords map straight through to the component).
    const clickNode = (id: string) => {
      const { x, y } = holder.graph!.getNodeAttributes(id);
      const p = holder.toViewport(x, y);
      fireEvent.click(el, { clientX: p.x, clientY: p.y });
    };

    clickNode("care");
    expect(onSelect).toHaveBeenCalledWith("care");
    clickNode("love"); // the focus node
    expect(onSelect).toHaveBeenCalledTimes(1); // focus click did nothing
  });
});
