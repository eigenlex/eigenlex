import { getPath } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const from = (params.get("from") ?? "").toLowerCase();
  const to = (params.get("to") ?? "").toLowerCase();
  return Response.json({ from, to, path: getPath(from, to) });
}
