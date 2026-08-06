/**
 * The hero's two facing panels — the word you ask for, and what it means. They share
 * a frame and open with a language select at the same offset, so the pair reads as
 * one control: source on the left, target on the right.
 */
export const PANEL =
  "tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-px-4 tw-py-4 " +
  "min-[700px]:tw-px-6 min-[700px]:tw-py-5";

/**
 * The language select each panel opens with. One step below the word and gloss it
 * governs (20px), rather than Fondue's 14px default, which reads as a stray control.
 */
export const PANEL_LANG =
  "tw-mb-2 tw-w-44 [&_[role=combobox]]:tw-min-h-[44px] [&_[role=combobox]]:tw-text-large " +
  "min-[700px]:tw-mb-4";
