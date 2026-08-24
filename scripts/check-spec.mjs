#!/usr/bin/env node
// Checks that SPEC.md and the tests still agree about what this app must do.
//
// The spec is written from prompts and the code is written from the spec, both by the
// same hand. That hand can restate its own mistake in both places and notice nothing, so
// an unchecked spec is worse than none — it is a second document that can lie with
// authority. This is the thing that stops it.
//
// Two directions, because a spec rots from either end:
//   - a rule nothing asserts is a wish, not a rule
//   - a proof naming a rule the spec no longer defines is a leftover asserting a ghost
//
//   node scripts/check-spec.mjs [--list]

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = join(ROOT, "SPEC.md");
const LIST = process.argv.includes("--list");

// A rule is defined by being the first cell of a table row. That keeps the definition and
// its statement on one line, and leaves an ID mentioned in prose as a mention.
const RULE_ROW = /^\|\s*`?([A-Z]+-\d+)`?\s*\|(.*)$/;
// `// @spec GATE-1, GATE-2` — one annotation may carry several.
const ANNOTATION = /@spec\s+([A-Z]+-\d+(?:\s*[,\s]\s*[A-Z]+-\d+)*)/g;

// Only these count as proof. An `@spec` anywhere else is a comment, not a claim — this
// file included, or the IDs in the annotation syntax above would prove themselves.
const SELF = "scripts/check-spec.mjs";
const isProof = (path) =>
  path !== SELF && (/\.test\.tsx?$/.test(path) || (path.startsWith("scripts/") && path.endsWith(".mjs")));
const SKIP = new Set(["node_modules", ".git", ".next", ".next-build", ".turbo", "data", ".agents"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(ROOT, full));
  }
  return out;
}

function readRules() {
  const rules = new Map();
  const dupes = [];
  for (const line of readFileSync(SPEC, "utf8").split("\n")) {
    const m = RULE_ROW.exec(line);
    if (!m) continue;
    const [, id, rest] = m;
    // The statement is whatever the row says after the ID — the second cell for a prose
    // rule, the whole row for the decode table, which states itself in columns.
    const text = rest.split("|").map((c) => c.trim()).filter(Boolean).join(" · ");
    if (rules.has(id)) dupes.push(id);
    else rules.set(id, text);
  }
  return { rules, dupes };
}

function readProofs(files) {
  const proofs = new Map(); // id -> [file, ...]
  const cited = [];         // { id, file }
  for (const file of files) {
    if (!isProof(file)) continue;
    const src = readFileSync(join(ROOT, file), "utf8");
    for (const m of src.matchAll(ANNOTATION)) {
      for (const id of m[1].split(/[,\s]+/).filter(Boolean)) {
        cited.push({ id, file });
        const at = proofs.get(id);
        if (at) { if (!at.includes(file)) at.push(file); } else proofs.set(id, [file]);
      }
    }
  }
  return { proofs, cited };
}

const { rules, dupes } = readRules();
// A reformatted table must fail loudly rather than silently assert nothing, which is the
// same trap check-deployed-decodes.mjs guards against reading the same file.
if (rules.size < 10) {
  console.error(`spec: parsed ${rules.size} rules from SPEC.md — expected a | ID | Rule | table per section`);
  process.exit(1);
}

const { proofs, cited } = readProofs(walk(ROOT));
const unproven = [...rules.keys()].filter((id) => !proofs.has(id));
const unknown = cited.filter(({ id }) => !rules.has(id));

if (LIST) {
  for (const [id, text] of rules) {
    const at = proofs.get(id);
    console.log(`${id.padEnd(10)} ${at ? at.join(", ") : "—"}\n${" ".repeat(11)}${text}`);
  }
  console.log();
}

console.log(`spec: ${rules.size} rules, ${rules.size - unproven.length} proven`);

const say = (title, lines) => {
  if (!lines.length) return;
  console.error(`\n${title}`);
  for (const l of lines) console.error(`  ${l}`);
};

say("defined twice — an ID is for one rule and stays with it:", dupes);
say("unproven — no test names these:", unproven.map((id) => `${id.padEnd(10)} ${rules.get(id)}`));
say(
  "unknown — these name a rule SPEC.md does not define:",
  [...new Set(unknown.map(({ id, file }) => `${file} names ${id}`))],
);

if (dupes.length || unproven.length || unknown.length) {
  console.error(`\nEither the rule needs a test, or SPEC.md and the @spec comment need to agree.`);
  process.exit(1);
}
