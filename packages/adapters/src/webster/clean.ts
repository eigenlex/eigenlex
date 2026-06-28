export interface WebsterCleanOptions {
  /** Keep editorial "Note:" / "Syn." passages. Default false. */
  keepNotes?: boolean;
  /** Keep leading field labels like "(Zoöl.)". Default false. */
  keepFieldLabels?: boolean;
  /** Keep "See ..." cross-reference pointers. Default false. */
  keepCrossRefs?: boolean;
  /**
   * Keep grammatical abbreviations ("n.", "v. t."), genus/author initials
   * ("C.", "B. Jonson"), and "(a)" sub-sense markers. Default false — left in,
   * they tokenize to single letters and forge spurious edges (the `n`/`b`/`r`/`p`
   * noise seen in centrality).
   */
  keepAbbreviations?: boolean;
  /** Drop senses shorter than this many characters. Default 1. */
  minSenseLength?: number;
}

const WHITESPACE = /\s+/g;
const DEFN_MARKER = /\bDefn:\s*/g;
// Capitalized cross-reference clause: "See Dog.", "See Owling, n.", "See under X".
const CROSS_REF = /\bSee\b[^.;]*[.;]?/g;
// Lettered sub-sense markers: "(a)", "(b)".
const SUBSENSE_LABEL = /\([a-z]\)/gi;
// A lone single letter + period: POS markers ("n.", "v.", "a."), the "t"/"i" of
// "v. t."/"v. i.", and genus/author initials ("C.", "B."). The Unicode-aware
// lookbehind (not ASCII \b) is essential: \b sees a boundary between "ö" and
// "l", which would wrongly clip the "l." inside "(Zoöl.)".
const ABBREV = /(?<![\p{L}\p{M}])[A-Za-z]\./gu;
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
 * the text is chunked, since references are collected across all senses. The
 * cross-reference / abbreviation removal, however, materially de-noises the graph.
 */
export function splitWebsterSenses(
  raw: string,
  options: WebsterCleanOptions = {},
): string[] {
  const minLength = options.minSenseLength ?? 1;
  let text = raw.replace(WHITESPACE, " ").replace(DEFN_MARKER, "").trim();
  if (!text) return [];

  if (!options.keepCrossRefs) text = text.replace(CROSS_REF, " ");
  if (!options.keepAbbreviations) {
    text = text.replace(SUBSENSE_LABEL, " ").replace(ABBREV, " ");
  }
  text = text.replace(WHITESPACE, " ").trim();
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
