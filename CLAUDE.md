# eigenlex — agent notes

pnpm + turbo monorepo, now a single app: `apps/web` is the Next.js site + hosted API.
It's a vocabulary learning tool — every English word placed on a **frequency** band
and a **CEFR** band, so a learner can see where a word sits and browse the vocabulary
in order.

## URL state (deeplinks)

The `Workspace` mirrors the current scenario into the query string so it can be shared
as a deeplink: `?lang=<source>&word=<word>&tl=<gloss>&view=freq|cefr&band=<key>`. Encode
/ decode lives in `apps/web/src/lib/scenario.ts`; `Workspace` is the single owner of all
five pieces (target language lifted up out of `WordCard`, band tab lifted up out of
`BandBrowser`). On mount the URL wins over the localStorage/browser defaults; thereafter
state is written back with `replaceState`. `band` is only pinned when it differs from the
looked-up word's own band (otherwise it's implied by word + view). `Workspace` is
client-only (`WorkspaceLazy`, `ssr:false`), so this is all client-side.

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

**Display casing** is optional per language, driven by a third input: `casing-<code>.txt`,
a Leipzig Corpora *sentences* file (`downloads.wortschatz-leipzig.de`, e.g.
`deu_news_2022_1M`), pointed to by `casingFile` in the `LANGS` table. The build measures
each word's *mid-sentence* capitalization (ignoring sentence-initial position, which
capitalizes everything) — so German nouns/names ("Wasser", "Berlin") and proper nouns in
any language come out capitalized while verbs/pronouns stay lowercase, with no
per-language rules. The already-present lemma list supplies an authoritative fallback for
the rare tail. The stored `ranked` words carry display casing; all lookups in `bands.ts`
key on lowercase, so search/typeahead stay case-insensitive. Languages without a
`casingFile` stay lowercase. Only German uses this so far.

**Case-homographs** (German "Essen" the noun vs "essen" the verb) merge into one source
entry but keep both casings. The build flags an entry when both casings are genuinely
used mid-sentence *and* the lemma list has a capitalized (noun) spelling — filtering
surnames ("Klein") and quote-capitalized adjectives. The artifact stores these under
`variants` (`"essen" -> ["Essen","essen"]`, most frequent first); `getWord` returns them
as `forms`. The word card glosses each casing via the translate API's `dict=1` mode
(Google's `dt=bd` dictionary block is casing-sensitive — "Essen"→food/meal,
"essen"→eat/dine — unlike the plain translation) and shows a line per casing, collapsing
to one when the meanings don't actually differ.

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
