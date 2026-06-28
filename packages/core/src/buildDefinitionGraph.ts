import type {
  BuildOptions,
  DefinitionGraph,
  Dictionary,
  Headword,
  LanguageProfile,
} from "./types";
import { english } from "./language/english";
import { TokenTrie } from "./trie";

/** Run a text through tokenize -> normalize -> (optional) lemmatize. */
function canonicalTokens(text: string, lang: LanguageProfile): string[] {
  const out: string[] = [];
  for (const raw of lang.tokenize(text)) {
    let tok = lang.normalize(raw);
    if (!tok) continue;
    if (lang.lemmatize) tok = lang.lemmatize(tok);
    if (tok) out.push(tok);
  }
  return out;
}

/**
 * Build the directed graph a dictionary's definitions form. An edge `w -> v`
 * means `v` (a headword in this same dictionary) appears in `w`'s definition.
 */
export function buildDefinitionGraph(
  dict: Dictionary,
  options: BuildOptions = {},
): DefinitionGraph {
  const lang = options.language ?? english;
  const includeStopwords = options.includeStopwords ?? false;
  const includeSelfLoops = options.includeSelfLoops ?? false;
  const matchPhrases = options.matchPhrases ?? true;
  const stop = lang.stopwords ?? new Set<string>();

  // Pass 1: canonicalize headwords, build the matching trie and labels.
  const trie = new TokenTrie();
  // Null-proto: a headword like "constructor" or "__proto__" must be a plain
  // data key, not a collision with Object.prototype.
  const labels: Record<Headword, Headword> = Object.create(null);
  const nodes = new Set<string>();
  const canonicalOf = new Map<Headword, string>();

  for (const original of Object.keys(dict)) {
    const tokens = canonicalTokens(original, lang);
    if (tokens.length === 0) continue;
    const canonical = tokens.join(" ");
    canonicalOf.set(original, canonical);
    nodes.add(canonical);
    if (!(canonical in labels)) labels[canonical] = original;
    // A multi-word headword is only matchable when phrase matching is on.
    if (matchPhrases || tokens.length === 1) trie.insert(tokens, canonical);
  }

  // Pass 2: scan each definition for references to known headwords.
  const adj = new Map<string, Set<string>>();
  for (const node of nodes) adj.set(node, new Set<string>());

  for (const original of Object.keys(dict)) {
    const self = canonicalOf.get(original);
    if (self === undefined) continue;
    const bucket = adj.get(self);
    if (!bucket) continue;

    for (const def of dict[original] ?? []) {
      const tokens = canonicalTokens(def, lang);
      let i = 0;
      while (i < tokens.length) {
        const match = trie.matchLongest(tokens, i);
        if (!match) {
          i += 1;
          continue;
        }
        const head = tokens[i];
        const isStopword = match.length === 1 && head !== undefined && stop.has(head);
        const isSelf = match.value === self;
        if ((!isSelf || includeSelfLoops) && (!isStopword || includeStopwords)) {
          bucket.add(match.value);
        }
        i += match.length;
      }
    }
  }

  // Finalize: sorted edge lists, degree-based stats.
  const edges: Record<Headword, Headword[]> = Object.create(null);
  const inDegree = new Map<string, number>();
  for (const node of nodes) inDegree.set(node, 0);

  let edgeCount = 0;
  for (const node of [...nodes].sort()) {
    const targets = [...(adj.get(node) ?? [])].sort();
    edges[node] = targets;
    edgeCount += targets.length;
    for (const target of targets) {
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  let sinks = 0;
  let sources = 0;
  for (const node of nodes) {
    if ((edges[node]?.length ?? 0) === 0) sinks += 1;
    if ((inDegree.get(node) ?? 0) === 0) sources += 1;
  }

  return {
    language: lang.id,
    edges,
    labels,
    stats: { nodes: nodes.size, edges: edgeCount, sinks, sources },
  };
}
