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
  it("exposes both tabs with layers selected by default", () => {
    render(<Workspace initialWord="love" />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);

    const layers = screen.getByRole("tab", { name: "layers" });
    const graph = screen.getByRole("tab", { name: "graph" });
    expect(layers).toHaveAttribute("aria-selected", "true");
    expect(graph).toHaveAttribute("aria-selected", "false");
  });

  it("shows the active tab's panel, linked back to that tab", () => {
    render(<Workspace initialWord="love" />);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("layers view");
    expect(panel).toHaveAccessibleName(/layers/i);
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

    screen.getByRole("tab", { name: "layers" }).focus();
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
