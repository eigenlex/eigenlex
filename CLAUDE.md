# eigenlex — agent notes

pnpm + turbo monorepo. `packages/*` are libraries (core → adapters → analysis);
`apps/web` is the Next.js site + hosted API.

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
