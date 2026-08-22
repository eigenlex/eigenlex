#!/usr/bin/env node
// Proves a deployment still decodes route params the way CLAUDE.md's table says.
//
// How many times a param is decoded is a property of where the code runs, not of the code:
// Vercel's edge decodes the path before Next does, so a deployed param arrives decoded one
// more time than it does under `next start`. Nothing in the suite can see that —
// hostile-input.test.ts and routes.test.ts call handlers directly with params already
// decoded, which is the right unit to test — so this is the only thing that would notice
// the edge changing under us, or a rewrite or middleware changing it from our side.

// The production alias, not a deployment's own URL: Deployment Protection answers those
// with a 302 to a Vercel login, which would read here as every row having changed at once.
const TARGET = process.argv[2] ?? process.env.EIGENLEX_URL ?? "https://eigenlex-web.vercel.app";

// The Vercel column of the table under "API route params". `word` is asserted wherever a
// row answers 200, because the point of %2577ater is not that it succeeds but that it
// lands on "water" two decodes down.
const ROWS = [
  { param: "%", status: 400 },
  { param: "%25", status: 404 },
  { param: "%2525", status: 404 },
  { param: "%77ater", status: 200, word: "water" },
  { param: "%2577ater", status: 200, word: "water" },
  { param: "%252577ater", status: 404 },
];

// Not curl: it refuses to send the bare `%` row at all. Node's URL leaves a path exactly
// as written, which is the whole point of these rows.
async function probe({ param, status, word }) {
  const res = await fetch(`${TARGET}/api/word/${param}?source=en`, { redirect: "manual" });
  const got = { status: res.status };
  if (res.status === 200) got.word = await res.json().then((b) => b.word, () => undefined);

  const want = word === undefined ? { status } : { status, word };
  const ok = Object.keys(want).every((k) => got[k] === want[k]);
  return { param, want, got, ok };
}

const show = ({ status, word }) => (word === undefined ? `${status}` : `${status} ${word}`);

let results;
try {
  results = await Promise.all(ROWS.map(probe));
} catch (err) {
  // A check that could not check is not a pass.
  console.error(`unreachable: ${TARGET}`);
  console.error(err.message);
  process.exit(1);
}

for (const { param, want, got, ok } of results) {
  const line = `  /api/word/${param}`.padEnd(28);
  console.log(`${ok ? "  ok" : "FAIL"}${line} ${show(got)}${ok ? "" : `   want ${show(want)}`}`);
}

const bad = results.filter((r) => !r.ok);
if (bad.length === 0) {
  console.log(`\nroute-param decoding on ${TARGET} matches CLAUDE.md`);
} else {
  console.error(`\n${bad.length} of ${results.length} rows changed on ${TARGET}.`);
  console.error("Re-measure both columns and update the table under \"API route params\" in CLAUDE.md.");
  process.exit(1);
}
