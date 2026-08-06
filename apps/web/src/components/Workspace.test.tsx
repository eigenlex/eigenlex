// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import Workspace from "./Workspace";

// Isolate the search box + lookup wiring from the data-fetching band browser, but
// still render the view toggle it hosts (Workspace owns it, via the viewControl slot).
// The "pick word" button stands in for the browser's chips and prev/next steppers.
vi.mock("./BandBrowser", () => ({
  default: ({
    viewControl,
    onSelect,
  }: {
    viewControl?: ReactNode;
    onSelect: (word: string) => void;
  }) => (
    <div>
      band browser{viewControl}
      <button type="button" onClick={() => onSelect("Plädoyer")}>
        pick word
      </button>
    </div>
  ),
}));

// Words the corpus stores capitalized — the API answers with that casing, not the
// lowercased lookup key.
const DISPLAY: Record<string, string> = { plädoyer: "Plädoyer" };

function mockFetch() {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/api/word/")) {
      const path = new URL(u, "http://localhost").pathname;
      const word = decodeURIComponent(path.split("/api/word/")[1]!);
      if (word === "missing") return new Response("no", { status: 404 });
      const display = DISPLAY[word] ?? word;
      return new Response(
        JSON.stringify({
          word: display,
          forms: [display],
          rank: 1,
          freq: { key: "1", label: "Top 1,000" },
          cefr: { key: "A1", label: "A1 · Beginner" },
        }),
        { status: 200 },
      );
    }
    // The card's gloss; its leading term is what a language swap carries over.
    if (u.includes("/api/translate/")) {
      return new Response(
        JSON.stringify({
          translation: "water",
          groups: [{ pos: "noun", terms: ["water", "aqua"] }],
        }),
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
  // The workspace mirrors state into the URL; reset it so tests don't leak scenarios.
  window.history.replaceState(null, "", "/");
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
    expect(screen.getAllByRole("combobox", { name: /look up a word/i })).toHaveLength(1);
  });

  it("renders the band browser beneath the search box", () => {
    render(<Workspace />);
    expect(screen.getByText("band browser")).toBeInTheDocument();
  });

  // The bands still steer the browser below; the card just doesn't restate them.
  // The card carries no visible word either, so it is found by its region label.
  it("renders a card for the looked-up word, without band metadata", async () => {
    render(<Workspace />);
    expect(await screen.findByRole("region", { name: /meaning of water/i })).toBeInTheDocument();
    expect(screen.queryByText("Top 1,000")).not.toBeInTheDocument();
    expect(screen.queryByText("A1 · Beginner")).not.toBeInTheDocument();
  });

  it("switches source language and looks its default word up in that dictionary", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i }); // English default settled
    await user.click(screen.getByRole("combobox", { name: /source language/i }));
    await user.click(await screen.findByRole("option", { name: /Español/ }));
    expect(await screen.findByRole("region", { name: /meaning of agua/i })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/agua?lang=es"));
  });

  it("lets the user switch between the Frequency and CEFR views", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    const cefr = screen.getByRole("radio", { name: /CEFR/ });
    expect(cefr).toHaveAttribute("aria-checked", "false");
    await user.click(cefr);
    expect(cefr).toHaveAttribute("aria-checked", "true");
  });

  it("credits the active view's data source", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    expect(screen.getByRole("link", { name: "SUBTLEX-US" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /CEFR/ }));
    expect(screen.getByRole("link", { name: "CEFR-J" })).toBeInTheDocument();
  });

  it("offers a debounced typeahead that looks up the picked word", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i }); // initial lookup settled

    const input = screen.getByRole("combobox", { name: /look up a word/i });
    await user.clear(input);
    await user.type(input, "ca");
    await user.click(await screen.findByRole("option", { name: "care" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/care")),
    );
  });

  it("puts the browsed word in the search box with its display casing", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i }); // initial lookup settled

    await user.click(screen.getByRole("button", { name: "pick word" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/pl%C3%A4doyer")),
    );
    expect(screen.getByRole("combobox", { name: /look up a word/i })).toHaveValue("Plädoyer");
  });

  // The frame follows `loading`, so the hero row never resizes under the browser.
  it("holds the card's frame from the first paint, before the lookup lands", () => {
    render(<Workspace />);
    expect(screen.getByRole("region", { name: /meaning of water/i })).toBeInTheDocument();
  });

  // A blank word is not a wait, or the card would spin for good.
  it("stops waiting when the deeplink carries nothing to look up", async () => {
    window.history.replaceState(null, "", "/?lang=en&word=%20");
    render(<Workspace />);
    await waitFor(() => expect(screen.getByRole("button", { name: "look up" })).toBeEnabled());
    expect(screen.queryByRole("region", { name: /meaning of/i })).not.toBeInTheDocument();
  });

  it("drops the frame again when the word turns out not to exist", async () => {
    window.history.replaceState(null, "", "/?lang=en&word=missing");
    render(<Workspace />);
    expect(screen.getByRole("region", { name: /meaning of missing/i })).toBeInTheDocument();

    await screen.findByRole("alert");
    expect(screen.queryByRole("region", { name: /meaning of/i })).not.toBeInTheDocument();
  });

  // The label is what fixes the button's width, so it has to survive the wait.
  it("keeps the submit button's label while a lookup is in flight", async () => {
    render(<Workspace />);
    expect(screen.getByRole("button", { name: "look up" })).toBeDisabled();
    await screen.findByRole("region", { name: /meaning of water/i });
    expect(screen.getByRole("button", { name: "look up" })).toBeEnabled();
  });

  const swapButton = () => screen.getByRole("button", { name: /swap the study and translation/i });

  it("swaps the pair and carries the word over as its own translation", async () => {
    window.history.replaceState(null, "", "/?lang=de&word=wasser&tl=en");
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByText("water, aqua"); // the gloss the swap will land on

    await user.click(swapButton());

    await waitFor(() => {
      const p = new URLSearchParams(window.location.search);
      expect(p.get("lang")).toBe("en");
      expect(p.get("tl")).toBe("de");
      expect(p.get("word")).toBe("water");
    });
  });

  // Only the six indexed languages have a word list to browse.
  it("refuses to swap into a language that cannot be studied", async () => {
    window.history.replaceState(null, "", "/?lang=de&word=wasser&tl=ja");
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of wasser/i });

    expect(swapButton()).toHaveAttribute("aria-disabled", "true");
    await user.click(swapButton());
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("lang")).toBe("de");
    });
  });

  it("restores the source language and word from the URL", async () => {
    window.history.replaceState(null, "", "/?lang=es&word=agua");
    render(<Workspace />);
    expect(await screen.findByRole("region", { name: /meaning of agua/i })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/agua?lang=es"));
  });

  it("reflects the looked-up word and language in the URL", async () => {
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i });
    await waitFor(() => {
      const p = new URLSearchParams(window.location.search);
      expect(p.get("lang")).toBe("en");
      expect(p.get("word")).toBe("water");
      expect(p.get("view")).toBe("freq");
    });
  });

  it("announces an unknown word through an alert", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i }); // initial lookup settled

    const input = screen.getByRole("combobox", { name: /look up a word/i });
    await user.clear(input);
    await user.type(input, "missing{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not in this dictionary/i);
  });
});
