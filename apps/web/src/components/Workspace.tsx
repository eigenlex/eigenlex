"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import BandBrowser from "@/components/BandBrowser";
import WordCard from "@/components/WordCard";
import WordSearchBox from "@/components/WordSearchBox";
import type { BandView, WordBands } from "@/lib/types";

function ViewToggle({ view, onChange }: { view: BandView; onChange: (v: BandView) => void }) {
  const opt = (v: BandView, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === v}
      onClick={() => onChange(v)}
      className={
        "tw-rounded-full tw-px-4 tw-py-1.5 tw-body-small tw-transition-colors " +
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
      {opt("cefr", "CEFR")}
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
        SUBTLEX-US
      </a>{" "}
      (Brysbaert &amp; New, 2009); inflections merged onto their base form.
    </>
  ),
  cefr: (
    <>
      CEFR levels estimated from frequency, with band boundaries calibrated to the{" "}
      <a className={SOURCE_LINK} href="https://www.cefr-j.org/" target="_blank" rel="noreferrer">
        CEFR-J
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
      <WordSearchBox
        value={query}
        onValueChange={setQuery}
        onSubmit={(w) => void lookup(w)}
        ariaLabel="Look up a word"
        placeholder="look up a word…"
        submitLabel={loading ? "…" : "look up"}
        submitDisabled={loading}
      />

      {error && (
        <p className="tw-mb-4 tw-body-medium tw-text-error" role="alert">
          {error}
        </p>
      )}

      {info && <WordCard info={info} />}

      <ViewToggle view={view} onChange={setView} />

      <BandBrowser
        view={view}
        anchorWord={info?.word ?? null}
        anchorBandKey={info ? info[view].key : null}
        onSelect={(w) => void lookup(w)}
      />

      {/* line-height 1.5 for blocks of text (WCAG 1.4.8), capped at 80ch line length. */}
      <p
        className="tw-mt-3 tw-max-w-[80ch] tw-body-x-small tw-text-low-contrast"
        style={{ lineHeight: 1.5 }}
      >
        Source: {SOURCES[view]}
      </p>
    </div>
  );
}
