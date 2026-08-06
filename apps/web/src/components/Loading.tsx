"use client";

import { LoadingCircle } from "@frontify/fondue/components";

type Size = "xx-small" | "x-small" | "small" | "medium" | "large";

/**
 * The app's one loading indicator: a Fondue spinner with a low-contrast caption,
 * so every waiting state reads the same. The caption doubles as the accessible
 * name — `role="status"` announces it politely when the region appears. Set
 * `announce={false}` inside a live region, which announces the caption already.
 *
 * Alignment is the caller's: add `tw-justify-center` to centre it in a panel.
 */
export default function Loading({
  label = "Loading…",
  size = "medium",
  announce = true,
  className = "",
}: {
  label?: string;
  size?: Size;
  announce?: boolean;
  className?: string;
}) {
  return (
    <div
      role={announce ? "status" : undefined}
      className={`Loading tw-flex tw-items-center tw-gap-2 text-muted-aaa ${className}`}
    >
      <LoadingCircle size={size} />
      <span className="tw-body-small">{label}</span>
    </div>
  );
}
