"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const GAP = 4; // tw-gap-1, in px — the space between chips, horizontally and between rows
const OVERSCAN = 4; // extra rows kept mounted above and below the viewport

/**
 * Greedy line-break: pack chips into rows that fit `containerWidth`, always at
 * least one per row. Returns each row's start index; row r spans
 * [starts[r], starts[r + 1]).
 */
export function packRows(widths: number[], containerWidth: number, gap = GAP): number[] {
  const starts: number[] = [];
  let i = 0;
  while (i < widths.length) {
    starts.push(i);
    let used = widths[i++]!;
    while (i < widths.length && used + gap + widths[i]! <= containerWidth) {
      used += gap + widths[i++]!;
    }
  }
  return starts;
}

interface Metrics {
  font: string; // canvas font shorthand for measuring text
  chromeX: number; // horizontal padding + border of a chip
  height: number; // a chip's rendered height
  letter: number; // letter-spacing, added back since canvas ignores it
}

/**
 * A scrollable word cloud that virtualizes its chips: a layer can hold tens of
 * thousands of words, far too many to keep in the DOM. Chip widths are measured
 * with a canvas, packed into fixed-height rows, and only the rows near the
 * viewport are rendered. `anchor` is scrolled into view when it changes.
 *
 * Where there's no layout (SSR/jsdom), it falls back to a plain wrapping cloud
 * so tests and non-visual environments still see every chip.
 */
export default function WordChips({
  words,
  anchor,
  chipClass,
  anchorClass,
  onPick,
  label,
}: {
  words: string[];
  anchor: string | null;
  chipClass: string;
  anchorClass: string;
  onPick: (word: string) => void;
  label: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [mode, setMode] = useState<"pending" | "virtual" | "fallback">("pending");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [width, setWidth] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // Measure the chip font, chrome, and height from a hidden probe — synchronously
  // before paint, and read the container width off the DOM — so the very first
  // render is already virtualized and we never mount every chip at once.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const probe = probeRef.current;
    if (!el || !probe || probe.offsetHeight === 0) {
      setMode("fallback"); // no layout (SSR/jsdom): render them all
      return;
    }
    const cs = getComputedStyle(probe);
    setMetrics({
      font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
      chromeX:
        parseFloat(cs.paddingLeft) +
        parseFloat(cs.paddingRight) +
        parseFloat(cs.borderLeftWidth) +
        parseFloat(cs.borderRightWidth),
      height: probe.offsetHeight,
      letter: cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) || 0,
    });
    setWidth(el.clientWidth);
    setViewport(el.clientHeight);
    setMode("virtual");
  }, []);

  // Keep width/height current as the container resizes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || mode !== "virtual" || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth);
      setViewport(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Per-word pixel widths via canvas text metrics — no reflow, so measuring a
  // whole layer stays cheap. +1px absorbs sub-pixel rounding so a packed row
  // can't overflow and wrap.
  const widths = useMemo(() => {
    if (!metrics) return null;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return null;
    ctx.font = metrics.font;
    return words.map((w) =>
      Math.ceil(ctx.measureText(w).width + metrics.letter * w.length + metrics.chromeX + 1),
    );
  }, [words, metrics]);

  const rows = useMemo(
    () => (widths && width > 0 ? packRows(widths, width) : null),
    [widths, width],
  );
  const stride = (metrics?.height ?? 0) + GAP;
  const anchorIndex = anchor ? words.indexOf(anchor) : -1;

  // Spotlight: scroll the anchored word's row to the middle of the viewport.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (mode === "fallback") {
      if (anchor) anchorRef.current?.scrollIntoView?.({ block: "nearest" });
      return;
    }
    if (!rows || stride <= 0) return;
    if (anchorIndex < 0) {
      el.scrollTop = 0;
      setScrollTop(0);
      return;
    }
    // The row holding the anchor is the last one whose start index precedes it.
    let lo = 0;
    let hi = rows.length - 1;
    let row = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid]! <= anchorIndex) {
        row = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    el.scrollTop = Math.max(0, row * stride - Math.max(0, (el.clientHeight - stride) / 2));
    setScrollTop(el.scrollTop);
  }, [anchor, anchorIndex, rows, stride, mode]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  const chip = (w: string) => (
    <button
      key={w}
      ref={w === anchor ? anchorRef : undefined}
      className={w === anchor ? anchorClass : chipClass}
      aria-current={w === anchor ? "true" : undefined}
      onClick={() => onPick(w)}
    >
      {w}
    </button>
  );

  let content: ReactNode;
  if (mode === "fallback") {
    content = <div className="tw-flex tw-flex-wrap tw-gap-1">{words.map(chip)}</div>;
  } else if (rows && stride > 0) {
    const first = Math.max(0, Math.floor(scrollTop / stride) - OVERSCAN);
    const last = Math.min(rows.length, Math.ceil((scrollTop + viewport) / stride) + OVERSCAN);
    const rowEls: ReactNode[] = [];
    for (let r = first; r < last; r++) {
      const start = rows[r]!;
      const end = r + 1 < rows.length ? rows[r + 1]! : words.length;
      rowEls.push(
        <div
          key={start}
          className="tw-absolute tw-left-0 tw-right-0 tw-flex tw-gap-1"
          style={{ top: r * stride }}
        >
          {words.slice(start, end).map(chip)}
        </div>,
      );
    }
    content = (
      <div className="tw-relative" style={{ height: rows.length * stride - GAP }}>
        {rowEls}
      </div>
    );
  } else {
    content = <div className="tw-min-h-[2rem]" aria-hidden="true" />;
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="WordChips tw-relative tw-max-h-[22rem] tw-overflow-y-auto tw-overflow-x-hidden"
      role="group"
      aria-label={label}
    >
      {/* Hidden probe: the source of truth for chip font and height. */}
      <span
        ref={probeRef}
        className={chipClass}
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        x
      </span>
      {content}
    </div>
  );
}
