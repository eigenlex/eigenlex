// The source-language word → the target language via Google Translate's public gtx
// endpoint. Single words, so we only ask for the translation segments (dt=t).

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

/** Normalize a BCP-47 tag ("es-ES") to a base language ("es"), defaulting to "en". */
export function baseLang(tag: string | null | undefined): string {
  return (tag ?? "en").split("-")[0]?.toLowerCase() || "en";
}

// `dict` adds the bilingual-dictionary block (dt=bd), which — unlike the plain
// translation — is casing-sensitive ("Essen" -> food/meal, "essen" -> eat/dine), so we
// use it to translate each casing of a case-homograph.
export function gtxUrl(word: string, source: string, target: string, dict = false): string {
  // sl/tl are Google's own spellings for the pair.
  const q = new URLSearchParams({ client: "gtx", sl: source, tl: target, dt: "t", q: word });
  if (dict) q.append("dt", "bd");
  return `${ENDPOINT}?${q}`;
}

/**
 * Pull the translated text out of the gtx response. Its shape is
 * `[[[<translated>, <source>, …], …], …]`; we concatenate the first-column
 * segments. Returns "" for any shape we don't recognize.
 */
export function parseGtx(data: unknown): string {
  const segments = Array.isArray(data) ? (data as unknown[])[0] : undefined;
  if (!Array.isArray(segments)) return "";
  return segments
    .map((seg) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""))
    .join("")
    .trim();
}

/** One part-of-speech reading of a word, as Google's dictionary block groups them. */
export interface SenseGroup {
  /** POS label, in the *target* language ("noun", "sustantivo"); "" if absent. */
  pos: string;
  terms: string[];
}

/** Google's confidence in one dictionary sense; `score` is null on an unranked entry. */
interface Entry {
  term: string;
  score: number | null;
}

/** A group's entries — `[<term>, [<reverse>…], null, <score>]` — de-duplicated by term. */
function entriesOf(group: unknown[]): Entry[] {
  const raw = Array.isArray(group[2]) ? group[2] : [];
  const out: Entry[] = [];
  for (const e of raw as unknown[]) {
    if (!Array.isArray(e) || typeof e[0] !== "string") continue;
    const term = e[0].trim();
    if (term && !out.some((x) => x.term === term)) {
      out.push({ term, score: typeof e[3] === "number" ? e[3] : null });
    }
  }
  return out;
}

// Google's senses run down to noise — "dog" → Hund .51, Rüde .0018, then Schreckschraube
// ("battle-axe") at 3e-6 — so cut relative to the group's best rather than at a fixed rank.
const MIN_RELATIVE_SCORE = 0.01;

/** The senses worth showing: those scoring within a hundredth of the group's best. */
function confidentTerms(entries: Entry[]): string[] {
  const top = Math.max(...entries.map((e) => e.score ?? 0));
  if (top <= 0) return entries.map((e) => e.term);
  return entries.filter((e) => (e.score ?? 0) / top >= MIN_RELATIVE_SCORE).map((e) => e.term);
}

/**
 * Dictionary senses from a `dt=bd` response — second element, shaped
 * `[[<pos>, [<terms>…], [[<term>, [<reverse>…], null, <score>], …]], …]` — keeping the
 * part-of-speech grouping. Empty groups are dropped; [] when there's no dictionary block.
 *
 * Google only ranks the dictionary for pairs involving English, and marks that by scoring
 * the entries. Other pairs come back empty, or — es→de, de→es — as an unscored reverse
 * lookup that routinely omits the primary sense ("agua" yields Gänsewein/Urin/Neigung, no
 * Wasser; "libro" yields only Blättermagen). Unranked we can't tell a good sense from a
 * marginal one, so we drop the block; `pivotSenses` covers those pairs instead.
 */
export function parseSenseGroups(data: unknown, limit = 4): SenseGroup[] {
  const groups = Array.isArray(data) ? (data as unknown[])[1] : undefined;
  if (!Array.isArray(groups)) return [];
  const out: SenseGroup[] = [];
  let ranked = false;
  for (const g of groups) {
    if (!Array.isArray(g)) continue;
    const entries = entriesOf(g);
    if (!entries.length) continue;
    if (entries.some((e) => e.score !== null)) ranked = true;
    const terms = confidentTerms(entries).slice(0, limit);
    if (terms.length) out.push({ pos: typeof g[0] === "string" ? g[0].trim() : "", terms });
  }
  return ranked ? out : [];
}

/** The senses flattened across groups — one compact line, "food, meal, dinner". */
export function flattenSenses(groups: SenseGroup[], limit = 4): string[] {
  const terms: string[] = [];
  for (const g of groups) for (const t of g.terms) if (!terms.includes(t)) terms.push(t);
  return terms.slice(0, limit);
}

/** English is Google's hub: only pairs touching it have a dictionary to look a word up in. */
export function needsPivot(source: string, target: string): boolean {
  return source !== "en" && target !== "en";
}

/** The English word a source word is looked up through, with the reading it was taken from. */
export interface Pivot {
  term: string;
  pos: string;
}

// How sure Google must be that its dictionary holds the word at all. "amigo" tops out at
// .004 with no "friend" in the block, where a sound entry scores .2–.75 — so below this
// the dictionary has nothing to say and the plain translation is the better answer.
const MIN_PIVOT_SCORE = 0.05;

/**
 * The English term to pivot on, from a source→English `dt=bd` response: the best-scoring
 * sense of the *first* group. Google orders groups by importance, and going by score alone
 * crosses readings — "verde" scores adjective "green" and noun "green" identically, and
 * the noun sends the translation to Grün/Rasen/Wiese, a lawn.
 */
export function pivotTerm(data: unknown): Pivot | null {
  const groups = Array.isArray(data) ? (data as unknown[])[1] : undefined;
  if (!Array.isArray(groups)) return null;
  for (const g of groups) {
    if (!Array.isArray(g)) continue;
    const entries = entriesOf(g);
    if (!entries.length) continue;
    const best = entries.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a));
    if ((best.score ?? 0) < MIN_PIVOT_SCORE) return null;
    return { term: best.term, pos: typeof g[0] === "string" ? g[0].trim() : "" };
  }
  return null;
}

/**
 * The English→target groups narrowed to the reading the source word actually had. The
 * English word carries readings the source word doesn't — "escuela" is never the verb
 * "to school" — so a miss yields nothing rather than a translation of a different word.
 */
export function alignGroup(groups: SenseGroup[], pos: string): SenseGroup[] {
  const match = groups.find((g) => g.pos === pos);
  return match ? [match] : [];
}
