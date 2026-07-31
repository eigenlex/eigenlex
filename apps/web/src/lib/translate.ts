// The source-language word → the reader's language via Google Translate's public
// gtx endpoint. Single words, so we only ask for the translation segments (dt=t).

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

/** Normalize a BCP-47 tag ("es-ES") to a base language ("es"), defaulting to "en". */
export function baseLang(tag: string | null | undefined): string {
  return (tag ?? "en").split("-")[0]?.toLowerCase() || "en";
}

// `dict` adds the bilingual-dictionary block (dt=bd), which — unlike the plain
// translation — is casing-sensitive ("Essen" -> food/meal, "essen" -> eat/dine), so we
// use it to gloss each casing of a case-homograph.
export function gtxUrl(word: string, sl: string, tl: string, dict = false): string {
  const q = new URLSearchParams({ client: "gtx", sl, tl, dt: "t", q: word });
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
  /** POS label, in the *reader's* language ("noun", "sustantivo"); "" if absent. */
  pos: string;
  terms: string[];
}

/**
 * Pull dictionary senses out of a `dt=bd` response — its second element is
 * `[[<pos>, [<terms>…], [[<term>, …], …]], …]` — keeping Google's part-of-speech
 * grouping, so a word with several readings (Spanish "nada": pronoun "nothing", noun
 * "nothingness", adverb "not at all") can show each. Empty groups are dropped; returns
 * [] when there's no dictionary block at all.
 */
export function parseSenseGroups(data: unknown, limit = 4): SenseGroup[] {
  const groups = Array.isArray(data) ? (data as unknown[])[1] : undefined;
  if (!Array.isArray(groups)) return [];
  const out: SenseGroup[] = [];
  for (const g of groups) {
    if (!Array.isArray(g)) continue;
    const entries = Array.isArray(g[2]) ? g[2] : undefined;
    if (!entries) continue;
    const terms: string[] = [];
    for (const e of entries) {
      const term = Array.isArray(e) && typeof e[0] === "string" ? e[0].trim() : "";
      if (term && !terms.includes(term)) terms.push(term);
    }
    if (terms.length) out.push({ pos: typeof g[0] === "string" ? g[0].trim() : "", terms: terms.slice(0, limit) });
  }
  return out;
}

/**
 * The same senses flattened to distinct top terms across every group — a compact gloss
 * like "food, meal, dinner", used where one line is wanted per *casing* rather than per
 * part of speech.
 */
export function parseSenses(data: unknown, limit = 4): string[] {
  const terms: string[] = [];
  for (const g of parseSenseGroups(data, Infinity)) {
    for (const t of g.terms) if (!terms.includes(t)) terms.push(t);
  }
  return terms.slice(0, limit);
}
