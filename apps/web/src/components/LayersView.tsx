"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, TextInput } from "@frontify/fondue/components";
import WordChips from "@/components/WordChips";
import type { Layer, LayerSummary, WordInfo } from "@/lib/types";

// A word pill, painted with Fondue tokens; the anchor variant marks the searched word.
const CHIP_BASE =
  "tw-inline-flex tw-items-center tw-min-h-[24px] tw-rounded-full tw-border tw-px-3 tw-py-1 " +
  "tw-body-small tw-transition-colors";
const CHIP =
  `${CHIP_BASE} tw-border-line-subtle tw-bg-surface-hover tw-text-secondary ` +
  "hover:tw-bg-surface-active hover:tw-text-primary";
const CHIP_ANCHOR =
  `${CHIP_BASE} tw-border-[color:var(--accent-focus)] tw-bg-[color:var(--accent-focus)] ` +
  "tw-font-medium tw-text-[#0b1220]";

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
    <div className="LayersView">
      <form
        className="tw-mb-4 tw-flex tw-gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <div className="tw-flex-1">
          <TextInput.Root
            aria-label="Find a word to see its layer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="a word — to see its layer…"
            spellCheck={false}
            className="tw-w-full"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "…" : "show layer"}
        </Button>
      </form>

      {error && (
        <p className="tw-mb-4 tw-body-medium tw-text-error" role="alert">
          {error}
        </p>
      )}

      {depth !== null && (
        <div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-4 min-[700px]:tw-grid-cols-[auto_1fr]">
          {summary && summary.layerCount > 1 && (
            <LayerRail sizes={summary.sizes} depth={depth} onJump={(d) => void show(d, null)} />
          )}
          <section className="tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-px-5 tw-py-4">
            <header>
              <h2 className="tw-heading-x-large-strong">
                layer {depth + 1}{" "}
                <span className="tw-body-large tw-font-regular tw-text-low-contrast">
                  / {layerCount}
                </span>
              </h2>
              <p className="tw-mb-4 tw-mt-1 tw-body-small tw-text-low-contrast">
                {current ? `${current.words.length.toLocaleString()} words` : "…"}
                {layerNote(depth, layerCount) && ` · ${layerNote(depth, layerCount)}`}
              </p>
            </header>
            {current ? (
              <WordChips
                words={current.words}
                anchor={anchor}
                chipClass={CHIP}
                anchorClass={CHIP_ANCHOR}
                onPick={(w) => void show(depth, w)}
                label={`Words in layer ${depth + 1}`}
              />
            ) : (
              <div className="tw-min-h-[2rem] tw-text-low-contrast">…</div>
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
      className="LayerRail tw-flex tw-w-full tw-flex-col tw-gap-[2px] tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-p-2 focus-visible:tw-border-line-strong min-[700px]:tw-w-52"
      role="listbox"
      aria-label="Layers, most advanced to most basic"
      tabIndex={0}
      aria-activedescendant={`rung-${depth}`}
      onKeyDown={onKeyDown}
    >
      {/* Column header: names the two numbers flanking each bar. */}
      <div
        className="tw-mb-1 tw-flex tw-items-center tw-justify-between tw-border-b tw-border-line-subtle tw-px-1 tw-pb-1 tw-body-x-small tw-text-low-contrast"
        aria-hidden="true"
      >
        <span>layer</span>
        <span>words</span>
      </div>
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
            className={
              "tw-grid tw-min-h-[28px] tw-cursor-pointer tw-grid-cols-[1.4rem_1fr_auto] tw-items-center tw-gap-2 tw-rounded-[6px] tw-px-1 tw-py-1 tw-text-left tw-body-x-small tw-transition-colors " +
              (active
                ? "tw-bg-surface-hover tw-text-primary"
                : "tw-text-low-contrast hover:tw-bg-surface-hover hover:tw-text-primary")
            }
            onClick={() => move(n)}
          >
            <span className="tw-text-right tw-tabular-nums" aria-hidden="true">
              {n + 1}
            </span>
            <span
              className="tw-h-[0.6rem] tw-overflow-hidden tw-rounded-[3px] tw-bg-surface-dim"
              aria-hidden="true"
            >
              <span
                className="tw-block tw-h-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: active ? "var(--accent-focus)" : "var(--accent-defines)",
                  opacity: active ? 1 : 0.45,
                }}
              />
            </span>
            <span className="tw-tabular-nums" aria-hidden="true">
              {sizes[n]!.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
