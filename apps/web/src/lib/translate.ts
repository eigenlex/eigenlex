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

/**
 * Pull dictionary senses out of a `dt=bd` response — its second element is
 * `[[<pos>, [<terms>…], [[<term>, …], …]], …]`. We flatten to the distinct top terms
 * (a compact gloss like "food, meal, dinner"). Returns [] when there's no dictionary
 * block (e.g. a proper noun, or a word with no distinct sense in that casing).
 */
export function parseSenses(data: unknown, limit = 4): string[] {
  const groups = Array.isArray(data) ? (data as unknown[])[1] : undefined;
  if (!Array.isArray(groups)) return [];
  const terms: string[] = [];
  for (const g of groups) {
    const entries = Array.isArray(g) ? g[2] : undefined;
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const term = Array.isArray(e) && typeof e[0] === "string" ? e[0].trim() : "";
      if (term && !terms.includes(term)) terms.push(term);
    }
  }
  return terms.slice(0, limit);
}
