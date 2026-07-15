# eigenlex — agent notes

pnpm + turbo monorepo, now a single app: `apps/web` is the Next.js site + hosted API.
It's a vocabulary learning tool — every English word placed on a **frequency** band
and a **CEFR** band, so a learner can see where a word sits and browse the vocabulary
in order.

## Data

The app reads one committed artifact, `apps/web/data/word-bands.json` (a pure-frequency,
lemma-merged word ranking + the band definitions). It's built by
`apps/web/scripts/build-bands.ts` from two gitignored inputs in `apps/web/data/`:
`subtlex.csv` (SUBTLEX-US frequencies) and `lemma-en.txt` (a lemmatization list).
Rebuild with `pnpm --filter @eigenlex/web build:bands`. CEFR bands are frequency-rank
thresholds calibrated against CEFR-J; no graph or external dictionary is involved.

## Verifying a build while the web dev server is running

`next dev` and `next build` both default to `apps/web/.next`. Running `pnpm build`
(or `next build`) while `pnpm dev` is live overwrites that directory and breaks the
running server — its API routes start returning 500s.

So, before verifying the web app:

- **Don't** run `pnpm build` / root `turbo run build` while a web dev server is up.
- To check a production build without stopping dev, use the isolated build:
  `pnpm --filter @eigenlex/web build:check` (builds into `.next-build`).
- For a normal full build, stop the dev server first.

`pnpm test` and `pnpm typecheck` are always safe to run alongside `pnpm dev`.
