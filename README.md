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

> **Heads up:** `next dev` and `next build` share `apps/web/.next`, so running
> `pnpm build` while the web dev server is live corrupts it (its API routes start
> 500ing). To verify a production build without stopping `pnpm dev`, use
> `pnpm --filter @eigenlex/web build:check` — it builds into `.next-build`.

## License

MIT
