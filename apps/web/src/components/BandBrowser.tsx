"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Loading from "@/components/Loading";
import WordChips from "@/components/WordChips";
import type { Band, BandSummary, BandView } from "@/lib/types";

// Word pills, painted with Fondue tokens; the anchor variant marks the looked-up word.
const CHIP_BASE =
  "tw-inline-flex tw-items-center tw-min-h-[24px] tw-rounded-full tw-border tw-px-3 tw-py-1 " +
  "tw-body-small tw-transition-colors";
const CHIP =
  `${CHIP_BASE} tw-border-line-subtle tw-bg-surface-hover tw-text-secondary ` +
  "hover:tw-bg-surface-active hover:tw-text-primary";
const CHIP_ANCHOR =
  `${CHIP_BASE} tw-border-[color:var(--accent-focus)] tw-bg-[color:var(--accent-focus)] ` +
  "tw-font-medium tw-text-[#0b1220]";

/**
 * Browse the whole vocabulary split into bands for the active view. The band
 * holding the looked-up word (`anchorBandKey`) opens automatically and spotlights
 * it; picking any chip looks that word up via `onSelect`.
 */
export default function BandBrowser({
  view,
  anchorWord,
  anchorBandKey,
  onSelect,
}: {
  view: BandView;
  anchorWord: string | null;
  anchorBandKey: string | null;
  onSelect: (word: string) => void;
}) {
  const [summary, setSummary] = useState<BandSummary[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  // Warm-cache bands by `view:key` so re-selecting is instant.
  const cache = useRef<Record<string, Band>>({});

  // Load the summary (the tabs) whenever the view changes.
  useEffect(() => {
    let live = true;
    setSummary(null);
    setBand(null);
    void fetch(`/api/bands/${view}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => live && s && setSummary(s as BandSummary[]));
    return () => {
      live = false;
    };
  }, [view]);

  // Select the anchor's band; else keep the current one; else the first.
  useEffect(() => {
    if (!summary) return;
    const keys = summary.map((b) => b.key);
    setSelectedKey((prev) =>
      anchorBandKey && keys.includes(anchorBandKey)
        ? anchorBandKey
        : prev && keys.includes(prev)
          ? prev
          : (keys[0] ?? null),
    );
  }, [summary, anchorBandKey]);

  const fetchBand = useCallback(
    async (key: string) => {
      const ck = `${view}:${key}`;
      const hit = cache.current[ck];
      if (hit) {
        setBand(hit);
        return;
      }
      const res = await fetch(`/api/band/${view}/${encodeURIComponent(key)}`);
      if (!res.ok) return;
      const b = (await res.json()) as Band;
      cache.current[ck] = b;
      setBand(b);
    },
    [view],
  );

  useEffect(() => {
    if (selectedKey) void fetchBand(selectedKey);
  }, [selectedKey, fetchBand]);

  // Spotlight the anchor only in the band it actually belongs to.
  const anchorInBand = band && band.key === anchorBandKey ? anchorWord : null;

  return (
    <div className="BandBrowser tw-grid tw-grid-cols-1 tw-items-start tw-gap-4 min-[700px]:tw-grid-cols-[auto_1fr]">
      <div
        role="tablist"
        aria-label={view === "cefr" ? "CEFR levels" : "Frequency bands"}
        aria-orientation="vertical"
        className="tw-flex tw-flex-row tw-flex-wrap tw-gap-1 tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-p-2 min-[700px]:tw-w-56 min-[700px]:tw-flex-col"
      >
        {(summary ?? []).map((b) => {
          const active = b.key === selectedKey;
          return (
            <button
              key={b.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedKey(b.key)}
              className={
                "tw-flex tw-min-h-[28px] tw-items-center tw-justify-between tw-gap-3 tw-rounded-[6px] tw-px-2 tw-py-1 tw-text-left tw-body-small tw-transition-colors " +
                (active
                  ? "tw-bg-surface-hover tw-text-primary"
                  : "tw-text-low-contrast hover:tw-bg-surface-hover hover:tw-text-primary")
              }
            >
              <span>{b.label}</span>
              <span className="tw-tabular-nums tw-body-x-small tw-text-low-contrast">
                {b.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      <section className="tw-min-w-0 tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-px-5 tw-py-4">
        {band ? (
          <>
            <header>
              <h2 className="tw-heading-x-large-strong">{band.label}</h2>
              <p className="tw-mb-4 tw-mt-1 tw-body-small tw-text-low-contrast">
                {band.words.length.toLocaleString()} words · most frequent first
              </p>
            </header>
            <WordChips
              words={band.words}
              anchor={anchorInBand}
              chipClass={CHIP}
              anchorClass={CHIP_ANCHOR}
              onPick={onSelect}
              label={`Words in ${band.label}`}
            />
          </>
        ) : (
          <Loading className="tw-min-h-[200px]" label="Loading band…" />
        )}
      </section>
    </div>
  );
}
