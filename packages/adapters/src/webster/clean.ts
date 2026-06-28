export interface WebsterCleanOptions {
  /** Keep editorial "Note:" / "Syn." passages. Default false. */
  keepNotes?: boolean;
  /** Keep leading field labels like "(Zoöl.)". Default false. */
  keepFieldLabels?: boolean;
  /** Drop senses shorter than this many characters. Default 1. */
  minSenseLength?: number;
}

const WHITESPACE = /\s+/g;
const DEFN_MARKER = /\bDefn:\s*/g;
// A sense boundary: whitespace before "<n>. " that starts a capitalized gloss
// or a field label. (Quotations like "2 Kings" lack the period and don't match.)
const SENSE_BOUNDARY = /\s(?=\d{1,2}\.\s+[A-Z(])/;
const LEADING_MARKER = /^\d{1,2}\.\s+/;
const LEADING_FIELD_LABEL = /^\([^)]{1,20}\.\)\s*/;
// Trailing editorial sections, not part of the gloss: usage "Note:" passages
// and "Syn." synonym lists.
const EDITORIAL_TAIL = /\b(?:Note:|Syn\.)\s.*$/s;

/**
 * Split one Webster 1913 definition blob into clean senses. Sense boundaries are
 * best-effort and purely cosmetic — the definition graph is identical however
 * the text is chunked, since references are collected across all senses.
 */
export function splitWebsterSenses(
  raw: string,
  options: WebsterCleanOptions = {},
): string[] {
  const minLength = options.minSenseLength ?? 1;
  const text = raw.replace(WHITESPACE, " ").replace(DEFN_MARKER, "").trim();
  if (!text) return [];

  const senses: string[] = [];
  for (const segment of text.split(SENSE_BOUNDARY)) {
    let sense = segment.replace(LEADING_MARKER, "");
    if (!options.keepFieldLabels) sense = sense.replace(LEADING_FIELD_LABEL, "");
    if (!options.keepNotes) sense = sense.replace(EDITORIAL_TAIL, "");
    sense = sense.trim();
    if (sense.length >= minLength) senses.push(sense);
  }
  return senses;
}
