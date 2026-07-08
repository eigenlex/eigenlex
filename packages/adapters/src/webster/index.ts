import type { Dictionary } from "@eigenlex/core";
import { isObsoleteSense, splitWebsterSenses, type WebsterCleanOptions } from "./clean";

/**
 * The GCIDE-derived Webster 1913 JSON shape: lowercase headword -> one raw
 * definition blob (numbered senses, field labels, "Note:" passages inline).
 * Available e.g. at github.com/matthewreagan/WebstersEnglishDictionary.
 */
export type WebsterSource = Record<string, string>;

export type WebsterAdapterOptions = WebsterCleanOptions;

/**
 * Convert a Webster 1913 source into an `@eigenlex/core` Dictionary. Purely
 * structural: split each blob into senses and tidy markup. Every headword is
 * kept — even when its own definition cleans to nothing — so that references to
 * it from other entries still form edges. The exception is `dropObsolete`, which
 * omits headwords whose every sense is obsolete.
 *
 * `dropObsolete` must see full definitions: run it on the untrimmed source, not
 * on abridged text (a word trimmed to its leading obsolete sense would look
 * wholly obsolete when it isn't).
 */
export function websterAdapter(
  source: WebsterSource,
  options: WebsterAdapterOptions = {},
): Dictionary {
  // Null-proto: headwords like "constructor" / "__proto__" must not collide
  // with Object.prototype members.
  const dict: Dictionary = Object.create(null);
  for (const [rawHeadword, rawDefinition] of Object.entries(source)) {
    const headword = rawHeadword.trim();
    if (!headword) continue;
    const senses = splitWebsterSenses(rawDefinition ?? "", options);
    // A word is obsolete only if *all* its senses are; keep it if any survives.
    if (options.dropObsolete && senses.length > 0 && senses.every(isObsoleteSense)) {
      continue;
    }
    const existing = dict[headword];
    if (existing) existing.push(...senses);
    else dict[headword] = senses;
  }
  return dict;
}

export { isObsoleteSense, splitWebsterSenses } from "./clean";
export type { WebsterCleanOptions } from "./clean";
