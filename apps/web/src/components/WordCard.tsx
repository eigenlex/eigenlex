"use client";

import type { WordBands } from "@/lib/types";

const PILL =
  "tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-line-subtle " +
  "tw-bg-surface-hover tw-px-3 tw-py-1 tw-body-small tw-text-secondary";

/** The looked-up word and where it sits — both band labelings, side by side. */
export default function WordCard({ info }: { info: WordBands }) {
  return (
    <section className="WordCard tw-mb-4 tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-px-5 tw-py-4">
      <h2 className="tw-heading-x-large-strong">{info.word}</h2>
      <p className="tw-mb-3 tw-mt-1 tw-body-small tw-text-low-contrast">
        frequency rank #{info.rank.toLocaleString()}
      </p>
      <div className="tw-flex tw-flex-wrap tw-gap-6">
        <div>
          <span className="tw-mb-1 tw-block tw-body-x-small tw-text-low-contrast">Frequency band</span>
          <span className={PILL}>{info.freq.label}</span>
        </div>
        <div>
          <span className="tw-mb-1 tw-block tw-body-x-small tw-text-low-contrast">CEFR level</span>
          <span className={PILL}>{info.cefr.label}</span>
        </div>
      </div>
    </section>
  );
}
