#!/usr/bin/env bash
# Vercel build for @eigenlex/web. Kept in a script because vercel.json's inline
# `buildCommand` is capped at 256 chars. Invoked from the repo root (the
# buildCommand cd's there first).
set -euo pipefail

# The app reads the committed apps/web/data/word-bands.json — no data download or
# model precompute is needed. Just build the app.
pnpm turbo run build --filter=@eigenlex/web
