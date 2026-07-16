"use client";

import { LoadingCircle } from "@frontify/fondue/components";

type Size = "xx-small" | "x-small" | "small" | "medium" | "large";

/**
 * A centered Fondue spinner with a visible, low-contrast caption. The caption
 * doubles as the accessible name: `role="status"` announces it politely when the
 * region appears, so no separate sr-only text is needed.
 */
export default function Loading({
  label = "Loading…",
  size = "medium",
  className = "",
}: {
  label?: string;
  size?: Size;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`Loading tw-flex tw-items-center tw-justify-center tw-gap-2 text-muted-aaa ${className}`}
    >
      <LoadingCircle size={size} />
      <span className="tw-body-small">{label}</span>
    </div>
  );
}
