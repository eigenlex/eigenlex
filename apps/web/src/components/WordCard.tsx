"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Badge, Select, Tooltip } from "@frontify/fondue/components";
import type { WordBands } from "@/lib/types";
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
          <span lang={code}>{endonym(code)}</span>
        </Select.Item>
      ))}
    </Select>
  );
}

// x-large, the next step up the type scale, but at body weight — Fondue has no
// body-x-large, and its typography utilities are emitted last, so a class can't
// override them. Line height comes along or 20px text sits in a 20px box.
const GLOSS_TYPE = {
  fontSize: "var(--typography-font-size-x-large)",
  lineHeight: "var(--typography-line-height-loose)",
};

// A metric in the card's stat row. The caption costs more room than it earns, so it
// rides in a tooltip instead — Fondue's opens on hover and focus, and the click handler
// adds tap, which it doesn't cover. The label is also in the accessible name, so it is
// never hover-only. Padding makes a 44px target (WCAG 2.5.5) that negative margin keeps
// out of the layout, so the row stays one badge tall.
function Stat({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Escape must dismiss it (WCAG 1.4.13) — controlling `open` ourselves means Radix's
  // own handler no longer fires, and hover-opened tooltips never hold focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <Tooltip.Root open={open} onOpenChange={setOpen} enterDelay={200}>
      <Tooltip.Trigger asChild>
        <span
          tabIndex={0}
          onClick={() => setOpen((o) => !o)}
          className="tw--my-[10px] tw--mx-1 tw-inline-flex tw-min-h-[44px] tw-min-w-[44px] tw-cursor-help tw-items-center tw-justify-center tw-rounded-[8px] tw-px-1"
        >
          <span className="visually-hidden">{label}: </span>
          {children}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip.Root>
  );
}

/** The looked-up word, its translation, and where it sits — both band labelings. */
export default function WordCard({
  info,
  lang,
  tl,
  onTlChange,
}: {
  info: WordBands;
  lang: string;
  /** Target/gloss language, owned by the workspace so it can ride in the URL. */
  tl: string;
  onTlChange: (l: string) => void;
}) {
  // No point translating a word into its own language.
  const translate = tl !== lang;
  // A case-homograph translates each casing separately; everything else is one gloss.
  const forms = info.forms ?? [info.word];
  const homograph = forms.length > 1;
  const single = useGloss(info.word, lang, tl, translate && !homograph);
  const multi = useForms(forms, lang, tl, translate && homograph);

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
    <section className="WordCard tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-px-6 tw-py-5">
      {/* Wraps on the card's own width, not the viewport's — it is also cramped in the
          two-column layout just past 860px. Alone on a wrapped row, justify-between
          leaves the controls at the start. */}
      <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-4">
        {/* The word is a quiet label — it's already in the search box and word chips;
            its meaning is the card's hero. */}
        <div className="tw-min-w-0 tw-grow tw-basis-[17rem]">
          <h2 className="tw-heading-x-large text-muted-aaa tw-break-words" lang={lang}>
            {info.word}
          </h2>
          {/* Announce translation state changes to assistive tech (WCAG 4.1.3). */}
          <div aria-live="polite" className="tw-mt-1">
            {translate && status === "loading" && (
              <span className="tw-body-small text-muted-aaa">translating…</span>
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
              <span className="tw-body-small text-muted-aaa">no translation</span>
            )}
          </div>
        </div>
        {/* Translation controls. Both are 44px targets (WCAG 2.5.5). */}
        <div className="tw-flex tw-shrink-0 tw-flex-col tw-items-stretch tw-gap-1.5">
          <div className="tw-w-44 [&_[role=combobox]]:tw-min-h-[44px]">
            <LanguageSelect value={tl} onChange={onTlChange} />
          </div>
          <a
            href={translateHref(info.word, lang, tl)}
            // Opens a fresh tab every time (named-tab reuse can't survive Google
            // clearing window.name) — accepted, for its pronunciation audio.
            target="_blank"
            rel="noopener noreferrer"
            className="tw-inline-flex tw-min-h-[44px] tw-items-center tw-justify-center tw-gap-1 tw-rounded-full tw-border tw-border-line-subtle tw-px-4 tw-py-1.5 tw-body-large tw-text-secondary tw-no-underline hover:tw-border-line hover:tw-text-primary"
          >
            Google Translate ↗
          </a>
        </div>
      </div>

      <div className="tw-mt-4 tw-flex tw-flex-wrap tw-items-center tw-gap-x-5 tw-gap-y-3 tw-border-t tw-border-line-subtle tw-pt-3">
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
