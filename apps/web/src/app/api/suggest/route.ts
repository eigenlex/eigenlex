import { getSuggestions } from "@/lib/bands";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const limit = Number(params.get("limit") ?? "8");
  return Response.json(getSuggestions(q, Number.isFinite(limit) ? limit : 8));
}
