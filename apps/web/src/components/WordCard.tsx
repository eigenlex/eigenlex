"use client";

import { useEffect, useState } from "react";
import { Select } from "@frontify/fondue/components";
import Loading from "@/components/Loading";
import { PANEL, PANEL_LANG } from "@/components/panel";
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

// Session cache: learners check dozens of words and revisit some, so don't refetch.
const glossCache = new Map<string, { text: string; groups: SenseGroup[] }>();

const NO_GROUPS: SenseGroup[] = [];

type Gloss = { status: "loading" | "done" | "error"; text: string; groups: SenseGroup[] };

// Dict mode: it carries the per-part-of-speech readings.
function useGloss(word: string, sl: string, tl: string, enabled: boolean): Gloss {
  const [gloss, setGloss] = useState<Gloss>({ status: "loading", text: "", groups: NO_GROUPS });
  useEffect(() => {
    if (!enabled) return;
    const key = `${sl}:${tl}:${word}`;
    const cached = glossCache.get(key);
    if (cached !== undefined) {
      setGloss({ status: "done", ...cached });
      return;
    }
    setGloss({ status: "loading", text: "", groups: NO_GROUPS });
    const ac = new AbortController();
    fetch(`/api/translate/${encodeURIComponent(word)}?sl=${sl}&tl=${tl}&dict=1`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { translation: string; groups?: SenseGroup[] }) => {
        const entry = { text: d.translation, groups: d.groups ?? NO_GROUPS };
        glossCache.set(key, entry);
        setGloss({ status: "done", ...entry });
      })
      .catch(() => {
        if (!ac.signal.aborted) setGloss({ status: "error", text: "", groups: NO_GROUPS });
      });
    return () => ac.abort();
  }, [word, sl, tl, enabled]);
  return gloss;
}

/** One listed line: a label — a source-language casing, or a part of speech — and its gloss. */
type GlossLine = { label: string; gloss: string };
type Forms = { status: "loading" | "done" | "error"; items: GlossLine[] };

// Glosses for a case-homograph: translate each casing on its own (dict mode, which is
// casing-sensitive), then keep only casings whose meaning is distinct — so a spurious
// pairing ("wer"/"Wer" → both "who") collapses back to a single gloss.
function useForms(forms: string[], sl: string, tl: string, enabled: boolean): Forms {
  const [state, setState] = useState<Forms>({ status: "loading", items: [] });
  const key = `${sl}:${tl}:${forms.join("|")}`;
  useEffect(() => {
    if (!enabled) return;
    setState({ status: "loading", items: [] });
    const ac = new AbortController();
    Promise.all(
      forms.map((form) =>
        fetch(`/api/translate/${encodeURIComponent(form)}?sl=${sl}&tl=${tl}&dict=1`, { signal: ac.signal })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((d: { translation: string; senses: string[] }): GlossLine => ({
            label: form,
            gloss: (d.senses.length ? d.senses : [d.translation]).filter(Boolean).join(", "),
          })),
      ),
    )
      .then((all) => {
        const seen = new Set<string>();
        const items = all.filter((it) => it.gloss && !seen.has(it.gloss.toLowerCase()) && seen.add(it.gloss.toLowerCase()));
        setState({ status: "done", items });
      })
      .catch(() => {
        if (!ac.signal.aborted) setState({ status: "error", items: [] });
      });
    return () => ac.abort();
  }, [key, enabled]); // forms is captured via `key`
  return state;
}

function LanguageSelect({ value, onChange }: { value: string; onChange: (l: string) => void }) {
  const options = [...new Set([...COMMON_LANGS, browserLang(), value])].sort((a, b) =>
    endonym(a).localeCompare(endonym(b)),
  );
  return (
    <Select
      aria-label="Translation language"
      value={value}
      onSelect={(v) => v && onChange(v)}
      showStringValue
    >
      {options.map((code) => (
        <Select.Item key={code} value={code} label={endonym(code)}>
          <span lang={code} className="tw-text-large">{endonym(code)}</span>
        </Select.Item>
      ))}
    </Select>
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

/** The looked-up word and its translation. */
export default function WordCard({
  word,
  forms,
  lang,
  tl,
  onTlChange,
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
      ? single.groups.map((g) => ({ label: g.pos, gloss: g.terms.join(", ") }))
      : [];
  const showLines = lines.length > 1;
  // Dictionary terms beat the plain translation, which alone can be wrong ("acqua" → "waterfall").
  const hero = homograph
    ? (multi.items[0]?.gloss ?? "")
    : single.groups.length === 1
      ? single.groups[0]!.terms.join(", ")
      : single.text;
  const missing = status === "error" || (status === "done" && !showLines && !hero);

  return (
    // Named for AT: without the heading the card is an unlabelled box, and its live
    // region would announce a gloss with no subject.
    <section
      aria-label={`Meaning of ${word}`}
      className={`WordCard ${PANEL}`}
    >
      {/* Above the gloss, since it decides what the gloss says. */}
      <div className={PANEL_LANG}>
        <LanguageSelect value={tl} onChange={onTlChange} />
      </div>
      {/* Wraps on the card's own width, not the viewport's — it is also cramped in the
          two-column layout just past 860px. Alone on a wrapped row, justify-between
          leaves the link at the start. */}
      <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-2 min-[700px]:tw-gap-4">
        {/* The card is only the meaning now — the word itself is in the search box
            and spotlighted in the cloud, so printing it a third time said nothing. */}
        {/* 44px, centred: the gloss sits on the same line as the search field facing
            it, and level with the link beside it. */}
        <div className="tw-flex tw-min-h-[44px] tw-min-w-0 tw-grow tw-basis-[17rem] tw-items-center">
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
                    key={`${l.label}:${l.gloss}`}
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
                    <span lang={tl} className="tw-body-large tw-text-primary" style={GLOSS_TYPE}>
                      {l.gloss}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {translate && status === "done" && !showLines && hero && (
              <span lang={tl} className="tw-body-large tw-text-primary" style={GLOSS_TYPE}>
                {hero}
              </span>
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
