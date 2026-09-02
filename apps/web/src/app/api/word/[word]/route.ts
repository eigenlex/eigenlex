import { getWord, resolveForm } from "@/lib/bands";
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
  const asked = word.toLowerCase();
  const info = getWord(source, asked);
  if (info) return Response.json(info);
  // @spec FORM-4
  // Only on a miss: an inflected form answers with the word it belongs to, named as such.
  const base = await resolveForm(source, asked);
  const resolved = base === null ? null : getWord(source, base);
  return resolved
    ? Response.json({ ...resolved, from: asked })
    : new Response("not found", { status: 404 });
}
