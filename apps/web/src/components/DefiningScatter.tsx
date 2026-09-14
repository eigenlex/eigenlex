"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useThemeToggle } from "@/app/providers";
import Loading from "@/components/Loading";

/**
 * The defining view's figure: every levelled word as a point, frequency across, defining
 * level up. The tabs below are the browse surface and the accessible one; this says the
 * thing the tabs cannot, which is that the two axes come apart. Read one vertical slice —
 * one CEFR stripe, words of near-equal frequency — and the points still spread over every
 * level. That separation is the whole claim the view rests on.
 *
 * Deliberately not zoomable. The prototype's pan, box-zoom and full-screen exist to hunt
 * individual words; here the tabs below do that better, with a keyboard and a screen
 * reader, so the figure stays one static picture and one click target.
 */

/** Rank boundaries the CEFR bands top out at — drawn as the vertical stripes. */
const CEFR_EDGES = [1000, 3000, 6000, 12000, 25000];
const LEVELS = 7;
const PAD = { top: 10, right: 12, bottom: 26, left: 34 };
/** Point radius, and the hover radius around the cursor, in CSS pixels. */
const DOT = 1.6;
const HOVER = 7;
/** Rough height of the pointer cursor's glyph, and of the hover label. */
const CURSOR = 22;
const TIP_H = 26;

interface Points {
  /** One char per ranked word: "1"-"7", or "-" for a word with no level. */
  levels: string;
  words: string[];
}

/**
 * Stable per-word vertical offset inside its level band. The level is 7 discrete values,
 * so without this every point stacks on seven straight lines and the density is invisible.
 * Hashed from the word rather than random, so points never move between repaints.
 */
function jitter(word: string): number {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (Math.imul(h, 31) + word.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

/**
 * Where the hover label sits relative to the cursor. Above it, not below: a cursor's
 * hotspot is its top-left corner and the glyph hangs down and to the right of that, so
 * anything placed below-right is drawn under the cursor itself. The pointer cursor this
 * canvas switches to is the bigger of the two, about 22px tall, which is what CURSOR
 * clears. Flips below only in the top strip, where there is no room above.
 */
export function tipStyle(hover: { x: number; y: number }, wrapWidth: number): React.CSSProperties {
  const flipX = hover.x > wrapWidth * 0.66;
  const flipY = hover.y < CURSOR + TIP_H;
  return {
    left: hover.x + (flipX ? -8 : 8),
    top: hover.y + (flipY ? CURSOR : -8),
    transform: `${flipX ? "translateX(-100%)" : ""} ${flipY ? "" : "translateY(-100%)"}`.trim(),
  };
}

export default function DefiningScatter({
  source,
  anchorWord,
  onSelect,
}: {
  source: string;
  /** The looked-up word, drawn in the accent colour so it can be found in the cloud. */
  anchorWord: string | null;
  onSelect: (word: string) => void;
}) {
  const { resolvedTheme } = useThemeToggle();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [points, setPoints] = useState<Points | null>(null);
  const [hover, setHover] = useState<{ word: string; x: number; y: number } | null>(null);
  // Plot geometry, kept from the last paint so hit-testing measures against what is drawn.
  const geom = useRef<{ w: number; h: number; plotted: number[] } | null>(null);

  // ~165KB gzipped, so it is fetched when the view is opened and not before. Nothing else
  // in the app needs the whole ranking client-side.
  useEffect(() => {
    let live = true;
    setPoints(null);
    void fetch(`/api/defining?source=${source}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => live && p && setPoints(p as Points));
    return () => {
      live = false;
    };
  }, [source]);

  const xOf = useCallback((rank: number, w: number, total: number) => {
    // Square root, not log: log gives ranks 1-1,000 two thirds of the width. Sqrt gives
    // each CEFR band a roughly equal share of it, which is what makes a stripe readable.
    const t = Math.sqrt(rank) / Math.sqrt(total);
    return PAD.left + t * (w - PAD.left - PAD.right);
  }, []);

  const yOf = useCallback((level: number, off: number, h: number) => {
    const band = (h - PAD.top - PAD.bottom) / LEVELS;
    return PAD.top + (level - 0.5) * band + off * band * 0.7;
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !points) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const ink = getComputedStyle(canvas).color;
    const faint = resolvedTheme === "dark" ? "rgba(255,255,255,.055)" : "rgba(0,0,0,.045)";
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue("--accent-focus").trim() ||
      "#f5c542";
    const total = points.words.length;

    // CEFR stripes, alternating, so a vertical slice of near-equal frequency is visible
    // without a control to narrow one.
    const edges = [0, ...CEFR_EDGES, total];
    for (let i = 0; i < edges.length - 1; i++) {
      if (i % 2 === 0) continue;
      const x0 = xOf(edges[i]!, w, total);
      const x1 = xOf(edges[i + 1]!, w, total);
      ctx.fillStyle = faint;
      ctx.fillRect(x0, PAD.top, x1 - x0, h - PAD.top - PAD.bottom);
    }

    // Level labels down the left edge.
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.55;
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let l = 1; l <= LEVELS; l++) ctx.fillText(`D${l}`, 4, yOf(l, 0, h));

    // Rank ticks along the bottom, at the CEFR edges the stripes already mark.
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const r of CEFR_EDGES) {
      ctx.fillText(r >= 1000 ? `${r / 1000}k` : String(r), xOf(r, w, total), h - PAD.bottom + 6);
    }
    ctx.globalAlpha = 1;

    // The points. One ink colour, not a ramp per level: the y position already encodes the
    // level, and the pale end of a ramp disappears against the ground.
    const plotted: number[] = [];
    const anchor = anchorWord?.toLowerCase() ?? null;
    let anchorAt: [number, number] | null = null;
    ctx.fillStyle = ink;
    ctx.globalAlpha = resolvedTheme === "dark" ? 0.38 : 0.3;
    for (let i = 0; i < total; i++) {
      const c = points.levels[i]!;
      if (c === "-") continue;
      const word = points.words[i]!;
      const x = xOf(i + 1, w, total);
      const y = yOf(+c, jitter(word), h);
      plotted.push(i);
      if (anchor && word.toLowerCase() === anchor) {
        anchorAt = [x, y];
        continue;
      }
      ctx.fillRect(x - DOT / 2, y - DOT / 2, DOT, DOT);
    }
    ctx.globalAlpha = 1;
    if (anchorAt) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(anchorAt[0], anchorAt[1], 4, 0, Math.PI * 2);
      ctx.fill();
    }
    geom.current = { w, h, plotted };
  }, [points, resolvedTheme, anchorWord, xOf, yOf]);

  useEffect(() => {
    paint();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [paint]);

  /** The plotted word nearest the cursor, within `HOVER` px, or null. */
  const nearest = useCallback(
    (px: number, py: number) => {
      const g = geom.current;
      if (!g || !points) return null;
      const total = points.words.length;
      let best: { i: number; d: number } | null = null;
      for (const i of g.plotted) {
        const word = points.words[i]!;
        const dx = xOf(i + 1, g.w, total) - px;
        if (dx > HOVER || dx < -HOVER) continue;
        const dy = yOf(+points.levels[i]!, jitter(word), g.h) - py;
        const d = dx * dx + dy * dy;
        if (d <= HOVER * HOVER && (!best || d < best.d)) best = { i, d };
      }
      return best ? points.words[best.i]! : null;
    },
    [points, xOf, yOf],
  );

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const word = nearest(px, py);
    setHover(word ? { word, x: px, y: py } : null);
  };

  const levelled = points ? [...points.levels].filter((c) => c !== "-").length : 0;

  if (!points) {
    return <Loading className="tw-min-h-[220px] tw-justify-center" label="Loading the figure…" />;
  }

  return (
    <figure className="tw-m-0">
      <div
        ref={wrapRef}
        className="tw-relative tw-h-[min(52svh,360px)] tw-w-full tw-text-secondary min-[700px]:tw-h-[420px]"
      >
        <canvas
          ref={canvasRef}
          role="img"
          // The picture states a shape, and the shape is the caption. A screen reader gets
          // the claim in words; the tabs below are where it reads the words themselves.
          aria-label={`Frequency against defining level: ${levelled.toLocaleString()} words plotted, most frequent at the left, D1 at the top. Within any one frequency range the words still spread across every level.`}
          className="tw-block tw-h-full tw-w-full"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onClick={() => hover && onSelect(hover.word)}
          style={{ cursor: hover ? "pointer" : "default" }}
        />
        {hover && (
          <span
            aria-hidden
            className="tw-pointer-events-none tw-absolute tw-z-10 tw-rounded tw-border tw-border-line-subtle tw-bg-surface tw-px-2 tw-py-1 tw-body-x-small tw-text-primary tw-shadow"
            style={tipStyle(hover, wrapRef.current?.clientWidth ?? 0)}
            lang={source}
          >
            {hover.word}
          </span>
        )}
      </div>
      <figcaption className="tw-mt-1 tw-px-1 tw-body-x-small text-muted-aaa">
        Frequency across, defining level up — {levelled.toLocaleString()} words. D1 at the top
        is the core the dictionary defines everything else with; D7 at the bottom is never used
        in a definition at all. The stripes are the CEFR bands. Height is not difficulty:{" "}
        <span lang={source}>olá</span> is A1 vocabulary sitting at D7. Pick a point to look it up.
      </figcaption>
    </figure>
  );
}
