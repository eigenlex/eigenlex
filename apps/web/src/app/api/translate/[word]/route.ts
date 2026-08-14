import { getLevel } from "@/lib/bands";
import { isSourceLang } from "@/lib/languages";
import type { WordLevel } from "@/lib/types";
import {
  alignGroup,
  baseLang,
  flattenSenses,
  gtxUrl,
  needsPivot,
  parseGtx,
  parseSenseGroups,
  pivotTerm,
  type SenseGroup,
} from "@/lib/translate";

// A word's translation is stable — let Next's data cache hold it for a day.
export const revalidate = 86400;

/**
 * Each translated term's CEFR level in the language it's written in, keyed by the term as
 * Google spelled it. Google's senses are ordered by confidence, not by difficulty — "agua"
 * A1 and "abrevar" C2 arrive as equals — so the level is what tells a learner which
 * alternative is theirs. Only the six indexed languages have levels; a term that is a
 * phrase, or a word the list doesn't carry, is simply absent.
 */
function levelsOf(target: string, groups: SenseGroup[], translation: string) {
  // Levels come off the indexed word lists, so the target must be a source language too.
  if (!isSourceLang(target)) return {};
  const levels: Record<string, WordLevel> = {};
  for (const term of [...groups.flatMap((g) => g.terms), translation]) {
    if (!term || term in levels) continue;
    const level = getLevel(target, term);
    if (level) levels[term] = level;
  }
  return levels;
}

async function gtx(
  word: string,
  source: string,
  target: string,
  dict: boolean,
): Promise<unknown> {
  const res = await fetch(gtxUrl(word, source, target, dict), { next: { revalidate } });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ word: string }> },
) {
  const { word } = await params;
  const q = new URL(req.url).searchParams;
  const source = baseLang(q.get("source"));
  const target = baseLang(q.get("target"));
  // `dict` mode translates one casing of a case-homograph: casing is significant, so keep
  // it; otherwise lowercase for a stable, lowercase result and better cache hits.
  const dict = q.get("dict") === "1";
  const text = dict ? decodeURIComponent(word) : decodeURIComponent(word).toLowerCase();

  try {
    // The English hop is worth starting up front: a pair Google has no dictionary for
    // always ends up needing it, and this keeps the pivot to one extra round trip.
    const pivoting = dict && needsPivot(source, target);
    const [data, viaEn] = await Promise.all([
      gtx(text, source, target, dict),
      pivoting ? gtx(text, source, "en", true) : null,
    ]);

    let groups: SenseGroup[] = dict ? parseSenseGroups(data) : [];
    if (!groups.length && viaEn) {
      const pivot = pivotTerm(viaEn);
      if (pivot) {
        groups = alignGroup(parseSenseGroups(await gtx(pivot.term, "en", target, true)), pivot.pos);
      }
    }

    const translation = parseGtx(data);
    return Response.json({
      word: text,
      source,
      target,
      translation,
      senses: flattenSenses(groups),
      // Per-part-of-speech readings, so the card can show a word's distinct meanings.
      groups,
      levels: levelsOf(target, groups, translation),
    });
  } catch {
    return new Response("upstream error", { status: 502 });
  }
}
