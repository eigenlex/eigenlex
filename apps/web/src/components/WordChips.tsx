"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const GAP = 8; // tw-gap-2, in px — the space between chips, horizontally and between rows
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

// Integers [start, end).
function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i++) out.push(i);
  return out;
}

// The row holding word `idx`: the last row whose start index is <= idx.
function rowOfIndex(starts: number[], idx: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let row = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid]! <= idx) {
      row = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return row;
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
 *
 * Keyboard: the cloud is one composite tab stop (roving tabindex). Arrow keys
 * move between chips, Home/End jump to the ends. Because a chip that isn't near
 * the viewport isn't in the DOM, moving focus first scrolls the target into the
 * render window, and the active chip's row is always kept mounted — so keyboard
 * focus can never fall out of the cloud (WCAG 2.1.1 / 2.1.3).
 */
export default function WordChips({
  words,
  anchor,
  chipClass,
  anchorClass,
  onPick,
  label,
  lang,
}: {
  words: string[];
  anchor: string | null;
  chipClass: string;
  anchorClass: string;
  onPick: (word: string) => void;
  label: string;
  /** Source language of the words, for assistive tech. */
  lang?: string;
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

  // The chip that carries the roving tabindex (the cloud's single tab stop).
  // Clamped so it stays valid while `words` is between bands.
  const [activeRaw, setActive] = useState(0);
  const active = Math.min(Math.max(activeRaw, 0), Math.max(0, words.length - 1));
  const activeBtnRef = useRef<HTMLButtonElement | null>(null);
  const focusPendingRef = useRef(false); // set only by keyboard moves — never steals focus otherwise

  // Park the tab stop on the anchored word (or the first) when either changes, so
  // Tab enters the cloud at a sensible chip. Programmatic: doesn't move focus.
  useEffect(() => {
    setActive(anchorIndex >= 0 ? anchorIndex : 0);
  }, [anchorIndex, words]);

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
    const row = rowOfIndex(rows, anchorIndex);
    el.scrollTop = Math.max(0, row * stride - Math.max(0, (el.clientHeight - stride) / 2));
    setScrollTop(el.scrollTop);
  }, [anchor, anchorIndex, rows, stride, mode]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  // Move the roving focus to `idx`: scroll its row just into view (so a
  // virtualized chip is mounted) then let the layout effect pull focus onto it.
  const moveActive = useCallback(
    (idx: number) => {
      focusPendingRef.current = true;
      setActive(idx);
      const el = scrollRef.current;
      if (el && mode === "virtual" && rows && stride > 0) {
        const top = rowOfIndex(rows, idx) * stride;
        const bottom = top + stride;
        if (top < el.scrollTop) el.scrollTop = top;
        else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
        setScrollTop(el.scrollTop);
      }
    },
    [mode, rows, stride],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const len = words.length;
      if (len === 0) return;
      const grid = mode === "virtual" && rows && stride > 0 ? rows : null;
      let next = active;
      switch (e.key) {
        case "ArrowRight":
          next = Math.min(active + 1, len - 1);
          break;
        case "ArrowLeft":
          next = Math.max(active - 1, 0);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = len - 1;
          break;
        case "ArrowDown":
          if (grid) {
            const r = rowOfIndex(grid, active);
            if (r + 1 < grid.length) {
              const col = active - grid[r]!;
              const nextRowEnd = r + 2 < grid.length ? grid[r + 2]! : len;
              next = Math.min(grid[r + 1]! + col, nextRowEnd - 1);
            }
          } else next = Math.min(active + 1, len - 1);
          break;
        case "ArrowUp":
          if (grid) {
            const r = rowOfIndex(grid, active);
            if (r > 0) {
              const col = active - grid[r]!;
              next = Math.min(grid[r - 1]! + col, grid[r]! - 1);
            }
          } else next = Math.max(active - 1, 0);
          break;
        default:
          return;
      }
      e.preventDefault();
      if (next !== active) moveActive(next);
    },
    [words.length, active, mode, rows, stride, moveActive],
  );

  // After a keyboard move re-renders (target row now mounted), take focus.
  useLayoutEffect(() => {
    if (focusPendingRef.current && activeBtnRef.current) {
      activeBtnRef.current.focus();
      focusPendingRef.current = false;
    }
  });

  const chip = (w: string, index: number) => {
    const isActive = index === active;
    const isAnchor = w === anchor;
    return (
      <button
        key={w}
        ref={(node) => {
          if (isActive) activeBtnRef.current = node;
          if (isAnchor) anchorRef.current = node;
        }}
        className={isAnchor ? anchorClass : chipClass}
        aria-current={isAnchor ? "true" : undefined}
        tabIndex={isActive ? 0 : -1}
        onClick={() => {
          setActive(index);
          onPick(w);
        }}
      >
        {w}
      </button>
    );
  };

  let content: ReactNode;
  if (mode === "fallback") {
    content = <div className="tw-flex tw-flex-wrap tw-gap-2">{words.map(chip)}</div>;
  } else if (rows && stride > 0) {
    const first = Math.max(0, Math.floor(scrollTop / stride) - OVERSCAN);
    const last = Math.min(rows.length, Math.ceil((scrollTop + viewport) / stride) + OVERSCAN);
    // Render the viewport window, plus the active chip's row wherever it is, so the
    // roving tab stop is always mounted and keyboard focus can't be dropped.
    const activeRow = rowOfIndex(rows, active);
    const toRender = activeRow < first || activeRow >= last ? [...range(first, last), activeRow] : range(first, last);
    const rowEls = toRender.map((r) => {
      const start = rows[r]!;
      const end = r + 1 < rows.length ? rows[r + 1]! : words.length;
      return (
        <div
          key={start}
          className="tw-absolute tw-left-0 tw-right-0 tw-flex tw-gap-2"
          style={{ top: r * stride }}
        >
          {words.slice(start, end).map((w, i) => chip(w, start + i))}
        </div>
      );
    });
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
      onKeyDown={onKeyDown}
      className="WordChips tw-relative tw-max-h-[30rem] tw-overflow-y-auto tw-overflow-x-hidden"
      role="group"
      aria-label={label}
      lang={lang}
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
