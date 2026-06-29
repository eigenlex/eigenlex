"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EgoGraph, WordInfo } from "@/lib/types";

const GraphView = dynamic(() => import("@/components/GraphView"), { ssr: false });

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
    <div className="explorer">
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void load(query);
        }}
      >
        <label className="sr-only" htmlFor="explorer-search">
          Look up a word
        </label>
        <input
          id="explorer-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="look up a word…"
          spellCheck={false}
          autoFocus
        />
        <button type="submit">explore</button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="panes">
        <section className="graph-pane">
          {ego && ego.nodes.length > 1 ? (
            <GraphView ego={ego} onSelect={select} />
          ) : (
            <div className="graph placeholder">{loading ? "…" : "no connections"}</div>
          )}
          <p className="legend">
            <span className="dot focus" /> {word}
            <span className="dot defines" /> defined using
            <span className="dot usedBy" /> used to define
            <span className="dot mutual" /> mutual (circular)
            <span className="hint">brighter = more advanced · hover to spotlight · click to walk</span>
          </p>
        </section>

        {info && (
          <aside className="details">
            <h2>{info.word}</h2>
            <p className="meta">
              PageRank #{info.rank} · component {info.componentSize.toLocaleString()} · layer{" "}
              {info.depth + 1}/{info.layerCount}
              {info.inKernel ? " · kernel" : ""}
            </p>
            {info.senses.length > 0 && (
              <ol className="senses">
                {info.senses.slice(0, 6).map((sense, i) => (
                  <li key={i}>{sense}</li>
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
    <div className="chips">
      <h3>{title}</h3>
      <div>
        {words.map((w) => (
          <button key={w} className="chip" onClick={() => onSelect(w)}>
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
