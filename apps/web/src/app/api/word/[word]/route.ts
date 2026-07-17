import { getWord } from "@/lib/bands";
import { DEFAULT_SOURCE, isSourceLang } from "@/lib/languages";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ word: string }> },
) {
  const { word } = await params;
  const lang = new URL(req.url).searchParams.get("lang") ?? DEFAULT_SOURCE;
  if (!isSourceLang(lang)) return new Response("unknown language", { status: 404 });
  const info = getWord(lang, decodeURIComponent(word).toLowerCase());
  return info ? Response.json(info) : new Response("not found", { status: 404 });
}
