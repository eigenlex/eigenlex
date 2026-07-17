import { getBand, isView } from "@/lib/bands";
import { DEFAULT_SOURCE, isSourceLang } from "@/lib/languages";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ view: string; key: string }> },
) {
  const { view, key } = await params;
  if (!isView(view)) return new Response("unknown view", { status: 404 });
  const lang = new URL(req.url).searchParams.get("lang") ?? DEFAULT_SOURCE;
  if (!isSourceLang(lang)) return new Response("unknown language", { status: 404 });
  const band = getBand(lang, view, decodeURIComponent(key));
  return band ? Response.json(band) : new Response("unknown band", { status: 404 });
}
