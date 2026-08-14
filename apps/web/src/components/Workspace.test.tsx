// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
    // The card's translation; its leading term is what a language swap carries over.
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

  // The page opens ready to be typed into, on the one thing it is for.
  it("opens with the search box focused and its word selected", async () => {
    render(<Workspace />);
    const box = screen.getByRole("combobox", { name: /look up a word/i }) as HTMLInputElement;
    expect(box).toHaveFocus();
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, box.value.length]);
    // Selected, so the first keystroke asks for a different word rather than editing this
    // one. Typed without a click, which is the point: nothing was touched to get here.
    await userEvent.setup().keyboard("cat");
    expect(box.value).toBe("cat");
  });

  // The lookup echoes the corpus's casing back into the field, which collapses the
  // selection; without re-selecting, half the languages would open only half-ready.
  it("keeps the word selected across the lookup that recases it", async () => {
    window.history.replaceState(null, "", "/?source=de&word=plädoyer");
    render(<Workspace />);
    const box = screen.getByRole("combobox", { name: /look up a word/i }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("Plädoyer"));
    expect(box).toHaveFocus();
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, "Plädoyer".length]);
  });

  it("renders the band browser beneath the search box", () => {
    render(<Workspace />);
    expect(screen.getByText("band browser")).toBeInTheDocument();
  });

  // The bands still steer the browser below; the card just doesn't restate them.
  // The card carries no visible word either, so it is found by its region label.
  it("renders a card for the looked-up word, without band metadata", async () => {
    render(<Workspace />);
    const card = await screen.findByRole("region", { name: /meaning of water/i });
    expect(within(card).queryByText("Top 1,000")).not.toBeInTheDocument();
    expect(within(card).queryByText(/A1 · Beginner/)).not.toBeInTheDocument();
  });

  // The level belongs beside the word, not in the card: in Frequency view it is the only
  // place a CEFR band shows at all, and it is what the translation's badges compare against.
  it("trails the looked-up word with its CEFR level, inside the search field", async () => {
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i });
    const search = screen.getByRole("search");
    expect(within(search).getByRole("img", { name: "A1 · Beginner · rank 1" })).toBeInTheDocument();
  });

  // Sitting against the text, a stale level reads as a claim about what is being typed.
  it("withholds the level the moment the field stops holding that word", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("img", { name: /A1/ });

    await user.type(screen.getByRole("combobox", { name: /look up a word/i }), "x");
    expect(screen.queryByRole("img", { name: /A1/ })).not.toBeInTheDocument();
  });

  it("shows no level at all when the lookup fails", async () => {
    window.history.replaceState(null, "", "/?source=en&word=missing");
    render(<Workspace />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("switches source language and looks its default word up in that dictionary", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i }); // English default settled
    await user.click(screen.getByRole("combobox", { name: /source language/i }));
    await user.click(await screen.findByRole("option", { name: /Español/ }));
    expect(await screen.findByRole("region", { name: /meaning of agua/i })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/agua?source=es"));
  });

  // jsdom's navigator.language is en-US, so the browser is a reader of English
  // throughout — which is what the corporate-laptop case looks like abroad.
  describe("the languages a first-time visitor lands on", () => {
    // The mirrored URL, not the translate fetch: the word card caches translations across
    // renders, so an earlier test having asked for the same pair spares the request.
    const settlesOn = (source: string, target: string) =>
      waitFor(() => {
        const p = new URLSearchParams(window.location.search);
        expect([p.get("source"), p.get("target")]).toEqual([source, target]);
      });

    it("studies the language of the country the client is in", async () => {
      render(<Workspace country="ES" />);
      expect(await screen.findByRole("region", { name: /meaning of agua/i })).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/agua?source=es"));
      await settlesOn("es", "en");
    });

    it("studies English where no language it indexes is spoken", async () => {
      render(<Workspace country="JP" />);
      expect(await screen.findByRole("region", { name: /meaning of water/i })).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/water?source=en"));
    });

    // The pair the app used to open on for an English browser, which translated a word
    // into its own language.
    it("never translates a word into the language being studied", async () => {
      render(<Workspace />);
      await screen.findByRole("region", { name: /meaning of water/i });
      await settlesOn("en", "es");
    });

    it("yields to a language the visitor picked before", async () => {
      localStorage.setItem("eigenlex:source", "it");
      render(<Workspace country="ES" />);
      expect(await screen.findByRole("region", { name: /meaning of acqua/i })).toBeInTheDocument();
    });

    it("yields to a shared deeplink", async () => {
      window.history.replaceState(null, "", "/?source=de&word=wasser&target=en");
      render(<Workspace country="ES" />);
      expect(await screen.findByRole("region", { name: /meaning of wasser/i })).toBeInTheDocument();
      await settlesOn("de", "en");
    });
  });

  it("moves the target aside when the visitor studies the language it translated into", async () => {
    const user = userEvent.setup();
    render(<Workspace />); // opens on en → es
    await screen.findByRole("region", { name: /meaning of water/i });

    await user.click(screen.getByRole("combobox", { name: /source language/i }));
    await user.click(await screen.findByRole("option", { name: /Español/ }));

    await waitFor(() => {
      const p = new URLSearchParams(window.location.search);
      expect(p.get("source")).toBe("es");
      expect(p.get("target")).toBe("en");
    });
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

  // A blank word is not a wait, or the card would spin for good. The frame follows
  // `loading`, so a wait that never ends is a frame that never goes.
  it("stops waiting when the deeplink carries nothing to look up", async () => {
    window.history.replaceState(null, "", "/?source=en&word=%20");
    render(<Workspace />);
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: /meaning of/i })).not.toBeInTheDocument(),
    );
  });

  it("drops the frame again when the word turns out not to exist", async () => {
    window.history.replaceState(null, "", "/?source=en&word=missing");
    render(<Workspace />);
    expect(screen.getByRole("region", { name: /meaning of missing/i })).toBeInTheDocument();

    await screen.findByRole("alert");
    expect(screen.queryByRole("region", { name: /meaning of/i })).not.toBeInTheDocument();
  });

  // There is no submit button: settling on a word is the ask.
  it("looks a word up once typing settles on one the corpus knows", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i }); // initial lookup settled

    const input = screen.getByRole("combobox", { name: /look up a word/i });
    await user.clear(input);
    await user.type(input, "cat");

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/cat")));
    // The suggestions stay up — they are also the way on to a longer word.
    expect(screen.getByRole("option", { name: "cat" })).toBeInTheDocument();
  });

  // A prefix is not an ask: "ca" is no word, so nothing is looked up and nothing fails.
  it("stays quiet while the typed text is only a prefix", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i });

    const input = screen.getByRole("combobox", { name: /look up a word/i });
    await user.clear(input);
    await user.type(input, "ca");
    await screen.findByRole("option", { name: "care" }); // suggestions landed

    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/word/ca?"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  const swapButton = () => screen.getByRole("button", { name: /swap the source and target/i });

  it("swaps the pair and carries the word over as its own translation", async () => {
    window.history.replaceState(null, "", "/?source=de&word=wasser&target=en");
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByText("water, aqua"); // the translation the swap will land on

    await user.click(swapButton());

    await waitFor(() => {
      const p = new URLSearchParams(window.location.search);
      expect(p.get("source")).toBe("en");
      expect(p.get("target")).toBe("de");
      expect(p.get("word")).toBe("water");
    });
  });

  // Only the six indexed languages have a word list to browse.
  it("refuses to swap into a language that cannot be studied", async () => {
    window.history.replaceState(null, "", "/?source=de&word=wasser&target=ja");
    const user = userEvent.setup();
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of wasser/i });

    expect(swapButton()).toHaveAttribute("aria-disabled", "true");
    await user.click(swapButton());
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("source")).toBe("de");
    });
  });

  it("restores the source language and word from the URL", async () => {
    window.history.replaceState(null, "", "/?source=es&word=agua");
    render(<Workspace />);
    expect(await screen.findByRole("region", { name: /meaning of agua/i })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/word/agua?source=es"));
  });

  it("reflects the looked-up word and language in the URL", async () => {
    render(<Workspace />);
    await screen.findByRole("region", { name: /meaning of water/i });
    await waitFor(() => {
      const p = new URLSearchParams(window.location.search);
      expect(p.get("source")).toBe("en");
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
