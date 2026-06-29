"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Layer, WordInfo } from "@/lib/types";

/** depth 0 is the kernel; the top layer is the most derived vocabulary. */
function layerNote(depth: number, count: number): string {
  if (depth === 0) return "the kernel — irreducible, defined only by each other";
  if (depth === count - 1) return "the most advanced — nothing is built from these";
  return "";
}

export default function LayersView({
  initialWord,
  onWordChange,
}: {
  initialWord: string;
  onWordChange?: (word: string) => void;
}) {
  const [query, setQuery] = useState(initialWord);
  const [depth, setDepth] = useState<number | null>(null);
  const [layerCount, setLayerCount] = useState(0);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // depth -> layer. The current layer and its two neighbors are kept warm here
  // so up/down navigation renders without a round-trip.
  const [cache, setCache] = useState<Record<number, Layer>>({});

  // Refs shadow the async state so fetchLayer can dedupe and bounds-check
  // against the latest values without waiting for a re-render.
  const cacheRef = useRef<Record<number, Layer>>({});
  const countRef = useRef(0);
  // The word we last anchored on, so the sync effect ignores an `initialWord`
  // that is merely our own onWordChange echoing back through the parent.
  const wordRef = useRef<string | null>(null);

  const fetchLayer = useCallback(async (n: number): Promise<Layer | null> => {
    if (n < 0 || n >= countRef.current) return null;
    const cached = cacheRef.current[n];
    if (cached) return cached;
    const res = await fetch(`/api/layer/${n}`);
    if (!res.ok) return null;
    const layer = (await res.json()) as Layer;
    cacheRef.current[n] = layer;
    setCache((m) => ({ ...m, [n]: layer }));
    return layer;
  }, []);

  // Show layer `n`, optionally spotlighting `anchorWord` within it, and warm the
  // adjacent layers so the next up/down step is instant.
  const show = useCallback(
    async (n: number, anchorWord: string | null) => {
      setDepth(n);
      setAnchor(anchorWord);
      if (anchorWord) {
        wordRef.current = anchorWord;
        onWordChange?.(anchorWord);
      }
      await fetchLayer(n);
      void fetchLayer(n - 1);
      void fetchLayer(n + 1);
    },
    [fetchLayer, onWordChange],
  );

  const search = useCallback(
    async (raw: string) => {
      const term = raw.trim().toLowerCase();
      if (!term) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/word/${encodeURIComponent(term)}`);
        if (!res.ok) {
          setError(`"${term}" is not in this dictionary`);
          return;
        }
        const info = (await res.json()) as WordInfo;
        setError(null);
        setQuery(term);
        wordRef.current = term;
        setLayerCount(info.layerCount);
        countRef.current = info.layerCount;
        await show(info.depth, term);
      } finally {
        setLoading(false);
      }
    },
    [show],
  );

  useEffect(() => {
    if (initialWord !== wordRef.current) void search(initialWord);
  }, [initialWord, search]);

  const current = depth === null ? null : cache[depth] ?? null;
  const below = depth === null ? null : cache[depth - 1] ?? null; // more basic
  const above = depth === null ? null : cache[depth + 1] ?? null; // more advanced

  return (
    <div className="layers">
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="a word — to see its layer…"
          spellCheck={false}
        />
        <button type="submit">show layer</button>
      </form>

      {error && <p className="error">{error}</p>}

      {depth !== null && (
        <div className="ladder">
          <NavStep
            direction="up"
            label="more advanced"
            target={depth + 1}
            layer={above}
            disabled={depth >= layerCount - 1}
            onGo={(d) => void show(d, null)}
            onWord={(d, w) => void show(d, w)}
          />

          <section className="layer-card">
            <header>
              <h2>
                layer {depth + 1} <span className="of">/ {layerCount}</span>
              </h2>
              <p className="meta">
                {current ? `${current.words.length.toLocaleString()} words` : "…"}
                {layerNote(depth, layerCount) && ` · ${layerNote(depth, layerCount)}`}
              </p>
            </header>
            {current ? (
              <div className="layer-words">
                {current.words.map((w) => (
                  <button
                    key={w}
                    className={w === anchor ? "chip anchor" : "chip"}
                    onClick={() => void show(depth, w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            ) : (
              <div className="layer-words placeholder">{loading ? "…" : ""}</div>
            )}
          </section>

          <NavStep
            direction="down"
            label="more basic"
            target={depth - 1}
            layer={below}
            disabled={depth <= 0}
            onGo={(d) => void show(d, null)}
            onWord={(d, w) => void show(d, w)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * One rung of the ladder: a button that walks to an adjacent layer, previewing
 * its size and most-central words from the already-prefetched data.
 */
function NavStep({
  direction,
  label,
  target,
  layer,
  disabled,
  onGo,
  onWord,
}: {
  direction: "up" | "down";
  label: string;
  target: number;
  layer: Layer | null;
  disabled: boolean;
  onGo: (depth: number) => void;
  onWord: (depth: number, word: string) => void;
}) {
  if (disabled) return <div className="nav-step empty" />;
  const arrow = direction === "up" ? "↑" : "↓";
  return (
    <div className={`nav-step ${direction}`}>
      <button className="nav-go" onClick={() => onGo(target)}>
        <span className="nav-label">
          {arrow} {label}
        </span>
        <span className="nav-count">
          {layer ? `layer ${target + 1} · ${layer.words.length.toLocaleString()} words` : "…"}
        </span>
      </button>
      {layer && (
        <div className="nav-peek">
          {layer.words.slice(0, 6).map((w) => (
            <button key={w} className="chip ghost" onClick={() => onWord(target, w)}>
              {w}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
