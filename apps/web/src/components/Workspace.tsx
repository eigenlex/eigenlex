"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Explorer from "@/components/Explorer";
import LayersView from "@/components/LayersView";

const VIEWS = ["layers", "graph"] as const;
type View = (typeof VIEWS)[number];

export default function Workspace({ initialWord }: { initialWord: string }) {
  const [view, setView] = useState<View>("layers");
  // Shared so a word looked up in one view carries into the other.
  const [word, setWord] = useState(initialWord);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs (roving tabindex), per the ARIA tabs pattern.
  const onTabKeyDown = (e: KeyboardEvent, i: number) => {
    const last = VIEWS.length - 1;
    const to =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (to === null) return;
    e.preventDefault();
    setView(VIEWS[to]!);
    tabRefs.current[to]?.focus();
  };

  return (
    <div className="workspace">
      <div className="tabs" role="tablist" aria-label="View">
        {VIEWS.map((v, i) => {
          const selected = view === v;
          return (
            <button
              key={v}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`tab-${v}`}
              role="tab"
              aria-selected={selected}
              aria-controls="view-panel"
              tabIndex={selected ? 0 : -1}
              className={selected ? "tab active" : "tab"}
              onClick={() => setView(v)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div id="view-panel" role="tabpanel" aria-labelledby={`tab-${view}`}>
        {view === "graph" ? (
          <Explorer key="graph" initialWord={word} onWordChange={setWord} />
        ) : (
          <LayersView key="layers" initialWord={word} onWordChange={setWord} />
        )}
      </div>
    </div>
  );
}
