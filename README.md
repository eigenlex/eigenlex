# eigenlex

A dictionary is language defining itself: every word is explained using other
words, which are explained using other words. Follow that relation and a
dictionary becomes a **directed graph** — and every word must ultimately resolve
into one of three fates (the [Münchhausen trilemma](https://en.wikipedia.org/wiki/M%C3%BCnchhausen_trilemma)):

- **a path** — a chain of definitions leading elsewhere,
- **a cycle** — words that, in the end, only define each other, or
- **the kernel** — irreducible primitives you can't define without circularity.

`eigenlex` turns any dictionary into that graph and lets you study it. The name:
*eigen* ("self", German) for a self-referential lexicon, and for the
**eigenvector centrality** that surfaces a language's most fundamental words.

## Layout

This is a layered monorepo — each package is a product, from least to most
abstract:

| Package | Role |
| --- | --- |
| `@eigenlex/core` | Takes a plain `Dictionary` object, returns the definition graph. Language-agnostic. |
| `@eigenlex/adapters` | Convert real sources (Webster 1913, WordNet, …) into a `Dictionary`. |
| `@eigenlex/analysis` | Graph algorithms: cycles, eigenvector/PageRank centrality, kernel, paths. |
| `apps/web` | The website + hosted API. *(deferred until the core is solid)* |

The seam that holds it together: `core` emits **plain, serializable adjacency
data**, so the same artifact crosses every layer boundary and the network —
compute it once, cache it, ship it to the browser.

## Data model

One direction of flow — a `Dictionary` in, plain adjacency out, analytical views
on top. Every shape is plain and serializable.

**Core** — `@eigenlex/core`

| Type | Shape |
| --- | --- |
| `Dictionary` | *Input.* `Record<headword, string[]>` — headword → its sense texts. |
| `LanguageProfile` | Injected `tokenize` / `normalize` / `lemmatize` / `stopwords`; keeps the builder language-agnostic. |
| `BuildOptions` | Build flags: stopword edges, self-loops, phrase matching. |
| `DefinitionGraph` | *Output.* `edges` (headword → referenced headwords), `labels` (canonical → surface form), `stats`. |

**Analysis** — `@eigenlex/analysis`, all computed over a `DefinitionGraph`

| Type | Shape |
| --- | --- |
| `CompiledGraph` | Index-based view — words as integers, adjacency as `out` / `in` arrays. Built once, reused by every algorithm. |
| `Kernel` | The irreducible words: sink SCCs whose definitions never leave the group. |
| `Stratified` | Acyclic SCC condensation with a `depth` per component (0 = most basic → most advanced). |
| `layers()` → `string[][]` | Words bucketed by depth; `layers[0]` is the kernel. |
| SCCs → `string[][]` | Strongly connected components; size > 1 = mutually-defining (circular) words. |
| `pageRank()` → `Record<word, number>` | Centrality scores; mass flows toward the most fundamental words. |

**Web API** — `apps/web/src/lib/types.ts`, JSON the browser consumes

| Type | Shape |
| --- | --- |
| `WordInfo` | A word's dossier: senses, in/out edges, PageRank + rank, kernel flag, component size, depth. |
| `Layer` / `LayerSummary` | The words at one depth / per-depth counts for the whole stack. |
| `EgoGraph` | A word's neighborhood — `focus` plus typed `nodes` (`focus`/`defines`/`usedBy`/`mutual`) and `edges`. |
| `TopWord` | `{ word, score }` — one leaderboard row. |

## Develop

```sh
pnpm install
pnpm test        # run all package tests
pnpm typecheck   # type-check everything
pnpm build       # build all packages
```

## Run the web app

```sh
pnpm dev   # http://localhost:3000 — bundled 10k-word sample
```

For all ~102k headwords, point `EIGENLEX_WEBSTER` at a full Webster 1913 JSON
(`{ "headword": "definition", … }`). Get the GCIDE-derived source from
[matthewreagan/WebstersEnglishDictionary](https://github.com/matthewreagan/WebstersEnglishDictionary),
save it to `apps/web/data/webster-full.json` (gitignored), then:

```sh
EIGENLEX_WEBSTER="$PWD/apps/web/data/webster-full.json" \
  pnpm --filter @eigenlex/web dev   # first request builds the graph (~a few s), then cached
```

To make it the default for a plain `pnpm dev`, put an absolute
`EIGENLEX_WEBSTER=…` in `apps/web/.env.local` (Next loads it; already gitignored).
Prepending the var to the root `pnpm dev` won't work — Turborepo's strict env
mode filters it out.

### Full dictionary in production

Building the 88k-node graph on every cold start is too slow for a serverless
deploy, so production loads a **precomputed model** instead. `build:model` runs
the whole pipeline (graph, PageRank, SCCs, stratification) once and writes the
result to `apps/web/data/webster-model.json` (gitignored):

```sh
pnpm --filter @eigenlex/web build:model   # reads data/webster-full.json → webster-model.json
```

At runtime `graph.ts` prefers, in order: `EIGENLEX_MODEL` (or the default
`data/webster-model.json`) → `EIGENLEX_WEBSTER` (built on first request) → the
bundled sample. So once the model file exists, `pnpm dev` serves the full
dictionary with only a `JSON.parse` + rehydrate on startup (no graph build).

On **Vercel** this is wired into `apps/web/vercel.json`: the build downloads the
source, runs `build:model`, then `next build`. Because the model is read through
a computed path, `next.config.mjs`'s `outputFileTracingIncludes` force-bundles
`webster-model.json` into each API function.

> **Heads up:** `next dev` and `next build` share `apps/web/.next`, so running
> `pnpm build` while the web dev server is live corrupts it (its API routes start
> 500ing). To verify a production build without stopping `pnpm dev`, use
> `pnpm --filter @eigenlex/web build:check` — it builds into `.next-build`.

## License

MIT
