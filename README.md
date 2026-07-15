# eigenlex

A vocabulary learning tool: **which English words to learn first.** Every word is
placed on a learning band — by raw **frequency**, or by **CEFR level** — so you can
look a word up to see where it lands, or browse the whole vocabulary in order.

## How it works

Learning order is driven by **word frequency**: the words you meet most often are the
ones worth learning first. We measured frequency to be a far better predictor of
learning order than any dictionary-structure metric, so the ranking rests on it alone.

- **Frequency** comes from [SUBTLEX-US](https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus)
  (Brysbaert & New, 2009). Inflections are merged onto their base form via a
  [lemmatization list](https://github.com/michmech/lemmatization-lists), so a concept
  is one entry carrying its combined frequency.
- **CEFR levels** (A1–C2) are derived from frequency rank, with the band boundaries
  calibrated against the [CEFR-J](https://www.cefr-j.org/) vocabulary profile — so the
  labels are learner-familiar while coverage stays the full vocabulary. No external
  dictionary is required at runtime.

This keeps the data footprint small and **scales to other languages**: add a frequency
list and a lemmatization list for the language, and (optionally) recalibrate the CEFR
thresholds.

## Layout

A single Next.js app.

| Path | Role |
| --- | --- |
| `apps/web` | The website + hosted API (the band browser and word lookup). |
| `apps/web/scripts/build-bands.ts` | Builds the `word-bands.json` artifact the app serves. |
| `apps/web/data/word-bands.json` | Committed artifact: the ranked words + band definitions. |

## Develop

```sh
pnpm install
pnpm dev         # http://localhost:3000
pnpm test        # run tests
pnpm typecheck   # type-check everything
```

## Rebuild the data

`word-bands.json` is committed, so the app runs without a build step. To regenerate it,
place `subtlex.csv` and `lemma-en.txt` in `apps/web/data/` (gitignored) and run:

```sh
pnpm --filter @eigenlex/web build:bands
```

> **Heads up:** `next dev` and `next build` share `apps/web/.next`, so running
> `pnpm build` while the web dev server is live corrupts it (its API routes start
> 500ing). To verify a production build without stopping `pnpm dev`, use
> `pnpm --filter @eigenlex/web build:check` — it builds into `.next-build`.

## License

MIT
