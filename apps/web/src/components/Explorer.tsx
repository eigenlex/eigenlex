"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button, TextInput } from "@frontify/fondue/components";
import type { EgoGraph, WordInfo } from "@/lib/types";

const GraphView = dynamic(() => import("@/components/GraphView"), { ssr: false });

// A word pill. Kept a native button (Fondue's Button doesn't forward aria-current
// and these lists can run long) but painted with Fondue tokens.
const CHIP =
  "tw-inline-flex tw-items-center tw-min-h-[24px] tw-rounded-full tw-border tw-border-line-subtle " +
  "tw-bg-surface-hover tw-px-3 tw-py-1 tw-body-small tw-text-secondary tw-transition-colors " +
  "hover:tw-bg-surface-active hover:tw-text-primary";

export default function Explorer({
  initialWord,
  onWordChange,
}: {
  initialWord: string;
  onWordChange?: (word: string) => void;
}) {
  const [query, setQuery] = useState(initialWord);
  const [word, setWord] = useState(initialWord);
  const [info, setInfo] = useState<WordInfo | null>(null);
  const [ego, setEgo] = useState<EgoGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The last word we loaded, so the sync effect can ignore an `initialWord` that
  // is just our own onWordChange echoing back through the shared parent state.
  const loadedRef = useRef<string | null>(null);

  const load = useCallback(async (raw: string) => {
    const term = raw.trim().toLowerCase();
    if (!term) return;
    loadedRef.current = term;
    setLoading(true);
    try {
      const res = await fetch(`/api/word/${encodeURIComponent(term)}`);
      if (!res.ok) {
        setError(`"${term}" is not in this dictionary`);
        return;
      }
      setError(null);
      setInfo((await res.json()) as WordInfo);
      setWord(term);
      setQuery(term);
      onWordChange?.(term);
      const egoRes = await fetch(`/api/ego/${encodeURIComponent(term)}`);
      setEgo(egoRes.ok ? ((await egoRes.json()) as EgoGraph) : null);
    } finally {
      setLoading(false);
    }
  }, [onWordChange]);

  useEffect(() => {
    if (initialWord !== loadedRef.current) void load(initialWord);
  }, [initialWord, load]);

  const select = useCallback((w: string) => void load(w), [load]);

  return (
    <div className="Explorer">
      <form
        className="tw-mb-4 tw-flex tw-gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void load(query);
        }}
      >
        <div className="tw-flex-1">
          <TextInput.Root
            aria-label="Look up a word"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="look up a word…"
            spellCheck={false}
            className="tw-w-full"
          />
        </div>
        <Button type="submit">explore</Button>
      </form>

      {error && (
        <p className="tw-mb-4 tw-body-medium tw-text-error" role="alert">
          {error}
        </p>
      )}

      <div className="tw-grid tw-grid-cols-1 tw-gap-5 min-[800px]:tw-grid-cols-[1.3fr_1fr]">
        <section className="tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-p-2">
          {ego && ego.nodes.length > 1 ? (
            <GraphView ego={ego} onSelect={select} />
          ) : (
            <div className="tw-flex tw-h-[460px] tw-w-full tw-items-center tw-justify-center tw-rounded-large tw-text-low-contrast">
              {loading ? "…" : "no connections"}
            </div>
          )}
          <p className="tw-mx-1 tw-mb-1 tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-1 tw-body-small tw-text-low-contrast">
            <span className="dot focus" /> {word}
            <span className="dot defines" /> defined using
            <span className="dot usedBy" /> used to define
            <span className="dot mutual" /> mutual (circular)
            <span className="tw-ml-auto tw-italic">
              brighter = more advanced · hover to spotlight · click to walk
            </span>
          </p>
        </section>

        {info && (
          <aside className="tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-p-5">
            <h2 className="tw-heading-x-large-strong">{info.word}</h2>
            <p className="tw-mb-4 tw-mt-1 tw-body-small tw-text-low-contrast">
              PageRank #{info.rank} · component {info.componentSize.toLocaleString()} · layer{" "}
              {info.depth + 1}/{info.layerCount}
              {info.inKernel ? " · kernel" : ""}
            </p>
            {info.senses.length > 0 && (
              <ol className="tw-mb-5 tw-list-decimal tw-pl-5 tw-body-medium tw-text-primary">
                {info.senses.slice(0, 6).map((sense, i) => (
                  <li key={i} className="tw-mb-1">
                    {sense}
                  </li>
                ))}
              </ol>
            )}
            <Chips title="defined using" words={info.defines} onSelect={select} />
            <Chips title="used to define" words={info.usedBy.slice(0, 30)} onSelect={select} />
          </aside>
        )}
      </div>
    </div>
  );
}

function Chips({
  title,
  words,
  onSelect,
}: {
  title: string;
  words: string[];
  onSelect: (w: string) => void;
}) {
  if (words.length === 0) return null;
  return (
    <div className="Chips tw-mt-4">
      <h3 className="tw-heading-category tw-mb-2 tw-text-low-contrast">{title}</h3>
      <div className="tw-flex tw-flex-wrap tw-gap-1">
        {words.map((w) => (
          <button key={w} className={CHIP} onClick={() => onSelect(w)}>
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
