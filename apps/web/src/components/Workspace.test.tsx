// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Workspace from "./Workspace";

// Isolate the search box + lookup wiring from the data-fetching band browser.
vi.mock("./BandBrowser", () => ({ default: () => <div>band browser</div> }));

function mockFetch() {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/api/word/")) {
      const path = new URL(u, "http://localhost").pathname;
      const word = decodeURIComponent(path.split("/api/word/")[1]!);
      if (word === "missing") return new Response("no", { status: 404 });
      return new Response(
        JSON.stringify({
          word,
          rank: 1,
          freq: { key: "1", label: "Top 1,000" },
          cefr: { key: "A1", label: "A1 · Beginner" },
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
  localStorage.clear();
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Workspace", () => {
  it("puts a single search box, in a search landmark, above the view", () => {
    render(<Workspace />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /look up a word/i })).toBeInTheDocument();
    // one shared search box, not one per view
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("renders the band browser beneath the search box", () => {
    render(<Workspace />);
    expect(screen.getByText("band browser")).toBeInTheDocument();
  });

  it("shows the looked-up word's frequency and CEFR bands", async () => {
    render(<Workspace />);
    expect(await screen.findByRole("heading", { name: "water" })).toBeInTheDocument();
    expect(screen.getByText("Top 1,000")).toBeInTheDocument();
    expect(screen.getByText("A1 · Beginner")).toBeInTheDocument();
  });

  it("switches source language and looks its default word up in that dictionary", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("heading", { name: "water" }); // English default settled
    await user.click(screen.getByRole("tab", { name: "Español" }));
    expect(await screen.findByRole("heading", { name: "agua" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/agua?lang=es"));
  });

  it("lets the user switch between the Frequency and CEFR views", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    const cefr = screen.getByRole("tab", { name: "CEFR" });
    expect(cefr).toHaveAttribute("aria-selected", "false");
    await user.click(cefr);
    expect(cefr).toHaveAttribute("aria-selected", "true");
  });

  it("credits the active view's data source", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    expect(screen.getByRole("link", { name: "SUBTLEX-US" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "CEFR" }));
    expect(screen.getByRole("link", { name: "CEFR-J" })).toBeInTheDocument();
  });

  it("offers a debounced typeahead that looks up the picked word", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("button", { name: "look up" }); // initial lookup settled

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
    render(<Workspace />);
    await screen.findByRole("button", { name: "look up" }); // initial lookup settled

    const input = screen.getByRole("combobox", { name: /look up a word/i });
    await user.clear(input);
    await user.type(input, "missing{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not in this dictionary/i);
  });
});
