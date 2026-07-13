#!/usr/bin/env bash
# Vercel build for @eigenlex/web. Kept in a script because vercel.json's inline
# `buildCommand` is capped at 256 chars. Invoked from the repo root (the
# buildCommand cd's there first).
set -euo pipefail

# Build the web app's workspace dependencies.
pnpm turbo run build --filter='@eigenlex/web^...'

# Download the full Webster source, then precompute the query-ready model so the
# deployed app loads a finished model instead of building the graph on cold start.
curl -fSL 'https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary.json' \
  -o apps/web/data/webster-full.json
pnpm --filter @eigenlex/web build:model

# Build the app itself.
pnpm turbo run build --filter=@eigenlex/web
