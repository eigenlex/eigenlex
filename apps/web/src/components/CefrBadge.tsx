"use client";

import { Tooltip } from "@frontify/fondue/components";
import type { WordLevel } from "@/lib/types";

// Deliberately quiet: a translation can carry six of these, and they annotate the terms
// rather than compete with them. Spacing is a margin, not a space character, so the line's
// text content stays the translation itself ("water, aqua") — for copy, and for the tests.
const BADGE =
  "tw-ml-1 tw-cursor-help tw-align-baseline tw-tabular-nums tw-body-x-small text-muted-aaa";

/**
 * A word's CEFR level, with the band name and rank a hover or focus away. Focusable so
 * that detail is reachable by keyboard too, following the `Abbr` pattern in Workspace.
 *
 * `role="img"` carries the whole thing as the badge's name — a bare "A1" says nothing read
 * aloud, and the alternative, hidden text, would ride along into anything copied out of the
 * translation. Its children being presentational is what keeps "A1" from being read twice.
 */
export default function CefrBadge({ level }: { level: WordLevel }) {
  const detail = `${level.label} · rank ${level.rank.toLocaleString()}`;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span tabIndex={0} role="img" aria-label={detail} className={BADGE}>
          {level.key}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content>{detail}</Tooltip.Content>
    </Tooltip.Root>
  );
}
