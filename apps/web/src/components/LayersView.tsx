"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Layer, LayerSummary, WordInfo } from "@/lib/types";

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
  // The whole stratification profile (per-layer counts), driving the rail.
  const [summary, setSummary] = useState<LayerSummary | null>(null);

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

  // The profile is global; fetch it once so the rail can render every layer.
  useEffect(() => {
    let live = true;
    void fetch("/api/layers")
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => live && s && setSummary(s as LayerSummary));
    return () => {
      live = false;
    };
  }, []);

  const current = depth === null ? null : cache[depth] ?? null;

  return (
    <div className="layers">
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <label className="sr-only" htmlFor="layers-search">
          Find a word to see its layer
        </label>
        <input
          id="layers-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="a word — to see its layer…"
          spellCheck={false}
        />
        <button type="submit" disabled={loading}>
          {loading ? "…" : "show layer"}
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {depth !== null && (
        <div className="layers-body">
          {summary && summary.layerCount > 1 && (
            <LayerRail sizes={summary.sizes} depth={depth} onJump={(d) => void show(d, null)} />
          )}
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
              <div className="layer-words" role="group" aria-label={`Words in layer ${depth + 1}`}>
                {current.words.map((w) => (
                  <button
                    key={w}
                    className={w === anchor ? "chip anchor" : "chip"}
                    aria-current={w === anchor ? "true" : undefined}
                    onClick={() => void show(depth, w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            ) : (
              <div className="layer-words placeholder">…</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * The whole stratification as a vertical scale: one rung per layer, most
 * advanced on top down to the kernel, each rung's bar log-scaled to its word
 * count so the small layers stay legible beside the giant core. A single-select
 * listbox — one tab stop, arrows/Home/End to move, click to jump; selecting a
 * layer navigates to it and the view warms the new neighbors on landing.
 */
function LayerRail({
  sizes,
  depth,
  onJump,
}: {
  sizes: number[];
  depth: number;
  onJump: (depth: number) => void;
}) {
  const logMax = Math.log(Math.max(...sizes, 1) + 1);
  const top = sizes.length - 1;
  const move = (next: number) => {
    if (next >= 0 && next <= top && next !== depth) onJump(next);
  };
  // DOM order is top..0 (most advanced first), so ArrowUp goes to a higher depth.
  const onKeyDown = (e: KeyboardEvent) => {
    const next =
      e.key === "ArrowUp" ? depth + 1
      : e.key === "ArrowDown" ? depth - 1
      : e.key === "Home" ? top
      : e.key === "End" ? 0
      : null;
    if (next === null) return;
    e.preventDefault();
    move(next);
  };
  return (
    <div
      className="rail"
      role="listbox"
      aria-label="Layers, most advanced to most basic"
      tabIndex={0}
      aria-activedescendant={`rung-${depth}`}
      onKeyDown={onKeyDown}
    >
      {sizes.map((_, i) => top - i).map((n) => {
        const active = n === depth;
        const pct = Math.max((Math.log(sizes[n]! + 1) / logMax) * 100, 1.5);
        return (
          <div
            key={n}
            id={`rung-${n}`}
            role="option"
            aria-selected={active}
            aria-label={`Layer ${n + 1}, ${sizes[n]!.toLocaleString()} words`}
            className={active ? "rung active" : "rung"}
            onClick={() => move(n)}
          >
            <span className="rung-num" aria-hidden="true">{n + 1}</span>
            <span className="rung-bar" aria-hidden="true">
              <span className="rung-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="rung-size" aria-hidden="true">{sizes[n]!.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
