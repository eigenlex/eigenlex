"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import BandBrowser from "@/components/BandBrowser";
import WordCard from "@/components/WordCard";
import WordSearchBox from "@/components/WordSearchBox";
import type { BandView, WordBands } from "@/lib/types";

// Expanded forms for the abbreviations we show (WCAG 3.1.4).
const CEFR_TITLE = "Common European Framework of Reference for Languages";
const CEFRJ_TITLE = "CEFR-J — a Japanese adaptation of the CEFR for finer levelling";
const SUBTLEX_TITLE = "SUBTLEX-US — a US-English word-frequency database drawn from film subtitles";

function Abbr({ title, children }: { title: string; children: ReactNode }) {
  return (
    <abbr title={title} className="tw-cursor-help tw-decoration-dotted">
      {children}
    </abbr>
  );
}

function ViewToggle({ view, onChange }: { view: BandView; onChange: (v: BandView) => void }) {
  const opt = (v: BandView, label: ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === v}
      onClick={() => onChange(v)}
      className={
        "tw-inline-flex tw-min-h-[44px] tw-items-center tw-justify-center tw-rounded-full tw-px-4 tw-body-small tw-transition-colors " +
        (view === v
          ? "tw-bg-[color:var(--accent-focus)] tw-font-medium tw-text-[#0b1220]"
          : "tw-text-secondary hover:tw-text-primary")
      }
    >
      {label}
    </button>
  );
  return (
    <div
      role="tablist"
      aria-label="Band view"
      className="tw-mb-4 tw-inline-flex tw-gap-1 tw-rounded-full tw-border tw-border-line-subtle tw-bg-surface tw-p-1"
    >
      {opt("freq", "Frequency")}
      {opt("cefr", <Abbr title={CEFR_TITLE}>CEFR</Abbr>)}
    </div>
  );
}

// Data source credited beneath the browser, per active view.
const SOURCE_LINK = "tw-underline hover:tw-text-primary";
const SOURCES: Record<BandView, ReactNode> = {
  freq: (
    <>
      Word frequencies from{" "}
      <a
        className={SOURCE_LINK}
        href="https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus"
        target="_blank"
        rel="noreferrer"
      >
        <Abbr title={SUBTLEX_TITLE}>SUBTLEX-US</Abbr>
      </a>{" "}
      (Brysbaert &amp; New, 2009); inflections merged onto their base form.
    </>
  ),
  cefr: (
    <>
      <Abbr title={CEFR_TITLE}>CEFR</Abbr> levels estimated from frequency, with band
      boundaries calibrated to the{" "}
      <a className={SOURCE_LINK} href="https://www.cefr-j.org/" target="_blank" rel="noreferrer">
        <Abbr title={CEFRJ_TITLE}>CEFR-J</Abbr>
      </a>{" "}
      vocabulary profile.
    </>
  ),
};

export default function Workspace({ initialWord }: { initialWord: string }) {
  // The searched word drives the whole view, so its lookup lives here, above it.
  const [query, setQuery] = useState(initialWord);
  const [info, setInfo] = useState<WordBands | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts true: the effect below looks up `initialWord` on mount straight away.
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<BandView>("freq");

  const lookup = useCallback(async (raw: string) => {
    const term = raw.trim().toLowerCase();
    if (!term) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/word/${encodeURIComponent(term)}`);
      if (!res.ok) {
        setError(`"${term}" is not in this dictionary`);
        return;
      }
      setError(null);
      setInfo((await res.json()) as WordBands);
      setQuery(term);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void lookup(initialWord);
  }, [lookup, initialWord]);

  return (
    <div className="Workspace">
      {/* Section headings (WCAG 2.4.10) — visually hidden, structural for AT. */}
      <section aria-labelledby="search-heading">
        <h2 id="search-heading" className="visually-hidden">
          Look up a word
        </h2>
        <WordSearchBox
          value={query}
          onValueChange={setQuery}
          onSubmit={(w) => void lookup(w)}
          ariaLabel="Look up a word"
          describedBy="search-help"
          placeholder="look up a word…"
          submitLabel={loading ? "…" : "look up"}
          submitDisabled={loading}
        />
        {/* Context-sensitive help for the field (WCAG 3.3.5). */}
        <p id="search-help" className="visually-hidden">
          Type an English word, then press Enter or choose a suggestion to see its
          frequency and CEFR level.
        </p>
      </section>

      {error && (
        <p className="tw-mb-4 tw-body-medium tw-text-error" role="alert">
          {error}
        </p>
      )}

      {info && <WordCard info={info} />}

      <section aria-labelledby="browse-heading">
        <h2 id="browse-heading" className="visually-hidden">
          Browse the vocabulary by band
        </h2>
        <ViewToggle view={view} onChange={setView} />

        <BandBrowser
          view={view}
          anchorWord={info?.word ?? null}
          anchorBandKey={info ? info[view].key : null}
          onSelect={(w) => void lookup(w)}
        />

        {/* line-height 1.5 for blocks of text (WCAG 1.4.8), capped at 80ch line length. */}
        <p
          className="tw-mt-3 tw-max-w-[80ch] tw-body-x-small text-muted-aaa"
          style={{ lineHeight: 1.5 }}
        >
          Source: {SOURCES[view]}
        </p>
      </section>
    </div>
  );
}
