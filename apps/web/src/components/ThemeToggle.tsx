"use client";

import { useThemeToggle, type ThemePreference } from "@/app/providers";

// Plain buttons (not Fondue) so the masthead stays free of the Fondue runtime the
// Workspace lazy-loads; styled with Fondue tokens to match. 44px targets (WCAG 2.5.5).
const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function ThemeToggle() {
  const { preference, setPreference } = useThemeToggle();
  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="tw-inline-flex tw-shrink-0 tw-rounded-large tw-border tw-border-line-subtle tw-p-0.5"
    >
      {OPTIONS.map(({ value, label }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setPreference(value)}
            className={`tw-min-h-[44px] tw-rounded-large tw-px-4 tw-body-small tw-transition-colors ${
              active
                ? "tw-bg-surface-hover tw-font-medium tw-text-primary"
                : "tw-text-secondary hover:tw-text-primary"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
