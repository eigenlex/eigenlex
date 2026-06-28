import { getTop } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const k = Number(new URL(req.url).searchParams.get("k") ?? "25");
  return Response.json(getTop(Number.isFinite(k) ? k : 25));
}
