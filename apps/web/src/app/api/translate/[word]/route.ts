import { baseLang, gtxUrl, parseGtx } from "@/lib/translate";

// A word's translation is stable — let Next's data cache hold it for a day.
export const revalidate = 86400;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ word: string }> },
) {
  const { word } = await params;
  const text = decodeURIComponent(word).toLowerCase();
  const q = new URL(req.url).searchParams;
  const sl = baseLang(q.get("sl"));
  const tl = baseLang(q.get("tl"));

  try {
    const res = await fetch(gtxUrl(text, sl, tl), { next: { revalidate } });
    if (!res.ok) return new Response("upstream error", { status: 502 });
    return Response.json({ word: text, sl, tl, translation: parseGtx(await res.json()) });
  } catch {
    return new Response("upstream error", { status: 502 });
  }
}
