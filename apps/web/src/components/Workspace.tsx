"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SegmentedControl, Tooltip } from "@frontify/fondue/components";
import BandBrowser from "@/components/BandBrowser";
import WordCard from "@/components/WordCard";
import WordSearchBox from "@/components/WordSearchBox";
import type { BandView, WordBands } from "@/lib/types";
import {
  DEFAULT_SOURCE,
  isSourceLang,
  SOURCE_LANGS,
  SOURCE_LANG_META,
  type SourceLang,
} from "@/lib/languages";

// Expanded forms for the abbreviations we show (WCAG 3.1.4).
const CEFR_TITLE = "Common European Framework of Reference for Languages";
const CEFRJ_TITLE = "CEFR-J — a Japanese adaptation of the CEFR for finer levelling";
const SUBTLEX_TITLE = "SUBTLEX-US — a US-English word-frequency database drawn from film subtitles";

// Abbreviation whose expansion shows in a Fondue tooltip. The <abbr> stays for its
// expansion semantics (WCAG 3.1.4); tabIndex makes it a focus target so the tooltip
// also opens on keyboard focus, not just hover.
function Abbr({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <abbr tabIndex={0} className="tw-cursor-help tw-decoration-dotted">
          {children}
        </abbr>
      </Tooltip.Trigger>
      <Tooltip.Content>{title}</Tooltip.Content>
    </Tooltip.Root>
  );
}

// Persist the picked source language so a learner returns to the language they study.
const SOURCE_KEY = "eigenlex:source";
function useSourceLang(): [SourceLang, (l: SourceLang) => void] {
  // The workspace is client-only (see WorkspaceLazy), so localStorage is available at
  // first render — read it in the initializer to avoid a default-language flash.
  const [lang, setLang] = useState<SourceLang>(() => {
    try {
      const saved = window.localStorage.getItem(SOURCE_KEY);
      if (saved && isSourceLang(saved)) return saved;
    } catch {
      /* storage unavailable */
    }
    return DEFAULT_SOURCE;
  });
  const choose = (l: SourceLang) => {
    setLang(l);
    try {
      window.localStorage.setItem(SOURCE_KEY, l);
    } catch {
      /* private mode / storage disabled — selection still applies for the session */
    }
  };
  return [lang, choose];
}

function SourceSelect({ lang, onChange }: { lang: SourceLang; onChange: (l: SourceLang) => void }) {
  return (
    <div className="tw-mb-4">
      <SegmentedControl.Root aria-label="Source language" value={lang} onValueChange={(v) => onChange(v as SourceLang)} hugWidth={false}>
        {SOURCE_LANGS.map((code) => (
          <SegmentedControl.Item key={code} value={code}>
            <span lang={code}>{SOURCE_LANG_META[code].name}</span>
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: BandView; onChange: (v: BandView) => void }) {
  return (
    <div>
      <SegmentedControl.Root aria-label="Band view" value={view} onValueChange={(v) => onChange(v as BandView)}>
        <SegmentedControl.Item value="freq">Frequency</SegmentedControl.Item>
        {/* Tooltip wraps the item itself — nesting a focusable inside the radio would
            be invalid, so we follow Fondue's SegmentedControl + Tooltip pattern. */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <SegmentedControl.Item value="cefr">CEFR</SegmentedControl.Item>
          </Tooltip.Trigger>
          <Tooltip.Content>{CEFR_TITLE}</Tooltip.Content>
        </Tooltip.Root>
      </SegmentedControl.Root>
    </div>
  );
}

// Data source credited beneath the browser, per active view and source language.
const SOURCE_LINK = "tw-underline hover:tw-text-primary";

function FreqSource({ lang }: { lang: SourceLang }) {
  const { source } = SOURCE_LANG_META[lang];
  return (
    <>
      Word frequencies from{" "}
      <a className={SOURCE_LINK} href={source.url} target="_blank" rel="noreferrer">
        {lang === "en" ? <Abbr title={SUBTLEX_TITLE}>SUBTLEX-US</Abbr> : source.name}
      </a>
      {lang === "en" ? " (Brysbaert & New, 2009)" : null}; inflections merged onto their base form.
    </>
  );
}

function CefrSource({ lang }: { lang: SourceLang }) {
  return (
    <>
      <Abbr title={CEFR_TITLE}>CEFR</Abbr> levels estimated from frequency, with band
      boundaries calibrated to the{" "}
      <a className={SOURCE_LINK} href="https://www.cefr-j.org/" target="_blank" rel="noreferrer">
        <Abbr title={CEFRJ_TITLE}>CEFR-J</Abbr>
      </a>{" "}
      vocabulary profile
      {lang !== "en" ? (
        <> — an English-derived heuristic reused for {SOURCE_LANG_META[lang].name}</>
      ) : null}
      .
    </>
  );
}

export default function Workspace() {
  const [lang, setLang] = useSourceLang();
  // The searched word drives the whole view, so its lookup lives here, above it.
  const [query, setQuery] = useState(() => SOURCE_LANG_META[DEFAULT_SOURCE].defaultWord);
  const [info, setInfo] = useState<WordBands | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts true: the effect below looks the initial word up on mount straight away.
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<BandView>("freq");

  // `l` is passed explicitly so a language switch looks up the right dictionary
  // without waiting for the `lang` state update to settle.
  const lookup = useCallback(
    async (raw: string, l: SourceLang) => {
      const term = raw.trim().toLowerCase();
      if (!term) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/word/${encodeURIComponent(term)}?lang=${l}`);
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
    },
    [],
  );

  // Initial lookup, once, using whatever source language was restored on mount.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void lookup(SOURCE_LANG_META[lang].defaultWord, lang);
  }, [lookup, lang]);

  const chooseLang = (l: SourceLang) => {
    if (l === lang) return;
    setLang(l);
    const word = SOURCE_LANG_META[l].defaultWord;
    setQuery(word);
    void lookup(word, l);
  };

  const langName = SOURCE_LANG_META[lang].name;

  return (
    <div className="Workspace">
      {/* Hero: pick a language and look a word up on the left; the result card fills
          the right on wide screens, so a query and its answer sit side by side. */}
      <div className="tw-mb-12 tw-grid tw-grid-cols-1 tw-items-start tw-gap-x-8 tw-gap-y-6 min-[860px]:tw-grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          {/* Section headings (WCAG 2.4.10) — visually hidden, structural for AT. */}
          <section aria-labelledby="lang-heading">
            <h2 id="lang-heading" className="visually-hidden">
              Choose a language to study
            </h2>
            <SourceSelect lang={lang} onChange={chooseLang} />
          </section>

          <section aria-labelledby="search-heading">
            <h2 id="search-heading" className="visually-hidden">
              Look up a word
            </h2>
            <WordSearchBox
              value={query}
              onValueChange={setQuery}
              onSubmit={(w) => void lookup(w, lang)}
              lang={lang}
              ariaLabel="Look up a word"
              describedBy="search-help"
              placeholder="look up a word…"
              submitLabel={loading ? "…" : "look up"}
              submitDisabled={loading}
            />
            {/* Context-sensitive help for the field (WCAG 3.3.5). */}
            <p id="search-help" className="visually-hidden">
              Type a {langName} word, then press Enter or choose a suggestion to see its
              frequency and CEFR level.
            </p>
          </section>

          {error && (
            <p className="tw-body-medium tw-text-error" role="alert">
              {error}
            </p>
          )}
        </div>

        {info && <WordCard info={info} lang={lang} />}
      </div>

      <section aria-labelledby="browse-heading">
        <h2 id="browse-heading" className="tw-mb-1 tw-heading-medium-strong">
          Browse the vocabulary
        </h2>
        <p className="tw-mb-4 tw-body-small text-muted-aaa">
          Every {langName} word in order — by raw frequency, or by CEFR level.
        </p>

        <BandBrowser
          view={view}
          lang={lang}
          anchorWord={info?.word ?? null}
          anchorBandKey={info ? info[view].key : null}
          onSelect={(w) => void lookup(w, lang)}
          viewControl={<ViewToggle view={view} onChange={setView} />}
        />

        {/* Source credit / CEFR disclaimer, under the data it describes.
            line-height 1.5 for blocks of text (WCAG 1.4.8), capped at 80ch line length. */}
        <p
          className="tw-mt-3 tw-max-w-[80ch] tw-body-x-small text-muted-aaa"
          style={{ lineHeight: 1.5 }}
        >
          Source: {view === "cefr" ? <CefrSource lang={lang} /> : <FreqSource lang={lang} />}
        </p>
      </section>
    </div>
  );
}
