// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Workspace from "./Workspace";

// Isolate the tab machinery + search box from the data-fetching child views.
vi.mock("./Explorer", () => ({ default: () => <div>explorer view</div> }));
vi.mock("./LayersView", () => ({ default: () => <div>layers view</div> }));

function mockFetch() {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/api/word/")) {
      const word = decodeURIComponent(u.split("/api/word/")[1]!);
      if (word === "missing") return new Response("no", { status: 404 });
      return new Response(
        JSON.stringify({
          word,
          senses: [],
          defines: [],
          usedBy: [],
          pageRank: 0,
          rank: 1,
          inKernel: false,
          componentSize: 1,
          depth: 1,
          layerCount: 3,
        }),
        { status: 200 },
      );
    }
    if (u.includes("/api/suggest")) {
      const q = new URL(u, "http://localhost").searchParams.get("q") ?? "";
      const matches = ["care", "cat", "carbon"].filter((w) => w.startsWith(q.toLowerCase()));
      return new Response(JSON.stringify(matches), { status: 200 });
    }
    return new Response("no", { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Workspace", () => {
  it("puts a single search box, in a search landmark, above the tabs", () => {
    render(<Workspace initialWord="love" />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /look up a word/i })).toBeInTheDocument();
    // one shared search box for both tabs, not one per tab
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

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

  it("offers a debounced typeahead that looks up the picked word", async () => {
    const user = userEvent.setup();
    render(<Workspace initialWord="love" />);
    await screen.findByRole("button", { name: "explore" }); // initial lookup settled

    const input = screen.getByRole("combobox", { name: /look up a word/i });
    await user.clear(input);
    await user.type(input, "ca");
    await user.click(await screen.findByRole("option", { name: "care" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/care")),
    );
  });

  it("announces an unknown word through an alert", async () => {
    const user = userEvent.setup();
    render(<Workspace initialWord="love" />);
    await screen.findByRole("button", { name: "explore" }); // initial lookup settled

    const input = screen.getByRole("combobox", { name: /look up a word/i });
    await user.clear(input);
    await user.type(input, "missing{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not in this dictionary/i);
  });
});
