"use client";

import { useState } from "react";
import Explorer from "@/components/Explorer";
import LayersView from "@/components/LayersView";

type View = "graph" | "layers";

export default function Workspace({ initialWord }: { initialWord: string }) {
  const [view, setView] = useState<View>("layers");
  // Shared so a word looked up in one view carries into the other.
  const [word, setWord] = useState(initialWord);

  return (
    <div className="workspace">
      <nav className="tabs" role="tablist">
        {(["layers", "graph"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            className={view === v ? "tab active" : "tab"}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
      </nav>

      {view === "graph" ? (
        <Explorer key="graph" initialWord={word} onWordChange={setWord} />
      ) : (
        <LayersView key="layers" initialWord={word} onWordChange={setWord} />
      )}
    </div>
  );
}
