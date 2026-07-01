// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Workspace from "./Workspace";

// Isolate the tab machinery from the data-fetching child views.
vi.mock("./Explorer", () => ({ default: () => <div>explorer view</div> }));
vi.mock("./LayersView", () => ({ default: () => <div>layers view</div> }));

afterEach(cleanup);

describe("Workspace tabs", () => {
  it("exposes a labelled tablist with layers selected by default", () => {
    render(<Workspace initialWord="love" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["layers", "graph"]);

    const [layers, graph] = tabs;
    expect(layers).toHaveAttribute("aria-selected", "true");
    expect(graph).toHaveAttribute("aria-selected", "false");
    // Roving tabindex: only the selected tab is in the tab order.
    expect(layers).toHaveAttribute("tabindex", "0");
    expect(graph).toHaveAttribute("tabindex", "-1");
  });

  it("links the panel to the active tab", () => {
    render(<Workspace initialWord="love" />);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-layers");
    expect(panel).toHaveTextContent("layers view");
  });

  it("switches views on click", async () => {
    const user = userEvent.setup();
    render(<Workspace initialWord="love" />);
    await user.click(screen.getByRole("tab", { name: "graph" }));
    expect(screen.getByRole("tab", { name: "graph" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("explorer view");
  });

  it("moves between tabs with arrow keys, wrapping, and Home/End", async () => {
    const user = userEvent.setup();
    render(<Workspace initialWord="love" />);
    const layers = screen.getByRole("tab", { name: "layers" });

    layers.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "graph" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "graph" })).toHaveFocus();

    await user.keyboard("{ArrowRight}"); // wraps back to the first
    expect(screen.getByRole("tab", { name: "layers" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "graph" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "layers" })).toHaveAttribute("aria-selected", "true");
  });
});
