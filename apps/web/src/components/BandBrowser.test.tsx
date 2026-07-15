// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BandBrowser from "./BandBrowser";

const SUMMARY = {
  freq: [
    { key: "1", label: "Top 1,000", count: 1000 },
    { key: "2", label: "1,001–2,000", count: 1000 },
  ],
  cefr: [
    { key: "A1", label: "A1 · Beginner", count: 1000 },
    { key: "B1", label: "B1 · Intermediate", count: 3000 },
  ],
};
const WORDS: Record<string, string[]> = {
  "freq:1": ["the", "be", "water"],
  "freq:2": ["mountain", "engine"],
  "cefr:A1": ["the", "be", "water"],
  "cefr:B1": ["govern", "signal"],
};

function mockFetch() {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    let m = u.match(/\/api\/bands\/(\w+)/);
    if (m) return new Response(JSON.stringify(SUMMARY[m[1] as "freq" | "cefr"]), { status: 200 });
    m = u.match(/\/api\/band\/(\w+)\/([^/?]+)/);
    if (m) {
      const key = `${m[1]}:${decodeURIComponent(m[2]!)}`;
      const words = WORDS[key];
      if (!words) return new Response("unknown band", { status: 404 }); // as the real API does
      const label = [...SUMMARY.freq, ...SUMMARY.cefr].find((b) => b.key === m![2])?.label ?? key;
      return new Response(JSON.stringify({ key: m[2], label, words }), { status: 200 });
    }
    return new Response("no", { status: 404 });
  });
}

beforeEach(() => vi.stubGlobal("fetch", mockFetch()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BandBrowser", () => {
  it("renders the active view's band tabs with counts and shows the first band", async () => {
    render(<BandBrowser view="freq" anchorWord={null} anchorBandKey={null} onSelect={() => {}} />);
    expect(await screen.findByRole("tab", { name: /Top 1,000/ })).toBeInTheDocument();
    // First band opens by default; its words render as chips.
    expect(await screen.findByRole("button", { name: "water" })).toBeInTheDocument();
  });

  it("opens the anchor's band and looks a chip up when picked", async () => {
    const onSelect = vi.fn();
    render(
      <BandBrowser view="cefr" anchorWord="water" anchorBandKey="A1" onSelect={onSelect} />,
    );
    await screen.findByRole("button", { name: "water" });
    await userEvent.click(screen.getByRole("button", { name: "be" }));
    expect(onSelect).toHaveBeenCalledWith("be");
  });

  it("switches bands when another tab is selected", async () => {
    render(<BandBrowser view="freq" anchorWord={null} anchorBandKey={null} onSelect={() => {}} />);
    await screen.findByRole("button", { name: "water" });
    await userEvent.click(await screen.findByRole("tab", { name: /1,001/ }));
    expect(await screen.findByRole("button", { name: "engine" })).toBeInTheDocument();
  });

  it("reloads the summary and words when the view changes", async () => {
    const { rerender } = render(
      <BandBrowser view="freq" anchorWord={null} anchorBandKey={null} onSelect={() => {}} />,
    );
    await screen.findByRole("tab", { name: /Top 1,000/ });
    rerender(<BandBrowser view="cefr" anchorWord={null} anchorBandKey={null} onSelect={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /A1/ })).toBeInTheDocument(),
    );
  });
});
