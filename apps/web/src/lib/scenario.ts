// The learner's current scenario, encoded in the URL's query string so it can be
// copied as a shareable deeplink. Reflects the four things a sender might want a
// recipient to land on: the source language, the looked-up word, the target (gloss)
// language, and the band view / pinned band tab.

import { isSourceLang, type SourceLang } from "@/lib/languages";
import type { BandView } from "@/lib/types";

const isView = (v: string): v is BandView => v === "freq" || v === "cefr";

export interface Scenario {
  /** Source language whose vocabulary is being browsed. */
  lang: SourceLang;
  /** The looked-up word. */
  word: string;
  /** Target/gloss language (the reader's language). */
  tl: string;
  /** Frequency vs CEFR band view. */
  view: BandView;
  /** An explicitly-picked band tab, when it differs from the word's own band. */
  band: string | null;
}

/** The scenario encoded in the current URL, if any (client-only; empty on the server). */
export function readScenario(): Partial<Scenario> {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const out: Partial<Scenario> = {};
  const lang = p.get("lang");
  if (lang && isSourceLang(lang)) out.lang = lang;
  const word = p.get("word");
  if (word) out.word = word;
  const tl = p.get("tl");
  if (tl) out.tl = tl;
  const view = p.get("view");
  if (view && isView(view)) out.view = view;
  const band = p.get("band");
  if (band) out.band = band;
  return out;
}

/**
 * Reflect the scenario into the URL. Uses replaceState — we're mirroring live state
 * for sharing, not adding a history entry for every language flip or band click.
 */
export function writeScenario(s: Scenario): void {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  p.set("lang", s.lang);
  if (s.word) p.set("word", s.word);
  if (s.tl) p.set("tl", s.tl);
  p.set("view", s.view);
  if (s.band) p.set("band", s.band);
  const { pathname, hash } = window.location;
  window.history.replaceState(null, "", `${pathname}?${p.toString()}${hash}`);
}
