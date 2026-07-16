"use client";

import { useEffect, useState } from "react";
import type { WordBands } from "@/lib/types";
import { baseLang } from "@/lib/translate";

const PILL =
  "tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-line-subtle " +
  "tw-bg-surface-hover tw-px-3 tw-py-1 tw-body-small tw-text-secondary";

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
function translateHref(word: string, tl: string) {
  const p = new URLSearchParams({ sl: "en", tl, text: word, op: "translate" });
  return `https://translate.google.com/?${p}`;
}

// Session cache: learners check dozens of words and revisit some, so don't refetch.
const glossCache = new Map<string, string>();

type Gloss = { status: "loading" | "done" | "error"; text: string };

function useGloss(word: string, tl: string, enabled: boolean): Gloss {
  const [gloss, setGloss] = useState<Gloss>({ status: "loading", text: "" });
  useEffect(() => {
    if (!enabled) return;
    const key = `${tl}:${word}`;
    const cached = glossCache.get(key);
    if (cached !== undefined) {
      setGloss({ status: "done", text: cached });
      return;
    }
    setGloss({ status: "loading", text: "" });
    const ac = new AbortController();
    fetch(`/api/translate/${encodeURIComponent(word)}?tl=${tl}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { translation: string }) => {
        glossCache.set(key, d.translation);
        setGloss({ status: "done", text: d.translation });
      })
      .catch(() => {
        if (!ac.signal.aborted) setGloss({ status: "error", text: "" });
      });
    return () => ac.abort();
  }, [word, tl, enabled]);
  return gloss;
}

function LanguageSelect({ value, onChange }: { value: string; onChange: (l: string) => void }) {
  const options = [...new Set([...COMMON_LANGS, browserLang(), value])].sort((a, b) =>
    endonym(a).localeCompare(endonym(b)),
  );
  return (
    <select
      aria-label="Translation language"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="tw-min-h-[44px] tw-shrink-0 tw-cursor-pointer tw-rounded-full tw-border tw-border-line-subtle tw-bg-surface-hover tw-px-3 tw-py-1 tw-body-small tw-text-secondary hover:tw-text-primary"
    >
      {options.map((code) => (
        <option key={code} value={code} lang={code}>
          {endonym(code)}
        </option>
      ))}
    </select>
  );
}

/** The looked-up word, its translation, and where it sits — both band labelings. */
export default function WordCard({ info }: { info: WordBands }) {
  const [tl, setTl] = useTargetLang();
  // No point translating English into English.
  const translate = tl !== "en";
  const gloss = useGloss(info.word, tl, translate);
  const missing = gloss.status === "error" || (gloss.status === "done" && !gloss.text);

  return (
    <section className="WordCard tw-mb-4 tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-px-5 tw-py-4">
      <div className="tw-flex tw-items-baseline tw-justify-between tw-gap-3">
        <h2 className="tw-heading-x-large-strong">{info.word}</h2>
        <LanguageSelect value={tl} onChange={setTl} />
      </div>
      <div className="tw-mt-1 tw-flex tw-items-baseline tw-gap-3">
        {/* Announce translation state changes to assistive tech (WCAG 4.1.3). */}
        <span aria-live="polite" className="tw-contents">
          {translate && gloss.status === "loading" && (
            <span className="tw-body-small text-muted-aaa">translating…</span>
          )}
          {translate && gloss.status === "done" && gloss.text && (
            <span lang={tl} className="tw-body-large tw-font-medium tw-text-primary">
              {gloss.text}
            </span>
          )}
          {translate && missing && (
            <span className="tw-body-small text-muted-aaa">no translation</span>
          )}
        </span>
        <a
          href={translateHref(info.word, tl)}
          // Opens a fresh tab every time (named-tab reuse can't survive Google
          // clearing window.name) — accepted, for its pronunciation audio.
          target="_blank"
          rel="noopener noreferrer"
          className="tw-body-small tw-text-secondary tw-underline hover:tw-text-primary"
        >
          Google Translate ↗
        </a>
      </div>
      <p className="tw-mb-3 tw-mt-1 tw-body-small text-muted-aaa">
        frequency rank #{info.rank.toLocaleString()}
      </p>
      <div className="tw-flex tw-flex-wrap tw-gap-6">
        <div>
          <span className="tw-mb-1 tw-block tw-body-x-small text-muted-aaa">Frequency band</span>
          <span className={PILL}>{info.freq.label}</span>
        </div>
        <div>
          <span className="tw-mb-1 tw-block tw-body-x-small text-muted-aaa">CEFR level</span>
          <span className={PILL}>{info.cefr.label}</span>
        </div>
      </div>
    </section>
  );
}
