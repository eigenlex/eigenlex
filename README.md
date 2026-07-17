# eigenlex

A vocabulary learning tool: **which words to learn first** — in English, Spanish,
French, German, or Portuguese. Pick the language you're studying; every word is placed
on a learning band — by raw **frequency**, or by **CEFR level** — so you can look a word
up to see where it lands, or browse the whole vocabulary in order.

## How it works

Learning order is driven by **word frequency**: the words you meet most often are the
ones worth learning first. We measured frequency to be a far better predictor of
learning order than any dictionary-structure metric, so the ranking rests on it alone.

- **Frequency** comes from [SUBTLEX-US](https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus)
  (Brysbaert & New, 2009) for English, and from the OpenSubtitles-derived
  [FrequencyWords](https://github.com/hermitdave/FrequencyWords) lists for the other
  languages. Inflections are merged onto their base form via a per-language
  [lemmatization list](https://github.com/michmech/lemmatization-lists), so a concept
  is one entry carrying its combined frequency.
- **CEFR levels** (A1–C2) are derived from frequency rank, with the band boundaries
  calibrated against the [CEFR-J](https://www.cefr-j.org/) vocabulary profile — so the
  labels are learner-familiar while coverage stays the full vocabulary. The calibration
  is English-derived and reused for every language as a first-order heuristic. No
  external dictionary is required at runtime.

This keeps the data footprint small and **scales to other languages**: add a frequency
list and a lemmatization list for the language, register it, and rebuild.

## Layout

A single Next.js app.

| Path | Role |
| --- | --- |
| `apps/web` | The website + hosted API (the band browser and word lookup). |
| `apps/web/src/lib/languages.ts` | The supported source languages + their metadata. |
| `apps/web/scripts/build-bands.ts` | Builds the per-language `word-bands.<code>.json` artifacts. |
| `apps/web/data/word-bands.<code>.json` | Committed artifacts: the ranked words + band definitions. |

## Develop

```sh
pnpm install
pnpm dev         # http://localhost:3000
pnpm test        # run tests
pnpm typecheck   # type-check everything
```

## Rebuild the data

The `word-bands.<code>.json` artifacts are committed, so the app runs without a build
step. To regenerate them, place each language's gitignored inputs in `apps/web/data/`
— English `subtlex.csv` + `lemma-en.txt`; each other language `freq-<code>.txt` +
`lemma-<code>.txt` — and run:

```sh
pnpm --filter @eigenlex/web build:bands        # all languages
pnpm --filter @eigenlex/web build:bands es     # just one
```

> **Heads up:** `next dev` and `next build` share `apps/web/.next`, so running
> `pnpm build` while the web dev server is live corrupts it (its API routes start
> 500ing). To verify a production build without stopping `pnpm dev`, use
> `pnpm --filter @eigenlex/web build:check` — it builds into `.next-build`.

## License

MIT
