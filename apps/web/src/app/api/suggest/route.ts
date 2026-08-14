import { getSuggestions } from "@/lib/bands";
import { DEFAULT_SOURCE, isSourceLang } from "@/lib/languages";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const limit = Number(params.get("limit") ?? "8");
  const source = params.get("source") ?? DEFAULT_SOURCE;
  if (!isSourceLang(source)) return new Response("unknown language", { status: 404 });
  return Response.json(getSuggestions(source, q, Number.isFinite(limit) ? limit : 8));
}
