// English → the reader's language via Google Translate's public gtx endpoint.
// Single words, so we only ask for the translation segments (dt=t).

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

/** Normalize a BCP-47 tag ("es-ES") to a base language ("es"), defaulting to "en". */
export function baseLang(tag: string | null | undefined): string {
  return (tag ?? "en").split("-")[0]?.toLowerCase() || "en";
}

export function gtxUrl(word: string, tl: string): string {
  const q = new URLSearchParams({ client: "gtx", sl: "en", tl, dt: "t", q: word });
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
