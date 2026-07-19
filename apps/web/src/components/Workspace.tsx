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
import { baseLang } from "@/lib/translate";
import { readScenario, writeScenario } from "@/lib/scenario";

// Expanded forms for the abbreviations we show (WCAG 3.1.4).
const CEFR_TITLE = "Common European Framework of Reference for Languages";
const CEFRJ_TITLE = "CEFR-J — a Japanese adaptation of the CEFR for finer levelling";
const SUBTLEX_TITLE = "SUBTLEX-US — a US-English word-frequency database drawn from film subtitles";
const LEIPZIG_TITLE =
  "Leipzig Corpora Collection — sentence corpora used to measure mid-sentence capitalization";

// Ancillary data sources not tied to one language's frequency list.
const LEMMA_URL = "https://github.com/michmech/lemmatization-lists";
const LEIPZIG_URL = "https://wortschatz.uni-leipzig.de/en/download";
const TRANSLATE_URL = "https://translate.google.com/";

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

// Persisted picks, so a returning learner lands back where they left off. A shareable
// URL (see lib/scenario) takes precedence over these when present.
const SOURCE_KEY = "eigenlex:source";
const LANG_KEY = "eigenlex:lang";

const browserLang = () =>
  baseLang(typeof navigator !== "undefined" ? navigator.language : "en");

// The workspace is client-only (see WorkspaceLazy), so localStorage is available at
// first render — read it in the state initializers to avoid a default-value flash.
function storedSource(): SourceLang | null {
  try {
    const s = window.localStorage.getItem(SOURCE_KEY);
    if (s && isSourceLang(s)) return s;
  } catch {
    /* storage unavailable */
  }
  return null;
}
function storedTarget(): string | null {
  try {
    const s = window.localStorage.getItem(LANG_KEY);
    if (s) return baseLang(s);
  } catch {
    /* storage unavailable */
  }
  return null;
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

// Data sources credited beneath the browser. All of them, in full, so the attribution
// stays complete regardless of the active view — the ranking (frequency +
// lemmatization), the CEFR calibration, German display casing, and the word-card glosses.
const SOURCE_LINK = "tw-underline hover:tw-text-primary";

function SourceCredit({ lang }: { lang: SourceLang }) {
  const { source, name } = SOURCE_LANG_META[lang];
  return (
    <>
      Word frequencies from{" "}
      <a className={SOURCE_LINK} href={source.url} target="_blank" rel="noreferrer">
        {lang === "en" ? <Abbr title={SUBTLEX_TITLE}>SUBTLEX-US</Abbr> : source.name}
      </a>
      {lang === "en" ? " (Brysbaert & New, 2009)" : null}, with inflections merged onto
      their base form via a{" "}
      <a className={SOURCE_LINK} href={LEMMA_URL} target="_blank" rel="noreferrer">
        lemmatization list
      </a>
      . <Abbr title={CEFR_TITLE}>CEFR</Abbr> levels are estimated from frequency, with band
      boundaries calibrated to the{" "}
      <a className={SOURCE_LINK} href="https://www.cefr-j.org/" target="_blank" rel="noreferrer">
        <Abbr title={CEFRJ_TITLE}>CEFR-J</Abbr>
      </a>{" "}
      vocabulary profile{lang !== "en" ? <> — an English-derived heuristic reused for {name}</> : null}.{" "}
      {lang === "de" ? (
        <>
          Display casing is measured from the{" "}
          <a className={SOURCE_LINK} href={LEIPZIG_URL} target="_blank" rel="noreferrer">
            <Abbr title={LEIPZIG_TITLE}>Leipzig Corpora</Abbr>
          </a>
          .{" "}
        </>
      ) : null}
      Word translations come from{" "}
      <a className={SOURCE_LINK} href={TRANSLATE_URL} target="_blank" rel="noreferrer">
        Google Translate
      </a>
      .
    </>
  );
}

export default function Workspace() {
  // A scenario carried in the URL wins over stored/default picks, so a shared deeplink
  // restores exactly what the sender saw. Read once, on mount.
  const initial = useRef(readScenario()).current;

  const [lang, setLangState] = useState<SourceLang>(
    () => initial.lang ?? storedSource() ?? DEFAULT_SOURCE,
  );
  const setLang = (l: SourceLang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(SOURCE_KEY, l);
    } catch {
      /* private mode / storage disabled — selection still applies for the session */
    }
  };

  // Target/gloss language, lifted out of the word card so it too rides in the URL.
  const [tl, setTlState] = useState<string>(
    () => initial.tl ?? storedTarget() ?? browserLang(),
  );
  const setTl = (l: string) => {
    setTlState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* private mode / storage disabled — selection still applies for the session */
    }
  };

  // The searched word drives the whole view, so its lookup lives here, above it.
  const [query, setQuery] = useState(() => initial.word ?? SOURCE_LANG_META[lang].defaultWord);
  const [info, setInfo] = useState<WordBands | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts true: the effect below looks the initial word up on mount straight away.
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<BandView>(() => initial.view ?? "freq");
  // The band tab the user explicitly picked; null follows the looked-up word's band.
  const [band, setBand] = useState<string | null>(() => initial.band ?? null);

  // `l` is passed explicitly so a language switch looks up the right dictionary
  // without waiting for the `lang` state update to settle. `bandOverride` restores a
  // pinned band from a shared link; a normal lookup follows the word's own band (null).
  const lookup = useCallback(
    async (raw: string, l: SourceLang, bandOverride: string | null = null) => {
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
        setBand(bandOverride);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Initial lookup, once, honouring the word + pinned band restored from the URL.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void lookup(query, lang, initial.band ?? null);
  }, [lookup, lang, query, initial.band]);

  // Mirror the scenario into the URL so learners can exchange deeplinks. Keyed on the
  // looked-up word (not the in-progress query), and only pins a band when it differs
  // from the word's own — an unchanged band is already implied by the word + view.
  useEffect(() => {
    if (!info) return;
    const anchor = info[view].key;
    writeScenario({ lang, word: info.word, tl, view, band: band && band !== anchor ? band : null });
  }, [lang, tl, view, band, info]);

  const chooseLang = (l: SourceLang) => {
    if (l === lang) return;
    setLang(l);
    const word = SOURCE_LANG_META[l].defaultWord;
    setQuery(word);
    void lookup(word, l);
  };

  // Switching view shows the word's band in the new view — drop any pinned tab.
  const chooseView = (v: BandView) => {
    setView(v);
    setBand(null);
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

        {info && <WordCard info={info} lang={lang} tl={tl} onTlChange={setTl} />}
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
          bandKey={band}
          onBandChange={setBand}
          onSelect={(w) => void lookup(w, lang)}
          viewControl={<ViewToggle view={view} onChange={chooseView} />}
        />

        {/* Data-source credits / CEFR disclaimer, under the data they describe.
            line-height 1.5 for blocks of text (WCAG 1.4.8), capped at 80ch line length. */}
        <p
          className="tw-mt-3 tw-max-w-[80ch] tw-body-x-small text-muted-aaa"
          style={{ lineHeight: 1.5 }}
        >
          Sources: <SourceCredit lang={lang} />
        </p>
      </section>
    </div>
  );
}
