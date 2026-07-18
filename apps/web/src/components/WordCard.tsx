"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Badge, Select } from "@frontify/fondue/components";
import type { WordBands } from "@/lib/types";
import { baseLang } from "@/lib/translate";

const LANG_KEY = "eigenlex:lang";

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

// Target language for translations: a stored pick if any, else the browser language.
// The workspace is client-only (see WorkspaceLazy), so localStorage is available at
// first render — read it in the initializer to avoid a browser-language flash.
function useTargetLang(): [string, (l: string) => void] {
  const [lang, setLang] = useState(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved) return baseLang(saved);
    } catch {
      /* storage unavailable */
    }
    return browserLang();
  });
  const choose = (l: string) => {
    setLang(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* private mode / storage disabled — selection still applies for the session */
    }
  };
  return [lang, choose];
}

// Google Translate UI link — the escape hatch for what we don't do inline:
// pronunciation audio, example sentences, alternate senses. Always a new tab.
function translateHref(word: string, sl: string, tl: string) {
  const p = new URLSearchParams({ sl, tl, text: word, op: "translate" });
  return `https://translate.google.com/?${p}`;
}

// Session cache: learners check dozens of words and revisit some, so don't refetch.
const glossCache = new Map<string, string>();

type Gloss = { status: "loading" | "done" | "error"; text: string };

function useGloss(word: string, sl: string, tl: string, enabled: boolean): Gloss {
  const [gloss, setGloss] = useState<Gloss>({ status: "loading", text: "" });
  useEffect(() => {
    if (!enabled) return;
    const key = `${sl}:${tl}:${word}`;
    const cached = glossCache.get(key);
    if (cached !== undefined) {
      setGloss({ status: "done", text: cached });
      return;
    }
    setGloss({ status: "loading", text: "" });
    const ac = new AbortController();
    fetch(`/api/translate/${encodeURIComponent(word)}?sl=${sl}&tl=${tl}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { translation: string }) => {
        glossCache.set(key, d.translation);
        setGloss({ status: "done", text: d.translation });
      })
      .catch(() => {
        if (!ac.signal.aborted) setGloss({ status: "error", text: "" });
      });
    return () => ac.abort();
  }, [word, sl, tl, enabled]);
  return gloss;
}

type FormGloss = { form: string; gloss: string };
type Forms = { status: "loading" | "done" | "error"; items: FormGloss[] };

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
          .then((d: { translation: string; senses: string[] }): FormGloss => ({
            form,
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
          <span lang={code}>{endonym(code)}</span>
        </Select.Item>
      ))}
    </Select>
  );
}

/** A labelled metric in the card's stat row: small caption over its value. */
function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="tw-mb-1 tw-block tw-body-x-small text-muted-aaa">{label}</span>
      {children}
    </div>
  );
}

/** The looked-up word, its translation, and where it sits — both band labelings. */
export default function WordCard({ info, lang }: { info: WordBands; lang: string }) {
  const [tl, setTl] = useTargetLang();
  // No point translating a word into its own language.
  const translate = tl !== lang;
  // A case-homograph translates each casing separately; everything else is one gloss.
  const forms = info.forms ?? [info.word];
  const homograph = forms.length > 1;
  const single = useGloss(info.word, lang, tl, translate && !homograph);
  const multi = useForms(forms, lang, tl, translate && homograph);

  const status = homograph ? multi.status : single.status;
  const lines: FormGloss[] = homograph
    ? multi.items
    : single.text
      ? [{ form: info.word, gloss: single.text }]
      : [];
  const missing = status === "error" || (status === "done" && lines.length === 0);
  const showForms = lines.length > 1; // distinct meanings per casing — list them

  return (
    <section className="WordCard tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-px-6 tw-py-5">
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-4">
        {/* The word and, beneath it, its meaning — the card's two-line hero. */}
        <div className="tw-min-w-0">
          <h2 className="tw-heading-xx-large-strong tw-break-words" lang={lang}>
            {info.word}
          </h2>
          {/* Announce translation state changes to assistive tech (WCAG 4.1.3). */}
          <div aria-live="polite" className="tw-mt-0.5">
            {translate && status === "loading" && (
              <span className="tw-body-small text-muted-aaa">translating…</span>
            )}
            {translate && status === "done" && showForms && (
              <ul className="tw-mt-1 tw-flex tw-flex-col tw-gap-1">
                {lines.map((l) => (
                  <li key={l.form} className="tw-flex tw-flex-wrap tw-items-baseline tw-gap-x-2">
                    <span lang={lang} className="tw-body-medium tw-font-medium tw-text-primary">
                      {l.form}
                    </span>
                    <span lang={tl} className="tw-body-medium text-muted-aaa">
                      {l.gloss}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {translate && status === "done" && !showForms && lines[0] && (
              <span lang={tl} className="tw-body-large tw-font-medium tw-text-primary">
                {lines[0].gloss}
              </span>
            )}
            {translate && missing && (
              <span className="tw-body-small text-muted-aaa">no translation</span>
            )}
          </div>
        </div>
        {/* Translation controls, kept compact in the top-right. */}
        <div className="tw-flex tw-shrink-0 tw-flex-col tw-items-end tw-gap-1.5">
          <div className="tw-w-44">
            <LanguageSelect value={tl} onChange={setTl} />
          </div>
          <a
            href={translateHref(info.word, lang, tl)}
            // Opens a fresh tab every time (named-tab reuse can't survive Google
            // clearing window.name) — accepted, for its pronunciation audio.
            target="_blank"
            rel="noopener noreferrer"
            className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-border tw-border-line-subtle tw-px-3 tw-py-1.5 tw-body-medium tw-text-secondary tw-no-underline hover:tw-border-line hover:tw-text-primary"
          >
            Google Translate ↗
          </a>
        </div>
      </div>

      <div className="tw-mt-5 tw-flex tw-flex-wrap tw-items-start tw-gap-x-10 tw-gap-y-4 tw-border-t tw-border-line-subtle tw-pt-4">
        <Stat label="Frequency rank">
          <span className="tw-body-large tw-font-medium tw-tabular-nums tw-text-primary">
            #{info.rank.toLocaleString()}
          </span>
        </Stat>
        <Stat label="Frequency band">
          <Badge emphasis="weak">{info.freq.label}</Badge>
        </Stat>
        <Stat label="CEFR level">
          <Badge emphasis="weak">{info.cefr.label}</Badge>
        </Stat>
      </div>
    </section>
  );
}
