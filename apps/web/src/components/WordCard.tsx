"use client";

import { Fragment, useEffect, useState } from "react";
import CefrBadge from "@/components/CefrBadge";
import LangSelect from "@/components/LangSelect";
import Loading from "@/components/Loading";
import { PANEL, PANEL_LANG } from "@/components/panel";
import type { WordLevel } from "@/lib/types";
import { baseLang, type SenseGroup } from "@/lib/translate";

// Offered in the picker; the reader's browser language and current pick are merged in.
const COMMON_LANGS = [
  "ar", "de", "en", "es", "fr", "hi", "id", "it", "ja",
  "ko", "nl", "pl", "pt", "ru", "tr", "uk", "vi", "zh",
];

function browserLang() {
  return baseLang(typeof navigator !== "undefined" ? navigator.language : "en");
}

// Each language named in its own tongue (endonym), so any reader recognizes theirs.
function endonym(code: string) {
  try {
    return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Google Translate UI link — the escape hatch for what we don't do inline:
// pronunciation audio, example sentences, alternate senses. Always a new tab.
function translateHref(word: string, sl: string, tl: string) {
  const p = new URLSearchParams({ sl, tl, text: word, op: "translate" });
  return `https://translate.google.com/?${p}`;
}

/** Each gloss term's CEFR level in the gloss language, keyed by the term. */
type Levels = Record<string, WordLevel>;

// Session cache: learners check dozens of words and revisit some, so don't refetch.
const glossCache = new Map<string, { text: string; groups: SenseGroup[]; levels: Levels }>();

const NO_GROUPS: SenseGroup[] = [];
const NO_LEVELS: Levels = {};
const PENDING = { status: "loading", text: "", groups: NO_GROUPS, levels: NO_LEVELS } as const;

type Gloss = {
  status: "loading" | "done" | "error";
  text: string;
  groups: SenseGroup[];
  levels: Levels;
};

// Dict mode: it carries the per-part-of-speech readings.
function useGloss(word: string, sl: string, tl: string, enabled: boolean): Gloss {
  const [gloss, setGloss] = useState<Gloss>(PENDING);
  useEffect(() => {
    if (!enabled) return;
    const key = `${sl}:${tl}:${word}`;
    const cached = glossCache.get(key);
    if (cached !== undefined) {
      setGloss({ status: "done", ...cached });
      return;
    }
    setGloss(PENDING);
    const ac = new AbortController();
    fetch(`/api/translate/${encodeURIComponent(word)}?sl=${sl}&tl=${tl}&dict=1`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { translation: string; groups?: SenseGroup[]; levels?: Levels }) => {
        const entry = {
          text: d.translation,
          groups: d.groups ?? NO_GROUPS,
          levels: d.levels ?? NO_LEVELS,
        };
        glossCache.set(key, entry);
        setGloss({ status: "done", ...entry });
      })
      .catch(() => {
        if (!ac.signal.aborted) setGloss({ ...PENDING, status: "error" });
      });
    return () => ac.abort();
  }, [word, sl, tl, enabled]);
  return gloss;
}

/** One listed line: a label — a source-language casing, or a part of speech — and its terms. */
type GlossLine = { label: string; terms: string[] };
type Forms = { status: "loading" | "done" | "error"; items: GlossLine[]; levels: Levels };

// Glosses for a case-homograph: translate each casing on its own (dict mode, which is
// casing-sensitive), then keep only casings whose meaning is distinct — so a spurious
// pairing ("wer"/"Wer" → both "who") collapses back to a single gloss.
function useForms(forms: string[], sl: string, tl: string, enabled: boolean): Forms {
  const [state, setState] = useState<Forms>({ status: "loading", items: [], levels: NO_LEVELS });
  const key = `${sl}:${tl}:${forms.join("|")}`;
  useEffect(() => {
    if (!enabled) return;
    setState({ status: "loading", items: [], levels: NO_LEVELS });
    const ac = new AbortController();
    Promise.all(
      forms.map((form) =>
        fetch(`/api/translate/${encodeURIComponent(form)}?sl=${sl}&tl=${tl}&dict=1`, { signal: ac.signal })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((d: { translation: string; senses: string[]; levels?: Levels }) => ({
            line: {
              label: form,
              terms: (d.senses.length ? d.senses : [d.translation]).filter(Boolean),
            },
            levels: d.levels ?? NO_LEVELS,
          })),
      ),
    )
      .then((all) => {
        const seen = new Set<string>();
        const items: GlossLine[] = [];
        const levels: Levels = {};
        for (const { line, levels: own } of all) {
          Object.assign(levels, own);
          const gloss = line.terms.join(", ").toLowerCase();
          if (gloss && !seen.has(gloss)) {
            seen.add(gloss);
            items.push(line);
          }
        }
        setState({ status: "done", items, levels });
      })
      .catch(() => {
        if (!ac.signal.aborted) setState({ status: "error", items: [], levels: NO_LEVELS });
      });
    return () => ac.abort();
  }, [key, enabled]); // forms is captured via `key`
  return state;
}

function LanguageSelect({ value, onChange }: { value: string; onChange: (l: string) => void }) {
  const options = [...new Set([...COMMON_LANGS, browserLang(), value])]
    .map((code) => ({ code, name: endonym(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <LangSelect
      label="Translation language"
      value={value}
      options={options}
      onChange={onChange}
    />
  );
}

// x-large, the next step up the type scale, but at body weight — Fondue has no
// body-x-large, and its typography utilities are emitted last, so a class can't
// override them. Line height comes along or 20px text sits in a 20px box.
// `block` pins the line to its own line-height; inline, it unions with the parent strut.
const GLOSS_TYPE = {
  display: "block",
  fontSize: "var(--typography-font-size-x-large)",
  lineHeight: "var(--typography-line-height-loose)",
};

// Smaller type, but the gloss's line box — else each translation resizes the card.
const STATUS_TYPE = { display: GLOSS_TYPE.display, lineHeight: GLOSS_TYPE.lineHeight };

/**
 * One reading's alternatives, each trailed by its own CEFR level where the gloss language
 * is one we index. The separators are plain text and the badges are the only elements, so
 * the line's text content is still exactly the gloss ("water, aqua").
 */
function Terms({ terms, levels, lang }: { terms: string[]; levels: Levels; lang: string }) {
  return (
    <span lang={lang} className="tw-body-large tw-text-primary" style={GLOSS_TYPE}>
      {terms.map((term, i) => {
        const level = levels[term];
        return (
          <Fragment key={`${i}:${term}`}>
            {i > 0 && ", "}
            {term}
            {level && <CefrBadge level={level} />}
          </Fragment>
        );
      })}
    </span>
  );
}

/** The looked-up word and its translation. */
export default function WordCard({
  word,
  forms,
  lang,
  tl,
  onTlChange,
  onGloss,
}: {
  word: string;
  /**
   * The word's casings, or null while the lookup is still in flight — which
   * renders this exact frame with the gloss pending, so the card is already its
   * settled height on first paint and the page below it never jumps.
   */
  forms: string[] | null;
  lang: string;
  /** Target/gloss language, owned by the workspace so it can ride in the URL. */
  tl: string;
  onTlChange: (l: string) => void;
  /** The gloss's leading term, so a language swap can land on it. */
  onGloss?: (term: string) => void;
}) {
  // No point translating a word into its own language.
  const translate = tl !== lang;
  const pending = forms === null;
  // A case-homograph translates each casing separately; everything else is one gloss.
  const casings = forms ?? [word];
  const homograph = casings.length > 1;
  const single = useGloss(word, lang, tl, translate && !homograph && !pending);
  const multi = useForms(casings, lang, tl, translate && homograph && !pending);

  // Both hooks park on "loading" until enabled, which is the pending frame's state.
  const status = homograph ? multi.status : single.status;
  // Separate readings get a line each: per casing for a homograph, else per part of speech.
  const lines: GlossLine[] = homograph
    ? multi.items
    : single.groups.length > 1
      ? single.groups.map((g) => ({ label: g.pos, terms: g.terms }))
      : [];
  const showLines = lines.length > 1;
  const levels = homograph ? multi.levels : single.levels;
  // Dictionary terms beat the plain translation, which alone can be wrong ("acqua" → "waterfall").
  const heroTerms = homograph
    ? (multi.items[0]?.terms ?? [])
    : single.groups.length === 1
      ? single.groups[0]!.terms
      : single.text
        ? [single.text]
        : [];
  const missing = status === "error" || (status === "done" && !showLines && !heroTerms.length);

  // "water, aqua" -> "water": the term a swap into this language would look up.
  const heroTerm = heroTerms[0]?.split(",")[0]?.trim() ?? "";
  useEffect(() => {
    if (status === "done" && heroTerm) onGloss?.(heroTerm);
  }, [status, heroTerm, onGloss]);

  return (
    // Named for AT: without the heading the card is an unlabelled box, and its live
    // region would announce a gloss with no subject.
    <section
      aria-label={`Meaning of ${word}`}
      className={`WordCard ${PANEL}`}
    >
      {/* Wraps on the card's own width, not the viewport's — it is also cramped in the
          two-column layout just past 860px. Alone on a wrapped row, justify-between
          leaves the link at the start. */}
      <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-2 min-[700px]:tw-gap-4">
        {/* Leads the row, since it decides what the gloss says. */}
        <div className={PANEL_LANG}>
          <LanguageSelect value={tl} onChange={onTlChange} />
        </div>
        {/* The card is only the meaning now — the word itself is in the search box
            and spotlighted in the cloud, so printing it a third time said nothing. */}
        {/* 44px, centred: the gloss sits on the same line as the search field facing
            it, and level with the link beside it. Basis is short by the width the
            select takes from the row, so the link still drops at the same card width. */}
        <div className="tw-flex tw-min-h-[44px] tw-min-w-0 tw-grow tw-basis-[11rem] tw-items-center">
          {/* Announce translation state changes to assistive tech (WCAG 4.1.3). */}
          <div aria-live="polite">
            {translate && status === "loading" && (
              // Reserves the gloss's line box, so the card doesn't resize when it lands.
              // The wrapper is already the live region, so don't nest another.
              <Loading
                size="x-small"
                announce={false}
                label="Translating…"
                className="tw-min-h-[var(--typography-line-height-loose)]"
              />
            )}
            {translate && status === "done" && showLines && (
              <ul className="tw-flex tw-flex-col tw-gap-1.5">
                {lines.map((l) => (
                  <li
                    key={`${l.label}:${l.terms.join(",")}`}
                    className="tw-flex tw-flex-wrap tw-items-baseline tw-gap-x-2"
                  >
                    {l.label && (
                      // A casing is source-language; a POS label comes back in the reader's.
                      <span
                        lang={homograph ? lang : tl}
                        className="tw-body-medium text-muted-aaa"
                      >
                        {l.label}
                      </span>
                    )}
                    <Terms terms={l.terms} levels={levels} lang={tl} />
                  </li>
                ))}
              </ul>
            )}
            {translate && status === "done" && !showLines && heroTerms.length > 0 && (
              <Terms terms={heroTerms} levels={levels} lang={tl} />
            )}
            {translate && missing && (
              <span className="tw-body-small text-muted-aaa" style={STATUS_TYPE}>
                no translation
              </span>
            )}
          </div>
        </div>
        {/* 44px target (WCAG 2.5.5). */}
        <a
          href={translateHref(word, lang, tl)}
          // Opens a fresh tab every time (named-tab reuse can't survive Google
          // clearing window.name) — accepted, for its pronunciation audio.
          target="_blank"
          rel="noopener noreferrer"
          className="tw-inline-flex tw-min-h-[44px] tw-shrink-0 tw-items-center tw-justify-center tw-gap-1 tw-rounded-full tw-border tw-border-line-subtle tw-px-4 tw-py-1.5 tw-body-large tw-text-secondary tw-no-underline hover:tw-border-line hover:tw-text-primary"
        >
          Google Translate ↗
        </a>
      </div>
    </section>
  );
}
