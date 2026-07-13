"use client";

import { useCallback, useEffect, useState } from "react";
import LayersView from "@/components/LayersView";
import WordSearchBox from "@/components/WordSearchBox";
import type { WordInfo } from "@/lib/types";

export default function Workspace({ initialWord }: { initialWord: string }) {
  // The searched word drives the whole view, so its lookup lives here, above it.
  const [query, setQuery] = useState(initialWord);
  const [info, setInfo] = useState<WordInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts true: the effect below looks up `initialWord` on mount straight away.
  const [loading, setLoading] = useState(true);

  const lookup = useCallback(async (raw: string) => {
    const term = raw.trim().toLowerCase();
    if (!term) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/word/${encodeURIComponent(term)}`);
      if (!res.ok) {
        setError(`"${term}" is not in this dictionary`);
        return;
      }
      setError(null);
      setInfo((await res.json()) as WordInfo);
      setQuery(term);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void lookup(initialWord);
  }, [lookup, initialWord]);

  return (
    <div className="Workspace">
      <WordSearchBox
        value={query}
        onValueChange={setQuery}
        onSubmit={(w) => void lookup(w)}
        ariaLabel="Look up a word"
        placeholder="look up a word…"
        submitLabel={loading ? "…" : "explore"}
        submitDisabled={loading}
      />

      {error && (
        <p className="tw-mb-4 tw-body-medium tw-text-error" role="alert">
          {error}
        </p>
      )}

      <LayersView info={info} onSelect={(w) => void lookup(w)} loading={loading} />
    </div>
  );
}
