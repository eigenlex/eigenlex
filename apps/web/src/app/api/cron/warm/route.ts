import { getBand, getWord } from "@/lib/bands";
import type { SourceLang } from "@/lib/languages";
import { isSingleWord } from "@/lib/translate";
import { GET as translate } from "../../translate/[word]/route";

// The head is warmed on a rolling pass rather than all at once: 100 words a day takes
// about 61 days to cover de<->en, which sits comfortably inside the 90-day `revalidate`
// on the entries themselves. So every head word is refreshed before it can expire, and
// the outbound rate stays at roughly one request every fifteen minutes.
const PER_DAY = 100;

export const maxDuration = 60;

/** One word the card would ask for, in the pair it would ask for it in. */
interface Warm {
  word: string;
  source: SourceLang;
  target: string;
}

// Both directions of the one pair, so the swap button lands on warmed entries too.
const PAIRS: [SourceLang, string][] = [
  ["de", "en"],
  ["en", "de"],
];

/**
 * The A1+A2 head of each pair, as the strings the card actually requests: `dt=bd` is
 * casing-sensitive, so a case-homograph contributes both of its spellings.
 */
function warmList(): Warm[] {
  const out: Warm[] = [];
  for (const [source, target] of PAIRS) {
    for (const key of ["A1", "A2"]) {
      for (const w of getBand(source, "cefr", key)?.words ?? []) {
        for (const form of getWord(source, w)?.forms ?? [w]) {
          out.push({ word: form, source, target });
        }
      }
    }
  }
  return out;
}

let cached: Warm[] | null = null;
const list = () => (cached ??= warmList());

/**
 * The slice of the head this day warms. Derived from the date rather than from a stored
 * cursor: the rotation has to survive a redeploy and a cold start, and a date needs
 * nothing to persist it.
 * @spec WARM-2
 */
export function windowFor(day: number, total: number, per = PER_DAY): number[] {
  const start = ((day * per) % total + total) % total;
  return Array.from({ length: Math.min(per, total) }, (_, i) => (start + i) % total);
}

const dayNumber = (now: number) => Math.floor(now / 86_400_000);

export async function GET(req: Request) {
  // This route spends our Google quota, so an unset secret refuses rather than opening
  // the faucet. Vercel sends the header itself when CRON_SECRET is configured.
  // @spec WARM-1
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const all = list();
  const today = windowFor(dayNumber(Date.now()), all.length).map((i) => all[i]!);

  // Four at a time: 100 sequential calls would risk the function timeout, and a burst
  // this small once a day is nothing to the endpoint either way.
  let warmed = 0;
  const cursor = { i: 0 };
  const worker = async () => {
    for (;;) {
      const next = cursor.i++;
      if (next >= today.length) return;
      const { word, source, target } = today[next]!;
      // Through the route, not straight to `gtx`: the entry a card reads is the one the
      // route's own fetch writes, so warming any other way would fill a key nothing reads.
      const res = await translate(
        new Request(`http://warm/api/translate/x?source=${source}&target=${target}&dict=1`),
        { params: Promise.resolve({ word }) },
      );
      if (res.ok) warmed++;
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  return Response.json({ day: dayNumber(Date.now()), asked: today.length, warmed, total: all.length });
}

/** The head this route walks, for the tests that check what it would send upstream. */
export const warmWords = () => list();
export const isWarmable = (w: Warm) => isSingleWord(w.word);
