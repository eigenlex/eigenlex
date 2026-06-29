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
