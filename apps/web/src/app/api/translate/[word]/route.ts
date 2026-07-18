import { baseLang, gtxUrl, parseGtx, parseSenses } from "@/lib/translate";

// A word's translation is stable — let Next's data cache hold it for a day.
export const revalidate = 86400;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ word: string }> },
) {
  const { word } = await params;
  const q = new URL(req.url).searchParams;
  const sl = baseLang(q.get("sl"));
  const tl = baseLang(q.get("tl"));
  // `dict` mode glosses one casing of a case-homograph: casing is significant, so keep
  // it; otherwise lowercase for a stable, lowercase gloss and better cache hits.
  const dict = q.get("dict") === "1";
  const text = dict ? decodeURIComponent(word) : decodeURIComponent(word).toLowerCase();

  try {
    const res = await fetch(gtxUrl(text, sl, tl, dict), { next: { revalidate } });
    if (!res.ok) return new Response("upstream error", { status: 502 });
    const data = await res.json();
    return Response.json({
      word: text,
      sl,
      tl,
      translation: parseGtx(data),
      senses: dict ? parseSenses(data) : [],
    });
  } catch {
    return new Response("upstream error", { status: 502 });
  }
}
