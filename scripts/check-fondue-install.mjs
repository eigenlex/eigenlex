#!/usr/bin/env node
// Checks that the vendored Fondue skill is intact in this working tree.
//
// `npx skills update` exits 0 whether it refreshed the skill or never found it, so a
// green CI step proves nothing on its own. This asserts the three things that have to
// hold for the CLI to see the skill at all, and it doubles as the check a fresh clone
// needs: everything it looks at is committed, so it passes on any machine or fails with
// the reason.

import { readFileSync, lstatSync, statSync, readlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, isAbsolute } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCK = join(ROOT, "skills-lock.json");
const LINK = join(ROOT, ".claude", "skills", "fondue");
const CANONICAL = join(ROOT, ".agents", "skills", "fondue");
const FILES = ["SKILL.md", "reference.md"];

const SOURCE = "frontify/fondue";

const die = (msg) => {
  console.error(`fondue skill: ${msg}`);
  process.exit(1);
};

let lock;
try {
  lock = JSON.parse(readFileSync(LOCK, "utf8"));
} catch {
  die(`no readable skills-lock.json at ${LOCK}. Without it \`npx skills update\` cannot find the skill.`);
}

const entry = lock.skills?.fondue;
if (!entry) die("skills-lock.json names no fondue entry, so the CLI would silently update nothing.");
if (entry.source !== SOURCE) die(`skills-lock.json points at ${entry.source}, expected ${SOURCE}.`);

// A clone with core.symlinks off writes the link as a regular file holding its target,
// which leaves Claude Code with a skill directory that is a line of text.
let link;
try {
  link = lstatSync(LINK);
} catch {
  die(`${LINK} is missing.`);
}

let target = null;
if (link.isSymbolicLink()) {
  target = readlinkSync(LINK);
  if (isAbsolute(target)) die(`the symlink is absolute (${target}), so it breaks in any clone but this one.`);
} else if (link.isFile()) {
  die(
    `.claude/skills/fondue is a regular file, not a symlink — this clone materialized it as text. ` +
      `Set \`git config core.symlinks true\` and re-checkout, or reinstall with \`npx skills add ${SOURCE}/packages/sdk\`.`,
  );
}

// statSync follows the link, so a missing .agents/ surfaces here rather than in the file
// loop below — and as a thrown ENOENT unless it is caught.
try {
  if (!statSync(LINK).isDirectory()) die(".claude/skills/fondue does not resolve to a directory.");
} catch (err) {
  if (err?.code !== "ENOENT") throw err;
  die(`the symlink points at ${target}, which does not exist. Is .agents/ missing from this tree?`);
}

for (const dir of [LINK, CANONICAL]) {
  for (const file of FILES) {
    try {
      statSync(join(dir, file));
    } catch {
      die(`${join(dir, file).slice(ROOT.length + 1)} is missing.`);
    }
  }
}

const skill = readFileSync(join(LINK, "SKILL.md"), "utf8");
if (!/^name:\s*fondue\s*$/m.test(skill)) die("SKILL.md carries no `name: fondue` frontmatter, so no agent would load it.");

const version = skill.match(/Authored against `@frontify\/fondue@([^`]+)`/)?.[1] ?? "unstated";

console.log(
  `fondue: lock -> ${entry.source}, ${target ? `symlink -> ${target}` : "real directory"}, ` +
    `${FILES.length} files, authored against ${version}`,
);
