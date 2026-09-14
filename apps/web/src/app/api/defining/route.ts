import { getDefiningPoints } from "@/lib/bands";
import { DEFAULT_SOURCE, isSourceLang } from "@/lib/languages";

export const dynamic = "force-dynamic";

// @spec ROUTE-9, BAND-13
export async function GET(req: Request) {
  const source = new URL(req.url).searchParams.get("source") ?? DEFAULT_SOURCE;
  if (!isSourceLang(source)) return new Response("unknown language", { status: 404 });
  const points = getDefiningPoints(source);
  return points ? Response.json(points) : new Response("no defining levels", { status: 404 });
}
