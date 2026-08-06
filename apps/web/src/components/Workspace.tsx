"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SegmentedControl, Select, Tooltip } from "@frontify/fondue/components";
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
import { PANEL, PANEL_LANG } from "@/components/panel";

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

// A dropdown, not a segmented control: the language is picked once and then left
// alone, so it doesn't deserve a row of six always-visible buttons.
function SourceSelect({ lang, onChange }: { lang: SourceLang; onChange: (l: SourceLang) => void }) {
  return (
    <Select
      aria-label="Source language"
      value={lang}
      onSelect={(v) => v && onChange(v as SourceLang)}
      showStringValue
    >
      {SOURCE_LANGS.map((code) => (
        <Select.Item key={code} value={code} label={SOURCE_LANG_META[code].name}>
          <span lang={code} className="tw-text-large">{SOURCE_LANG_META[code].name}</span>
        </Select.Item>
      ))}
    </Select>
  );
}

// Sits between the two panels: a vertical divider control on a wide screen, a
// horizontal one where they stack — hence the arrow turning with the breakpoint.
const SWAP =
  "tw-flex tw-h-11 tw-w-11 tw-items-center tw-justify-center tw-rounded-full tw-border " +
  "tw-border-line-subtle tw-bg-surface tw-text-large tw-text-secondary tw-transition-colors " +
  "hover:tw-border-line hover:tw-text-primary " +
  "aria-disabled:tw-cursor-not-allowed aria-disabled:tw-opacity-40 " +
  "aria-disabled:hover:tw-border-line-subtle aria-disabled:hover:tw-text-secondary";

const STUDYABLE = SOURCE_LANGS.map((c) => SOURCE_LANG_META[c].name).join(", ");

/**
 * Study what you were glossing to. Only the six indexed languages can be studied,
 * so a gloss language outside them leaves this inert rather than absent — a control
 * that vanishes as the target changes is harder to understand than one that explains.
 */
function SwapButton({ enabled, onSwap }: { enabled: boolean; onSwap: () => void }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        {/* aria-disabled, not disabled: it stays focusable, so the reason is reachable. */}
        <button
          type="button"
          aria-disabled={!enabled}
          aria-label="Swap the study and translation languages"
          className={SWAP}
          onClick={() => enabled && onSwap()}
        >
          <span aria-hidden="true" className="tw-rotate-90 min-[860px]:tw-rotate-0">
            ⇄
          </span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>
        {enabled ? "Swap languages" : `Only ${STUDYABLE} can be studied`}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

function ViewToggle({ view, onChange }: { view: BandView; onChange: (v: BandView) => void }) {
  return (
    <div>
      <SegmentedControl.Root aria-label="Band view" value={view} onValueChange={(v) => onChange(v as BandView)}>
        {/* Tooltip wraps the item itself — nesting a focusable inside the radio would
            be invalid, so we follow Fondue's SegmentedControl + Tooltip pattern. */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <SegmentedControl.Item value="freq">Frequency</SegmentedControl.Item>
          </Tooltip.Trigger>
          <Tooltip.Content>Raw frequency</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <SegmentedControl.Item value="cefr">CEFR</SegmentedControl.Item>
          </Tooltip.Trigger>
          <Tooltip.Content>{`${CEFR_TITLE} (CEFR) level`}</Tooltip.Content>
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
      {/* Spelled out, not an Abbr: a tooltip expansion is unreachable by touch, and CEFR
          is the one abbreviation the UI labels words with. */}
      . CEFR ({CEFR_TITLE}) levels are estimated from frequency, with band
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
      // Nothing to look up is not a wait: `?word=%20` would otherwise leave the
      // card pending and the button disabled for good.
      if (!term) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/word/${encodeURIComponent(term)}?lang=${l}`);
        if (!res.ok) {
          setError(`"${term}" is not in this dictionary`);
          return;
        }
        setError(null);
        const found = (await res.json()) as WordBands;
        setInfo(found);
        // Echo the corpus's display casing ("Plädoyer"), not the lowercased lookup key.
        setQuery(found.word);
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

  // The gloss's leading term, reported by the card — what a swap lands on.
  const [glossTerm, setGlossTerm] = useState<string | null>(null);
  const canSwap = isSourceLang(tl) && tl !== lang;

  // Study the gloss language, glossing back to the one just left. The word carries
  // over as its own translation where that is a word in the new language — a gloss
  // can be a phrase ("to eat"), and phrases are not in the dictionary.
  const swap = async () => {
    if (!canSwap || !isSourceLang(tl)) return;
    const to = tl;
    const from = lang;
    setLoading(true);
    let word = SOURCE_LANG_META[to].defaultWord;
    const seed = glossTerm?.trim().toLowerCase();
    if (seed && !seed.includes(" ")) {
      try {
        const res = await fetch(`/api/word/${encodeURIComponent(seed)}?lang=${to}`);
        if (res.ok) word = seed;
      } catch {
        /* offline: the default word still gives a valid landing place */
      }
    }
    // Swapped together with the word, so no render shows a word beside the wrong pair.
    setLang(to);
    setTl(from);
    setQuery(word);
    await lookup(word, to);
  };

  // Switching view shows the word's band in the new view — drop any pinned tab.
  const chooseView = (v: BandView) => {
    setView(v);
    setBand(null);
  };

  const langName = SOURCE_LANG_META[lang].name;

  return (
    <div className="Workspace">
      {/* Hero: the word you ask for on the left, what it means on the right — two
          matching panels, each opening with its language. Stretched, not start-aligned,
          so the pair squares off. */}
      {/* Tighter above and below the card on a phone, where it is stacked, not beside. */}
      <div className="tw-mb-6 tw-grid tw-grid-cols-1 tw-gap-x-4 tw-gap-y-3 min-[700px]:tw-mb-12 min-[700px]:tw-gap-y-4 min-[860px]:tw-grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)]">
        <div className={PANEL}>
          {/* Section headings (WCAG 2.4.10) — visually hidden, structural for AT. */}
          <section aria-labelledby="lang-heading">
            <h2 id="lang-heading" className="visually-hidden">
              Choose a language to study
            </h2>
            <div className={PANEL_LANG}>
              <SourceSelect lang={lang} onChange={chooseLang} />
            </div>
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
              submitLabel="look up"
              busy={loading}
            />
            {/* Context-sensitive help for the field (WCAG 3.3.5). */}
            <p id="search-help" className="visually-hidden">
              Type a {langName} word, then press Enter or choose a suggestion to see its
              frequency and CEFR level.
            </p>
          </section>

          {error && (
            <p className="tw-mt-3 tw-body-medium tw-text-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="tw-self-center tw-justify-self-center">
          <SwapButton enabled={canSwap} onSwap={() => void swap()} />
        </div>

        {/* Pending from the first paint, so the hero row is already its settled
            height; a failed lookup drops the frame and leaves the error alert. */}
        {(info || loading) && (
          <WordCard
            word={info?.word ?? query}
            forms={info?.forms ?? null}
            lang={lang}
            tl={tl}
            onTlChange={setTl}
            onGloss={setGlossTerm}
          />
        )}
      </div>

      <section aria-labelledby="browse-heading">
        <h2 id="browse-heading" className="visually-hidden">
          Browse the vocabulary
        </h2>
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
