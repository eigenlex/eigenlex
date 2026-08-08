"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LoadingCircle, TextInput } from "@frontify/fondue/components";

// A typeahead <li role="option">, painted with Fondue tokens (per the ARIA combobox
// pattern the options carry the click handlers directly, not a nested control).
const OPTION =
  "tw-flex tw-min-h-[44px] tw-w-full tw-items-center tw-px-3 tw-py-1.5 tw-text-x-large tw-text-left tw-transition-colors";
const SUGGEST_DEBOUNCE_MS = 500;

/**
 * A word-lookup field with a debounced (500ms) typeahead dropdown backed by
 * /api/suggest. Controlled: the parent owns the text `value`; `onSubmit` fires
 * when a word is committed — a suggestion picked, Enter, the form submitted, or
 * typing that settles on a word the corpus already knows.
 */
export default function WordSearchBox({
  value,
  onValueChange,
  onSubmit,
  lang,
  ariaLabel,
  describedBy,
  placeholder,
  busy = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (word: string) => void;
  /** Source language whose vocabulary to suggest from. */
  lang: string;
  ariaLabel: string;
  describedBy?: string;
  placeholder: string;
  /** Lookup in flight: shows the field's spinner. */
  busy?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every suggest/commit so a slow in-flight response can't clobber
  // the dropdown after the user has moved on.
  const suggestSeq = useRef(0);
  const listboxId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  const closeSuggestions = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    suggestSeq.current++;
    setSuggestions([]);
    setOpen(false);
    setLoading(false);
    setActiveIndex(-1);
  }, []);

  const fetchSuggestions = useCallback(
    async (raw: string) => {
      const term = raw.trim();
      if (!term) return closeSuggestions();
      const reqId = ++suggestSeq.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}&lang=${lang}`);
        if (!res.ok || reqId !== suggestSeq.current) return;
        const words = (await res.json()) as string[];
        if (reqId !== suggestSeq.current) return; // superseded while fetching
        setSuggestions(words);
        setActiveIndex(-1);
        setOpen(words.length > 0);
        // Typing has settled on a word the corpus knows, so look it up unasked —
        // no button to press, and no failed lookup to report, since the suggestion
        // is the proof it exists (an exact match leads the list, see getSuggestions).
        // The dropdown stays up: it is also the way from "water" to "waterfall".
        if (words[0] && words[0].toLowerCase() === term.toLowerCase()) onSubmit(words[0]);
      } catch {
        /* a failed suggest fetch just leaves the dropdown as-is */
      } finally {
        // Only the latest request owns the spinner; a superseded one leaves it on.
        if (reqId === suggestSeq.current) setLoading(false);
      }
    },
    [closeSuggestions, lang, onSubmit],
  );

  const onQueryChange = useCallback(
    (next: string) => {
      onValueChange(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!next.trim()) return closeSuggestions();
      debounceRef.current = setTimeout(() => void fetchSuggestions(next), SUGGEST_DEBOUNCE_MS);
    },
    [onValueChange, fetchSuggestions, closeSuggestions],
  );

  // Asking for a word outright, as opposed to the auto-lookup above: the field takes
  // the word straight away rather than waiting on the fetch, and the list is done.
  const commit = useCallback(
    (word: string) => {
      onValueChange(word);
      closeSuggestions();
      onSubmit(word);
    },
    [onValueChange, closeSuggestions, onSubmit],
  );

  const onInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        if (!open && suggestions.length > 0) setOpen(true);
        else if (open) setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        if (open) {
          setActiveIndex((i) => Math.max(i - 1, 0));
          e.preventDefault();
        }
      } else if (e.key === "Enter") {
        // Pick the highlighted suggestion; otherwise let the form submit `value`.
        if (open && activeIndex >= 0 && suggestions[activeIndex]) {
          e.preventDefault();
          commit(suggestions[activeIndex]);
        }
      } else if (e.key === "Escape" && open) {
        closeSuggestions();
      }
    },
    [open, activeIndex, suggestions, commit, closeSuggestions],
  );

  // Cancel a pending debounce if the box unmounts mid-type (e.g. a tab switch).
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  // A language switch drops whatever the last keystroke asked for: those suggestions
  // come from the vocabulary just left, and the lookup they would trigger with them.
  // A no-op on mount, where there is nothing pending.
  useEffect(() => {
    closeSuggestions();
  }, [lang, closeSuggestions]);

  return (
    // No submit button: typing that settles on a word looks it up, and Enter still
    // submits implicitly for the rest. `flex` so the field shrinks below its
    // 40-character intrinsic width on a narrow panel instead of overflowing.
    <form
      className="tw-flex"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        commit(value);
      }}
    >
      {/* Stay clear of the ≥16px that keeps iOS from zooming on focus — Fondue's
          body-small (~13px) would trigger it. The placeholder is a separate element,
          sized in globals.css. */}
      <div className="tw-relative tw-w-fit [&_input]:tw-text-x-large">
        <TextInput.Root
          // TextInput.Root forwards unknown props to its <input> but omits the
          // combobox ARIA from its typed surface; attach them via a plain spread.
          {...({
            role: "combobox",
            "aria-autocomplete": "list",
            "aria-expanded": open,
            "aria-controls": listboxId,
            "aria-describedby": describedBy,
            "aria-activedescendant": open && activeIndex >= 0 ? optionId(activeIndex) : undefined,
            // Size the field to hold ~40 characters (HTML `size` → intrinsic width);
            // the tw-w-fit wrapper then hugs it instead of stretching to the row.
            // `size` is forwarded to the <input> at runtime but absent from Fondue's types.
            size: 40,
          } as object)}
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onInputKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
          autoComplete="off"
          placeholder={placeholder}
          spellCheck={false}
        />
        {/* One spinner for both waits — suggesting and looking up run into each other,
            and which one you are in is not a distinction worth drawing. Decorative:
            the result is what gets announced, by the card's live region. */}
        {(loading || busy) && (
          <div
            aria-hidden="true"
            className="tw-pointer-events-none tw-absolute tw-inset-y-0 tw-right-3 tw-flex tw-items-center"
          >
            <LoadingCircle size="x-small" />
          </div>
        )}
        {open && suggestions.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Word suggestions"
            lang={lang}
            className="tw-absolute tw-inset-x-0 tw-top-full tw-z-20 tw-mt-1 tw-max-h-64 tw-overflow-auto tw-rounded-large tw-border tw-border-line-subtle tw-bg-surface tw-py-1 tw-shadow-mid"
          >
            {suggestions.map((w, i) => (
              <li
                key={w}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                className={`${OPTION} tw-cursor-pointer ${
                  i === activeIndex
                    ? "tw-bg-surface-hover tw-text-primary"
                    : "tw-text-secondary hover:tw-bg-surface-hover hover:tw-text-primary"
                }`}
                // Keep focus on the input so onBlur doesn't close us before onClick.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(w)}
              >
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}
