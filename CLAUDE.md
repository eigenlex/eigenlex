# eigenlex — agent notes

pnpm + turbo monorepo, now a single app: `apps/web` is the Next.js site + hosted API.
It's a vocabulary learning tool — every English word placed on a **frequency** band
and a **CEFR** band, so a learner can see where a word sits and browse the vocabulary
in order.

## Data

The tool is multi-**source-language**: a learner picks the language they're studying
(en/es/fr/de/pt). This is separate from the reader's *target* language (the gloss
language chosen in the word card). Source-language metadata lives in
`apps/web/src/lib/languages.ts`; the server registry is `apps/web/src/lib/bands.ts`.

The app reads one committed artifact per language, `apps/web/data/word-bands.<code>.json`
(a pure-frequency, lemma-merged word ranking + the band definitions). They're built by
`apps/web/scripts/build-bands.ts` from gitignored inputs in `apps/web/data/`: a
frequency list + a lemmatization list per language. English uses `subtlex.csv`
(SUBTLEX-US); es/fr/de/pt use `freq-<code>.txt` (OpenSubtitles frequency lists from
hermitdave/FrequencyWords). Lemmas are `lemma-<code>.txt` (michmech/lemmatization-lists).
Rebuild all with `pnpm --filter @eigenlex/web build:bands`, or one with
`… build:bands <code>`. To add a language, drop its two inputs in `data/`, add an entry
to the `LANGS` table in the build script and to `SOURCE_LANG_META` (+ the `bands.ts`
registry import). CEFR bands are frequency-rank thresholds calibrated against CEFR-J
(English-derived, reused for every language); no graph or external dictionary is involved.

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
