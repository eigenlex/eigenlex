"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Loading from "@/components/Loading";
import type { EgoGraph, WordInfo } from "@/lib/types";

const GraphView = dynamic(() => import("@/components/GraphView"), { ssr: false });

// A word pill. Kept a native button (Fondue's Button doesn't forward aria-current
// and these lists can run long) but painted with Fondue tokens.
const CHIP =
  "tw-inline-flex tw-items-center tw-min-h-[24px] tw-rounded-full tw-border tw-border-line-subtle " +
  "tw-bg-surface-hover tw-px-3 tw-py-1 tw-body-small tw-text-secondary tw-transition-colors " +
  "hover:tw-bg-surface-active hover:tw-text-primary";

export default function Explorer({
  info,
  onSelect,
  loading = false,
}: {
  info: WordInfo | null;
  onSelect: (word: string) => void;
  /** The parent is looking up a word — show the spinner before its ego arrives. */
  loading?: boolean;
}) {
  const [ego, setEgo] = useState<EgoGraph | null>(null);
  const [egoLoading, setEgoLoading] = useState(false);
  const word = info?.word ?? "";
  const busy = loading || egoLoading;

  // The word is owned by the parent; refetch this view's neighborhood when it changes.
  useEffect(() => {
    if (!word) {
      setEgo(null);
      return;
    }
    let live = true;
    setEgoLoading(true);
    void fetch(`/api/ego/${encodeURIComponent(word)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((e) => live && setEgo(e as EgoGraph | null))
      .finally(() => live && setEgoLoading(false));
    return () => {
      live = false;
    };
  }, [word]);

  return (
    <div className="Explorer">
      <div className="tw-grid tw-grid-cols-1 tw-gap-5 min-[800px]:tw-grid-cols-[1.3fr_1fr]">
        <section className="tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-p-2">
          {busy ? (
            <Loading
              className="tw-h-[460px] tw-w-full tw-rounded-large"
              label={word ? `Loading graph for “${word}”…` : "Loading graph…"}
            />
          ) : ego && ego.nodes.length > 1 ? (
            <GraphView ego={ego} onSelect={onSelect} />
          ) : (
            <div className="tw-flex tw-h-[460px] tw-w-full tw-items-center tw-justify-center tw-rounded-large tw-text-low-contrast">
              no connections
            </div>
          )}
          <p className="tw-mx-1 tw-mb-1 tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-1 tw-body-small tw-text-low-contrast">
            <span className="dot focus" /> {word}
            <span className="dot defines" /> defined using
            <span className="dot usedBy" /> used to define
            <span className="dot mutual" /> mutual (circular)
            <span className="tw-ml-auto tw-italic">
              brighter = more advanced · hover to spotlight · click to walk
            </span>
          </p>
        </section>

        {info && (
          <aside className="tw-rounded-x-large tw-border tw-border-line-subtle tw-bg-surface tw-p-5">
            <h2 className="tw-heading-x-large-strong">{info.word}</h2>
            <p className="tw-mb-4 tw-mt-1 tw-body-small tw-text-low-contrast">
              PageRank #{info.rank} · component {info.componentSize.toLocaleString()} · layer{" "}
              {info.depth + 1}/{info.layerCount}
              {info.inKernel ? " · kernel" : ""}
            </p>
            {info.senses.length > 0 && (
              <ol className="tw-mb-5 tw-list-decimal tw-pl-5 tw-body-medium tw-text-primary">
                {info.senses.slice(0, 6).map((sense, i) => (
                  <li key={i} className="tw-mb-1">
                    {sense}
                  </li>
                ))}
              </ol>
            )}
            <Chips title="defined using" words={info.defines} onSelect={onSelect} />
            <Chips title="used to define" words={info.usedBy.slice(0, 30)} onSelect={onSelect} />
          </aside>
        )}
      </div>
    </div>
  );
}

function Chips({
  title,
  words,
  onSelect,
}: {
  title: string;
  words: string[];
  onSelect: (w: string) => void;
}) {
  if (words.length === 0) return null;
  return (
    <div className="Chips tw-mt-4">
      <h3 className="tw-heading-category tw-mb-2 tw-text-low-contrast">{title}</h3>
      <div className="tw-flex tw-flex-wrap tw-gap-1">
        {words.map((w) => (
          <button key={w} className={CHIP} onClick={() => onSelect(w)}>
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
