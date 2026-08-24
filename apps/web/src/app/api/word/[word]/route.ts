import { getWord } from "@/lib/bands";
import { DEFAULT_SOURCE, isSourceLang } from "@/lib/languages";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ word: string }> },
) {
  // @spec ROUTE-7
  const { word } = await params;
  const source = new URL(req.url).searchParams.get("source") ?? DEFAULT_SOURCE;
  // @spec ROUTE-9
  if (!isSourceLang(source)) return new Response("unknown language", { status: 404 });
  // @spec ROUTE-8
  const info = getWord(source, word.toLowerCase());
  return info ? Response.json(info) : new Response("not found", { status: 404 });
}
